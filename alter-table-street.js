import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addStreetAddress() {
  try {
    await pool.query(`ALTER TABLE vendor_listings ADD COLUMN IF NOT EXISTS street_address TEXT;`);
    console.log('street_address column added successfully.');
  } catch (error) {
    console.error('Error adding column:', error);
  } finally {
    pool.end();
  }
}

addStreetAddress();
