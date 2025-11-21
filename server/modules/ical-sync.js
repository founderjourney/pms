/**
 * iCal Sync Module - OTA Calendar Integration
 * Handles bidirectional synchronization with Booking.com, Hostelworld, and other OTAs
 *
 * Features:
 * - Export iCal feeds (per room/bed)
 * - Import iCal from external sources
 * - Conflict detection
 * - Automatic synchronization
 */

const express = require('express');
const ical = require('ical-generator').default;
const icalParser = require('node-ical');
const moment = require('moment-timezone');
const https = require('https');
const http = require('http');

const router = express.Router();

/**
 * Helper: Get database adapter from request
 */
function getDb(req) {
  return req.app.locals.db;
}

/**
 * Helper: Get session info
 */
function getSessionInfo(req) {
  return req.sessionInfo || { user_id: null, username: 'system' };
}

/**
 * Helper: Log activity
 */
async function logActivity(db, action_type, description, sessionInfo, details = null) {
  const isSqlite = !db.isProduction;

  if (isSqlite) {
    await db.run(
      `INSERT INTO activity_log (action_type, module, description, user_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [action_type, 'ical_sync', description, sessionInfo?.user_id || null, details ? JSON.stringify(details) : null]
    );
  } else {
    await db.query(
      `INSERT INTO activity_log (action_type, module, description, user_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [action_type, 'ical_sync', description, sessionInfo?.user_id || null, details ? JSON.stringify(details) : null]
    );
  }
}

/**
 * Helper: Fetch URL content
 */
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ==================== EXPORT ENDPOINTS ====================

/**
 * GET /api/ical/rooms/:room_id.ics
 * Export iCal feed for specific room
 */
router.get('/rooms/:room_id.ics', async (req, res) => {
  const db = getDb(req);
  const { room_id } = req.params;

  try {
    // Get all beds in this room
    const beds = await db.query(
      'SELECT id FROM beds WHERE room = (SELECT room FROM beds WHERE id = ?)',
      [room_id]
    );

    if (!beds || beds.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const bedIds = beds.map(b => b.id);

    // Get all confirmed reservations for these beds
    const reservations = await db.query(
      `SELECT b.*, g.name as guest_name, g.email as guest_email, bd.name as bed_name
       FROM bookings b
       JOIN guests g ON b.guest_id = g.id
       JOIN beds bd ON b.bed_id = bd.id
       WHERE b.bed_id IN (${bedIds.join(',')})
       AND b.status IN ('confirmed', 'checked_in')
       AND b.check_out >= date('now')
       ORDER BY b.check_in`
    );

    // Create iCal calendar
    const calendar = ical({
      name: `Room ${room_id} - Almanik Hostel`,
      timezone: 'America/Bogota',
      prodId: '//Almanik PMS//iCal Sync//EN'
    });

    // Add each reservation as event
    for (const booking of reservations) {
      calendar.createEvent({
        start: moment(booking.check_in).tz('America/Bogota').startOf('day'),
        end: moment(booking.check_out).tz('America/Bogota').startOf('day'),
        summary: `${booking.guest_name} - ${booking.bed_name}`,
        description: `Booking #${booking.id}\nConfirmation: ${booking.confirmation_code || 'N/A'}\nGuest: ${booking.guest_name}\nBed: ${booking.bed_name}\nNights: ${booking.nights}\nTotal: $${booking.total}`,
        uid: `booking-${booking.id}@almanik-pms.com`,
        status: booking.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE',
        busyStatus: 'BUSY',
        organizer: {
          name: 'Almanik Hostel',
          email: booking.guest_email || 'info@almanik.com'
        }
      });
    }

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="room-${room_id}.ics"`);
    res.send(calendar.toString());

  } catch (error) {
    console.error('Error generating iCal:', error);
    res.status(500).json({ error: 'Failed to generate calendar', details: error.message });
  }
});

/**
 * GET /api/ical/beds/:bed_id.ics
 * Export iCal feed for specific bed
 */
router.get('/beds/:bed_id.ics', async (req, res) => {
  const db = getDb(req);
  const { bed_id } = req.params;

  try {
    // Verify bed exists
    const bed = await db.get('SELECT * FROM beds WHERE id = ?', [bed_id]);
    if (!bed) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    // Get all confirmed reservations for this bed
    const reservations = await db.query(
      `SELECT b.*, g.name as guest_name, g.email as guest_email
       FROM bookings b
       JOIN guests g ON b.guest_id = g.id
       WHERE b.bed_id = ?
       AND b.status IN ('confirmed', 'checked_in')
       AND b.check_out >= date('now')
       ORDER BY b.check_in`,
      [bed_id]
    );

    // Create iCal calendar
    const calendar = ical({
      name: `${bed.name} - Almanik Hostel`,
      timezone: 'America/Bogota',
      prodId: '//Almanik PMS//iCal Sync//EN'
    });

    // Add each reservation as event
    for (const booking of reservations) {
      calendar.createEvent({
        start: moment(booking.check_in).tz('America/Bogota').startOf('day'),
        end: moment(booking.check_out).tz('America/Bogota').startOf('day'),
        summary: `Reservado - ${booking.guest_name}`,
        description: `Booking #${booking.id}\nConfirmation: ${booking.confirmation_code || 'N/A'}\nGuest: ${booking.guest_name}\nNights: ${booking.nights}\nTotal: $${booking.total}`,
        uid: `booking-${booking.id}@almanik-pms.com`,
        status: booking.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE',
        busyStatus: 'BUSY'
      });
    }

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="bed-${bed.name}.ics"`);
    res.send(calendar.toString());

  } catch (error) {
    console.error('Error generating iCal:', error);
    res.status(500).json({ error: 'Failed to generate calendar', details: error.message });
  }
});

/**
 * GET /api/ical/all-rooms.ics
 * Export consolidated iCal feed for all rooms
 */
router.get('/all-rooms.ics', async (req, res) => {
  const db = getDb(req);

  try {
    // Get all confirmed reservations
    const reservations = await db.query(
      `SELECT b.*, g.name as guest_name, g.email as guest_email, bd.name as bed_name
       FROM bookings b
       JOIN guests g ON b.guest_id = g.id
       JOIN beds bd ON b.bed_id = bd.id
       WHERE b.status IN ('confirmed', 'checked_in')
       AND b.check_out >= date('now')
       ORDER BY b.check_in`
    );

    // Create iCal calendar
    const calendar = ical({
      name: 'All Rooms - Almanik Hostel',
      timezone: 'America/Bogota',
      prodId: '//Almanik PMS//iCal Sync//EN'
    });

    // Add each reservation as event
    for (const booking of reservations) {
      calendar.createEvent({
        start: moment(booking.check_in).tz('America/Bogota').startOf('day'),
        end: moment(booking.check_out).tz('America/Bogota').startOf('day'),
        summary: `${booking.guest_name} - ${booking.bed_name}`,
        description: `Booking #${booking.id}\nConfirmation: ${booking.confirmation_code || 'N/A'}\nGuest: ${booking.guest_name}\nBed: ${booking.bed_name}\nNights: ${booking.nights}\nTotal: $${booking.total}`,
        uid: `booking-${booking.id}@almanik-pms.com`,
        status: booking.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE',
        busyStatus: 'BUSY'
      });
    }

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="all-rooms.ics"');
    res.send(calendar.toString());

  } catch (error) {
    console.error('Error generating iCal:', error);
    res.status(500).json({ error: 'Failed to generate calendar', details: error.message });
  }
});

