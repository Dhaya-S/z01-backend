import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function inspectListings() {
  try {
    const { rows } = await pool.query('SELECT id, category, listing_title, pricing_type, travel_available, experience_years, skills FROM vendor_listings WHERE category = \'Manpower\'');
    console.log('Manpower Listings:');
    console.table(rows);
    
    const { rows: allRows } = await pool.query('SELECT COUNT(*) as total FROM vendor_listings');
    console.log('Total listings:', allRows[0].total);
    
  } catch (err) {
    console.error('Error inspecting database:', err);
  } finally {
    await pool.end();
  }
}

inspectListings();
