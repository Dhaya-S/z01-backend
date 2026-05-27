import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkData() {
  try {
    const { rows: vendors } = await pool.query('SELECT id, user_id FROM vendors LIMIT 1');
    console.log('Vendor sample:', vendors);
    
    const { rows: listings } = await pool.query('SELECT id, vendor_id FROM vendor_listings LIMIT 1');
    console.log('Listing sample:', listings);
    
    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

checkData();