// ==================== IMPORT / SYNC MANAGEMENT ====================

/**
 * POST /api/ical/sources
 * Register a new iCal source (OTA feed)
 */
router.post('/sources', async (req, res) => {
  const db = getDb(req);
  const sessionInfo = getSessionInfo(req);
  const { name, source_type, ical_url, room_id, bed_id, sync_interval_minutes } = req.body;

  // Validation
  if (!name || !source_type || !ical_url) {
    return res.status(400).json({ error: 'Missing required fields: name, source_type, ical_url' });
  }

  try {
    const isSqlite = !db.isProduction;

    if (isSqlite) {
      const result = await db.run(
        `INSERT INTO ical_sources (name, source_type, ical_url, room_id, bed_id, sync_interval_minutes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, source_type, ical_url, room_id || null, bed_id || null, sync_interval_minutes || 120]
      );

      const source = await db.get('SELECT * FROM ical_sources WHERE id = ?', [result.id]);

      await logActivity(db, 'create', `iCal source added: ${name} (${source_type})`, sessionInfo, { source_id: result.id });

      res.json({ success: true, source });
    } else {
      const result = await db.query(
        `INSERT INTO ical_sources (name, source_type, ical_url, room_id, bed_id, sync_interval_minutes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, source_type, ical_url, room_id || null, bed_id || null, sync_interval_minutes || 120]
      );

      await logActivity(db, 'create', `iCal source added: ${name} (${source_type})`, sessionInfo, { source_id: result[0].id });

      res.json({ success: true, source: result[0] });
    }

  } catch (error) {
    console.error('Error creating iCal source:', error);
    res.status(500).json({ error: 'Failed to create iCal source', details: error.message });
  }
});

