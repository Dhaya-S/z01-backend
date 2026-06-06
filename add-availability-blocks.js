const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addAvailabilityBlocksTable() {
  try {
    console.log('Connecting to database to add vendor_availability_blocks table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_availability_blocks (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL, -- Studio, Equipment, Manpower
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query('CREATE INDEX IF NOT EXISTS idx_avail_blocks_vendor_id ON vendor_availability_blocks (vendor_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_avail_blocks_category ON vendor_availability_blocks (category);');

    console.log('Successfully created vendor_availability_blocks table and indexes.');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    await pool.end();
  }
}

addAvailabilityBlocksTable();
