require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_issues (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id),
        vendor_id INTEGER REFERENCES vendors(id),
        issue_description TEXT,
        proof_urls JSONB,
        status VARCHAR(50) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ booking_issues table created (or already exists).');
    
    await pool.query('CREATE INDEX IF NOT EXISTS idx_booking_issues_booking_id ON booking_issues(booking_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_booking_issues_vendor_id ON booking_issues(vendor_id)');
    console.log('✅ booking_issues indexes created.');
  } catch (err) {
    console.error('Error creating booking_issues table:', err);
  } finally {
    pool.end();
  }
}

run();