/**
 * GET /api/ical/sources
 * List all iCal sources
 */
router.get('/sources', async (req, res) => {
  const db = getDb(req);

  try {
    const sources = await db.query('SELECT * FROM ical_sources ORDER BY created_at DESC');
    res.json({ sources });
  } catch (error) {
    console.error('Error fetching iCal sources:', error);
    res.status(500).json({ error: 'Failed to fetch sources', details: error.message });
  }
});

/**
 * GET /api/ical/sources/:id
 * Get specific iCal source with stats
 */
router.get('/sources/:id', async (req, res) => {
  const db = getDb(req);
  const { id } = req.params;

  try {
    const source = await db.get('SELECT * FROM ical_sources WHERE id = ?', [id]);

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Get recent sync logs
    const logs = await db.query(
      'SELECT * FROM sync_logs WHERE source_id = ? ORDER BY created_at DESC LIMIT 10',
      [id]
    );

    // Get external reservations count
    const reservations = await db.query(
      'SELECT COUNT(*) as count FROM external_reservations WHERE source_id = ? AND status = ?',
      [id, 'confirmed']
    );

    res.json({
      source,
      stats: {
        total_reservations: reservations[0]?.count || 0,
        recent_syncs: logs
      }
    });

  } catch (error) {
    console.error('Error fetching source:', error);
    res.status(500).json({ error: 'Failed to fetch source', details: error.message });
  }
});

/**
 * DELETE /api/ical/sources/:id
 * Remove iCal source
 */
router.delete('/sources/:id', async (req, res) => {
  const db = getDb(req);
  const sessionInfo = getSessionInfo(req);
  const { id } = req.params;

  try {
    const source = await db.get('SELECT * FROM ical_sources WHERE id = ?', [id]);

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    await db.run('DELETE FROM ical_sources WHERE id = ?', [id]);
    await logActivity(db, 'delete', `iCal source removed: ${source.name}`, sessionInfo, { source_id: id });

    res.json({ success: true, message: 'Source removed' });

  } catch (error) {
    console.error('Error deleting source:', error);
    res.status(500).json({ error: 'Failed to delete source', details: error.message });
  }
});

/**
 * PUT /api/ical/sources/:id
 * Update iCal source
 */
