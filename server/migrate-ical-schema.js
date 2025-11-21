/**
 * Database Migration Script - iCal Sync Schema
 * Creates tables for OTA calendar synchronization
 *
 * Run: node server/migrate-ical-schema.js
 */

const DatabaseAdapter = require('./db-adapter');

async function migrateIcalSchema() {
  console.log('🔄 Starting iCal Sync schema migration...\n');

  const dbAdapter = new DatabaseAdapter();
  await dbAdapter.connect();

  const isSqlite = !dbAdapter.isProduction;

  try {
    // 1. Create ical_sources table
    console.log('📋 Creating table: ical_sources');
    if (isSqlite) {
      await dbAdapter.run(`
        CREATE TABLE IF NOT EXISTS ical_sources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(100) NOT NULL,
          source_type VARCHAR(50) NOT NULL,
          ical_url TEXT NOT NULL,
          room_id INTEGER,
          bed_id INTEGER,
          active INTEGER DEFAULT 1,
          last_sync_at TEXT,
          last_sync_status VARCHAR(20),
          last_sync_error TEXT,
          sync_interval_minutes INTEGER DEFAULT 120,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT,
          FOREIGN KEY (room_id) REFERENCES rooms(id),
          FOREIGN KEY (bed_id) REFERENCES beds(id)
        );
      `);
    } else {
      // PostgreSQL
      await dbAdapter.query(`
        CREATE TABLE IF NOT EXISTS ical_sources (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          source_type VARCHAR(50) NOT NULL,
          ical_url TEXT NOT NULL,
          room_id INTEGER REFERENCES rooms(id),
          bed_id INTEGER REFERENCES beds(id),
          active BOOLEAN DEFAULT true,
          last_sync_at TIMESTAMP,
          last_sync_status VARCHAR(20),
          last_sync_error TEXT,
          sync_interval_minutes INTEGER DEFAULT 120,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    console.log('✅ Table ical_sources created\n');

    // 2. Create external_reservations table
    console.log('📋 Creating table: external_reservations');
    if (isSqlite) {
      await dbAdapter.run(`
        CREATE TABLE IF NOT EXISTS external_reservations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          booking_id INTEGER,
          source_id INTEGER NOT NULL,
          external_id VARCHAR(255) NOT NULL,
          source_type VARCHAR(50) NOT NULL,
          guest_name VARCHAR(255),
          check_in TEXT NOT NULL,
          check_out TEXT NOT NULL,
          bed_id INTEGER,
          room_id INTEGER,
          status VARCHAR(20) DEFAULT 'confirmed',
          raw_ical_data TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT,
          FOREIGN KEY (booking_id) REFERENCES bookings(id),
          FOREIGN KEY (source_id) REFERENCES ical_sources(id),
          FOREIGN KEY (bed_id) REFERENCES beds(id),
          FOREIGN KEY (room_id) REFERENCES rooms(id),
          UNIQUE(source_id, external_id)
        );
      `);
    } else {
      // PostgreSQL
      await dbAdapter.query(`
        CREATE TABLE IF NOT EXISTS external_reservations (
          id SERIAL PRIMARY KEY,
          booking_id INTEGER REFERENCES bookings(id),
          source_id INTEGER REFERENCES ical_sources(id) NOT NULL,
          external_id VARCHAR(255) NOT NULL,
          source_type VARCHAR(50) NOT NULL,
          guest_name VARCHAR(255),
          check_in DATE NOT NULL,
          check_out DATE NOT NULL,
          bed_id INTEGER REFERENCES beds(id),
          room_id INTEGER REFERENCES rooms(id),
          status VARCHAR(20) DEFAULT 'confirmed',
          raw_ical_data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(source_id, external_id)
        );
      `);
    }
    console.log('✅ Table external_reservations created\n');

    // 3. Create sync_logs table
    console.log('📋 Creating table: sync_logs');
    if (isSqlite) {
      await dbAdapter.run(`
        CREATE TABLE IF NOT EXISTS sync_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id INTEGER NOT NULL,
          sync_started_at TEXT,
          sync_completed_at TEXT,
          status VARCHAR(20),
          events_processed INTEGER DEFAULT 0,
          events_created INTEGER DEFAULT 0,
          events_updated INTEGER DEFAULT 0,
          events_cancelled INTEGER DEFAULT 0,
          conflicts_detected INTEGER DEFAULT 0,
          error_message TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (source_id) REFERENCES ical_sources(id)
        );
      `);
    } else {
      // PostgreSQL
      await dbAdapter.query(`
        CREATE TABLE IF NOT EXISTS sync_logs (
          id SERIAL PRIMARY KEY,
          source_id INTEGER REFERENCES ical_sources(id) NOT NULL,
          sync_started_at TIMESTAMP,
          sync_completed_at TIMESTAMP,
          status VARCHAR(20),
          events_processed INTEGER DEFAULT 0,
          events_created INTEGER DEFAULT 0,
          events_updated INTEGER DEFAULT 0,
          events_cancelled INTEGER DEFAULT 0,
          conflicts_detected INTEGER DEFAULT 0,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    console.log('✅ Table sync_logs created\n');

    // 4. Create indexes for performance
    console.log('📋 Creating indexes...');
    await dbAdapter.run(`CREATE INDEX IF NOT EXISTS idx_ical_sources_active ON ical_sources(active);`);
    await dbAdapter.run(`CREATE INDEX IF NOT EXISTS idx_external_reservations_dates ON external_reservations(check_in, check_out);`);
    await dbAdapter.run(`CREATE INDEX IF NOT EXISTS idx_external_reservations_status ON external_reservations(status);`);
    await dbAdapter.run(`CREATE INDEX IF NOT EXISTS idx_sync_logs_source ON sync_logs(source_id);`);
    console.log('✅ Indexes created\n');

    // 5. Verify tables exist
    console.log('🔍 Verifying migration...');
    if (isSqlite) {
      const tables = await dbAdapter.query(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name IN ('ical_sources', 'external_reservations', 'sync_logs')
      `);
      console.log(`✅ Found ${tables.length}/3 tables:`, tables.map(t => t.name).join(', '));
    } else {
      const tables = await dbAdapter.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('ical_sources', 'external_reservations', 'sync_logs')
      `);
      console.log(`✅ Found ${tables.length}/3 tables:`, tables.map(t => t.table_name).join(', '));
    }

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log('  - ical_sources: Store OTA calendar feed URLs');
    console.log('  - external_reservations: Store reservations from OTAs');
    console.log('  - sync_logs: Track synchronization history');
    console.log('\n🚀 Ready to sync with Booking.com and Hostelworld!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // Exit process
    process.exit(0);
  }
}

// Run migration
migrateIcalSchema();
