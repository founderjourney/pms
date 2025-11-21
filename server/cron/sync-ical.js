/**
 * iCal Sync Cron Job
 * Automatically synchronizes with all active OTA calendar feeds
 *
 * Run standalone: node server/cron/sync-ical.js
 * Or import and start: require('./cron/sync-ical').startCronJob()
 */

const cron = require('node-cron');
const DatabaseAdapter = require('../db-adapter');
const https = require('https');
const http = require('http');
const icalParser = require('node-ical');
const moment = require('moment-timezone');

class ICalSyncCron {
  constructor() {
    this.dbAdapter = null;
    this.isRunning = false;
    this.cronTask = null;
    this.syncInterval = '0 */2 * * *'; // Every 2 hours (at minute 0)
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    if (!this.dbAdapter) {
      this.dbAdapter = new DatabaseAdapter();
      await this.dbAdapter.connect();
      console.log('✅ iCal Sync Cron: Database connected');
    }
  }

  /**
   * Fetch URL content
   */
  fetchURL(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;

      client.get(url, { timeout: 10000 }, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  /**
   * Check for booking conflicts
   */
  async checkConflicts(bed_id, room_id, checkIn, checkOut) {
    const conflicts = [];

    // Check internal bookings
    const internalBookings = await this.dbAdapter.query(
      `SELECT * FROM bookings
       WHERE bed_id = ?
       AND status IN ('confirmed', 'checked_in')
       AND ((check_in < ? AND check_out > ?) OR (check_in < ? AND check_out > ?) OR (check_in >= ? AND check_out <= ?))`,
      [bed_id, checkOut, checkIn, checkOut, checkIn, checkIn, checkOut]
    );

    if (internalBookings && internalBookings.length > 0) {
      conflicts.push(...internalBookings.map(b => ({ type: 'internal', booking: b })));
    }

    // Check external reservations
    const externalBookings = await this.dbAdapter.query(
      `SELECT * FROM external_reservations
       WHERE bed_id = ?
       AND status = 'confirmed'
       AND ((check_in < ? AND check_out > ?) OR (check_in < ? AND check_out > ?) OR (check_in >= ? AND check_out <= ?))`,
      [bed_id, checkOut, checkIn, checkOut, checkIn, checkIn, checkOut]
    );

    if (externalBookings && externalBookings.length > 0) {
      conflicts.push(...externalBookings.map(b => ({ type: 'external', booking: b })));
    }

    return conflicts;
  }

  /**
   * Sync a single source
   */
  async syncSource(source) {
    const syncStarted = new Date().toISOString();
    const stats = {
      processed: 0,
      created: 0,
      updated: 0,
      cancelled: 0,
      conflicts: 0
    };

    const isSqlite = !this.dbAdapter.isProduction;

    try {
      console.log(`🔄 Syncing: ${source.name} (${source.source_type})`);

      // Fetch iCal feed
      const icalData = await this.fetchURL(source.ical_url);

      // Parse iCal
      const events = await icalParser.async.parseICS(icalData);

      // Process each event
      for (const key in events) {
        if (!events.hasOwnProperty(key)) continue;

        const event = events[key];
        if (event.type !== 'VEVENT') continue;

        stats.processed++;

        // Extract event data
        const externalId = event.uid || key;
        const guestName = event.summary || 'External Booking';
        const checkIn = moment(event.start).format('YYYY-MM-DD');
        const checkOut = moment(event.end).format('YYYY-MM-DD');
        const status = event.status === 'CANCELLED' ? 'cancelled' : 'confirmed';

        // Check if reservation already exists
        const existing = await this.dbAdapter.get(
          'SELECT * FROM external_reservations WHERE source_id = ? AND external_id = ?',
          [source.id, externalId]
        );

        if (existing) {
          // Update existing
          if (existing.status !== status || existing.check_in !== checkIn || existing.check_out !== checkOut) {
            if (isSqlite) {
              await this.dbAdapter.run(
                `UPDATE external_reservations
                 SET guest_name = ?, check_in = ?, check_out = ?, status = ?, raw_ical_data = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [guestName, checkIn, checkOut, status, JSON.stringify(event), existing.id]
              );
            } else {
              await this.dbAdapter.query(
                `UPDATE external_reservations
                 SET guest_name = $1, check_in = $2, check_out = $3, status = $4, raw_ical_data = $5, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6`,
                [guestName, checkIn, checkOut, status, JSON.stringify(event), existing.id]
              );
            }
            stats.updated++;

            if (status === 'cancelled') {
              stats.cancelled++;
              console.log(`  ❌ Cancelled: ${guestName} (${checkIn} to ${checkOut})`);
            } else {
              console.log(`  ✏️  Updated: ${guestName} (${checkIn} to ${checkOut})`);
            }
          }
        } else {
          // Create new reservation
          // Check for conflicts
          const conflicts = await this.checkConflicts(source.bed_id, source.room_id, checkIn, checkOut);
          if (conflicts.length > 0) {
            console.warn(`  ⚠️  Conflict detected for ${guestName} (${checkIn} to ${checkOut})`);
            stats.conflicts++;
            // Still create but flag for review
          }

          if (isSqlite) {
            await this.dbAdapter.run(
              `INSERT INTO external_reservations
               (source_id, external_id, source_type, guest_name, check_in, check_out, bed_id, room_id, status, raw_ical_data)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [source.id, externalId, source.source_type, guestName, checkIn, checkOut,
               source.bed_id, source.room_id, status, JSON.stringify(event)]
            );
          } else {
            await this.dbAdapter.query(
              `INSERT INTO external_reservations
               (source_id, external_id, source_type, guest_name, check_in, check_out, bed_id, room_id, status, raw_ical_data)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [source.id, externalId, source.source_type, guestName, checkIn, checkOut,
               source.bed_id, source.room_id, status, JSON.stringify(event)]
            );
          }

          stats.created++;
          console.log(`  ✅ Created: ${guestName} (${checkIn} to ${checkOut})`);
        }
      }

      // Update source last_sync
      if (isSqlite) {
        await this.dbAdapter.run(
          `UPDATE ical_sources
           SET last_sync_at = CURRENT_TIMESTAMP, last_sync_status = ?, last_sync_error = NULL
           WHERE id = ?`,
          ['success', source.id]
        );
      } else {
        await this.dbAdapter.query(
          `UPDATE ical_sources
           SET last_sync_at = CURRENT_TIMESTAMP, last_sync_status = $1, last_sync_error = NULL
           WHERE id = $2`,
          ['success', source.id]
        );
      }

      // Log sync
      const syncCompleted = new Date().toISOString();
      if (isSqlite) {
        await this.dbAdapter.run(
          `INSERT INTO sync_logs
           (source_id, sync_started_at, sync_completed_at, status, events_processed, events_created, events_updated, events_cancelled, conflicts_detected)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [source.id, syncStarted, syncCompleted, 'success', stats.processed, stats.created, stats.updated, stats.cancelled, stats.conflicts]
        );
      } else {
        await this.dbAdapter.query(
          `INSERT INTO sync_logs
           (source_id, sync_started_at, sync_completed_at, status, events_processed, events_created, events_updated, events_cancelled, conflicts_detected)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [source.id, syncStarted, syncCompleted, 'success', stats.processed, stats.created, stats.updated, stats.cancelled, stats.conflicts]
        );
      }

      console.log(`  📊 Stats: ${stats.created} new, ${stats.updated} updated, ${stats.conflicts} conflicts`);
      return { success: true, stats, source: source.name };

    } catch (error) {
      console.error(`  ❌ Sync failed: ${error.message}`);

      // Update source with error
      const isSqlite = !this.dbAdapter.isProduction;
      if (isSqlite) {
        await this.dbAdapter.run(
          `UPDATE ical_sources
           SET last_sync_status = ?, last_sync_error = ?
           WHERE id = ?`,
          ['error', error.message, source.id]
        );
      } else {
        await this.dbAdapter.query(
          `UPDATE ical_sources
           SET last_sync_status = $1, last_sync_error = $2
           WHERE id = $3`,
          ['error', error.message, source.id]
        );
      }

      // Log failed sync
      const syncCompleted = new Date().toISOString();
      if (isSqlite) {
        await this.dbAdapter.run(
          `INSERT INTO sync_logs
           (source_id, sync_started_at, sync_completed_at, status, error_message)
           VALUES (?, ?, ?, ?, ?)`,
          [source.id, syncStarted, syncCompleted, 'error', error.message]
        );
      } else {
        await this.dbAdapter.query(
          `INSERT INTO sync_logs
           (source_id, sync_started_at, sync_completed_at, status, error_message)
           VALUES ($1, $2, $3, $4, $5)`,
          [source.id, syncStarted, syncCompleted, 'error', error.message]
        );
      }

      return { success: false, error: error.message, source: source.name };
    }
  }

  /**
   * Sync all active sources
   */
  async syncAll() {
    if (this.isRunning) {
      console.log('⏭️  Sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('\n🔄 ====== iCal Sync Started ======');
      console.log(`📅 Time: ${new Date().toISOString()}`);

      await this.initialize();

      // Get all active sources
      const isSqlite = !this.dbAdapter.isProduction;
      const sources = await this.dbAdapter.query(
        isSqlite
          ? 'SELECT * FROM ical_sources WHERE active = 1'
          : 'SELECT * FROM ical_sources WHERE active = true'
      );

      if (!sources || sources.length === 0) {
        console.log('ℹ️  No active sources to sync');
        return;
      }

      console.log(`📋 Found ${sources.length} active source(s)\n`);

      const results = [];
      for (const source of sources) {
        const result = await this.syncSource(source);
        results.push(result);
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('\n📊 ====== Sync Summary ======');
      console.log(`✅ Successful: ${successful}/${sources.length}`);
      console.log(`❌ Failed: ${failed}/${sources.length}`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log('============================\n');

    } catch (error) {
      console.error('❌ Fatal sync error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start cron job
   */
  startCronJob() {
    console.log('🚀 Starting iCal Sync Cron Job');
    console.log(`⏰ Schedule: ${this.syncInterval} (every 2 hours)`);

    // Run immediately on start
    this.syncAll();

    // Schedule recurring sync
    this.cronTask = cron.schedule(this.syncInterval, () => {
      this.syncAll();
    });

    console.log('✅ Cron job scheduled successfully');
  }

  /**
   * Stop cron job
   */
  stopCronJob() {
    if (this.cronTask) {
      this.cronTask.stop();
      console.log('⏹️  iCal Sync Cron Job stopped');
    }
  }
}

// Standalone execution
if (require.main === module) {
  const syncCron = new ICalSyncCron();
  syncCron.startCronJob();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    syncCron.stopCronJob();
    process.exit(0);
  });
}

module.exports = ICalSyncCron;