router.put('/sources/:id', async (req, res) => {
  const db = getDb(req);
  const sessionInfo = getSessionInfo(req);
  const { id } = req.params;
  const { name, ical_url, active, sync_interval_minutes } = req.body;

  try {
    const source = await db.get('SELECT * FROM ical_sources WHERE id = ?', [id]);

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    const isSqlite = !db.isProduction;

    if (isSqlite) {
      await db.run(
        `UPDATE ical_sources
         SET name = ?, ical_url = ?, active = ?, sync_interval_minutes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name || source.name, ical_url || source.ical_url,
         active !== undefined ? (active ? 1 : 0) : source.active,
         sync_interval_minutes || source.sync_interval_minutes, id]
      );
    } else {
      await db.query(
        `UPDATE ical_sources
         SET name = $1, ical_url = $2, active = $3, sync_interval_minutes = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [name || source.name, ical_url || source.ical_url,
         active !== undefined ? active : source.active,
         sync_interval_minutes || source.sync_interval_minutes, id]
      );
    }

    const updated = await db.get('SELECT * FROM ical_sources WHERE id = ?', [id]);
    await logActivity(db, 'update', `iCal source updated: ${updated.name}`, sessionInfo, { source_id: id });

    res.json({ success: true, source: updated });

  } catch (error) {
    console.error('Error updating source:', error);
    res.status(500).json({ error: 'Failed to update source', details: error.message });
  }
});

// ==================== SYNC OPERATIONS ====================

/**
 * POST /api/ical/sync/:source_id
 * Manually trigger sync for specific source
 */
router.post('/sync/:source_id', async (req, res) => {
  const db = getDb(req);
  const sessionInfo = getSessionInfo(req);
  const { source_id } = req.params;

  try {
    const result = await syncSource(db, source_id, sessionInfo);
    res.json(result);
  } catch (error) {
    console.error('Error syncing source:', error);
    res.status(500).json({ error: 'Sync failed', details: error.message });
  }
});

/**
 * POST /api/ical/sync-all
 * Sync all active sources
 */
router.post('/sync-all', async (req, res) => {
  const db = getDb(req);
  const sessionInfo = getSessionInfo(req);

  try {
    const sources = await db.query('SELECT * FROM ical_sources WHERE active = ?', [true]);

    const results = [];
    for (const source of sources) {
      try {
        const result = await syncSource(db, source.id, sessionInfo);
        results.push({ source_id: source.id, success: true, ...result });
      } catch (error) {
        results.push({ source_id: source.id, success: false, error: error.message });
      }
    }

    res.json({ success: true, results });

  } catch (error) {
    console.error('Error syncing all sources:', error);
    res.status(500).json({ error: 'Sync failed', details: error.message });
  }
});

/**
 * Sync logic for a single source
 */
