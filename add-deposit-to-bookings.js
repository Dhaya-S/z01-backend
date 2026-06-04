import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  try {
    console.log('Running deposit migration...');

    // 1. Add deposit_amount column to bookings if not exists
    await pool.query(`
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2) DEFAULT 0;
    `);
    console.log('✅ bookings.deposit_amount column added.');

    // 2. Add deposit_status column to bookings if not exists
    //    Values: 'held' | 'released_to_vendor' | 'refunded_to_user'
    await pool.query(`
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(50) DEFAULT 'held';
    `);
    console.log('✅ bookings.deposit_status column added.');

    // 3. Create vendor_earnings table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_earnings (
        id           SERIAL PRIMARY KEY,
        vendor_id    INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
        booking_id   INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        amount       DECIMAL(10, 2) NOT NULL,
        type         VARCHAR(50) NOT NULL,   -- 'booking_payment' | 'deposit'
        status       VARCHAR(50) DEFAULT 'pending',  -- 'pending' | 'settled'
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ vendor_earnings table created (or already exists).');

    // 4. Index for fast vendor lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_earnings_vendor_id ON vendor_earnings (vendor_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_earnings_booking_id ON vendor_earnings (booking_id);
    `);
    console.log('✅ vendor_earnings indexes created.');

    console.log('\n🎉 Deposit migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
