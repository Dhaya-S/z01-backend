import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log('Adding delivery_proof_urls column to bookings table...');
    await pool.query('ALTER TABLE bookings ADD COLUMN delivery_proof_urls TEXT;');
    console.log('Column added successfully.');
    process.exit(0);
  } catch (err) {
    if (err.code === '42701') {
      console.log('Column already exists.');
    } else {
      console.error('Failed to add column:', err);
    }
    process.exit(1);
  }
}

run();