async function syncSource(db, source_id, sessionInfo) {
  const isSqlite = !db.isProduction;

  // Get source
  const source = await db.get('SELECT * FROM ical_sources WHERE id = ?', [source_id]);
  if (!source) {
    throw new Error('Source not found');
  }

  const syncStarted = new Date().toISOString();
  const stats = {
    processed: 0,
    created: 0,
    updated: 0,
    cancelled: 0,
    conflicts: 0
  };

  try {
    // Fetch iCal feed
    console.log(`🔄 Fetching iCal from: ${source.ical_url}`);
    const icalData = await fetchURL(source.ical_url);

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
      const existing = await db.get(
        'SELECT * FROM external_reservations WHERE source_id = ? AND external_id = ?',
        [source_id, externalId]
      );

      if (existing) {
        // Update existing
        if (existing.status !== status || existing.check_in !== checkIn || existing.check_out !== checkOut) {
          await db.run(
            `UPDATE external_reservations
             SET guest_name = ?, check_in = ?, check_out = ?, status = ?, raw_ical_data = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [guestName, checkIn, checkOut, status, JSON.stringify(event), existing.id]
          );
          stats.updated++;

          if (status === 'cancelled') {
            stats.cancelled++;
          }
        }
      } else {
        // Create new reservation
        // Check for conflicts
        const conflicts = await checkConflicts(db, source.bed_id, source.room_id, checkIn, checkOut);
        if (conflicts.length > 0) {
          console.warn(`⚠️  Conflict detected for ${guestName} (${checkIn} to ${checkOut})`);
          stats.conflicts++;
          // Still create but flag for review
        }

        if (isSqlite) {
          await db.run(
            `INSERT INTO external_reservations
             (source_id, external_id, source_type, guest_name, check_in, check_out, bed_id, room_id, status, raw_ical_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [source_id, externalId, source.source_type, guestName, checkIn, checkOut,
             source.bed_id, source.room_id, status, JSON.stringify(event)]
          );
        } else {
          await db.query(
            `INSERT INTO external_reservations
             (source_id, external_id, source_type, guest_name, check_in, check_out, bed_id, room_id, status, raw_ical_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [source_id, externalId, source.source_type, guestName, checkIn, checkOut,
             source.bed_id, source.room_id, status, JSON.stringify(event)]
          );
        }

        stats.created++;
      }
    }

    // Update source last_sync
    await db.run(
      `UPDATE ical_sources
       SET last_sync_at = CURRENT_TIMESTAMP, last_sync_status = ?, last_sync_error = NULL
       WHERE id = ?`,
      ['success', source_id]
    );

    // Log sync
    const syncCompleted = new Date().toISOString();
    if (isSqlite) {
      await db.run(
        `INSERT INTO sync_logs
         (source_id, sync_started_at, sync_completed_at, status, events_processed, events_created, events_updated, events_cancelled, conflicts_detected)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [source_id, syncStarted, syncCompleted, 'success', stats.processed, stats.created, stats.updated, stats.cancelled, stats.conflicts]
      );
    } else {
      await db.query(
        `INSERT INTO sync_logs
         (source_id, sync_started_at, sync_completed_at, status, events_processed, events_created, events_updated, events_cancelled, conflicts_detected)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [source_id, syncStarted, syncCompleted, 'success', stats.processed, stats.created, stats.updated, stats.cancelled, stats.conflicts]
      );
    }

    await logActivity(db, 'sync', `iCal synced: ${source.name} (${stats.created} new, ${stats.updated} updated)`, sessionInfo, stats);

    return { success: true, stats, source: source.name };

  } catch (error) {
    // Update source with error
    await db.run(
      `UPDATE ical_sources
       SET last_sync_status = ?, last_sync_error = ?
       WHERE id = ?`,
      ['error', error.message, source_id]
    );

    // Log failed sync
    const syncCompleted = new Date().toISOString();
    const isSqlite = !db.isProduction;
    if (isSqlite) {
      await db.run(
        `INSERT INTO sync_logs
         (source_id, sync_started_at, sync_completed_at, status, error_message)
         VALUES (?, ?, ?, ?, ?)`,
        [source_id, syncStarted, syncCompleted, 'error', error.message]
      );
    } else {
      await db.query(
        `INSERT INTO sync_logs
         (source_id, sync_started_at, sync_completed_at, status, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [source_id, syncStarted, syncCompleted, 'error', error.message]
      );
    }

    throw error;
  }
}

/**
 * Check for booking conflicts
 */
async function checkConflicts(db, bed_id, room_id, checkIn, checkOut) {
  const conflicts = [];

  // Check internal bookings
  const internalBookings = await db.query(
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
  const externalBookings = await db.query(
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
 * GET /api/ical/external-reservations
 * List all external reservations
 */
router.get('/external-reservations', async (req, res) => {
  const db = getDb(req);
  const { status, source_id } = req.query;

  try {
    let query = 'SELECT * FROM external_reservations WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (source_id) {
      query += ' AND source_id = ?';
      params.push(source_id);
    }

    query += ' ORDER BY check_in DESC';

    const reservations = await db.query(query, params);
    res.json({ reservations });

  } catch (error) {
    console.error('Error fetching external reservations:', error);
    res.status(500).json({ error: 'Failed to fetch reservations', details: error.message });
  }
});

module.exports = router;
