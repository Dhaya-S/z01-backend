const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

async function checkListings() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const res = await pool.query(`SELECT category, COUNT(*) FROM vendor_listings GROUP BY category;`);
    console.log("Listings by Category:");
    console.table(res.rows);

    const res2 = await pool.query(`SELECT id, vendor_id, category, listing_title, status FROM vendor_listings ORDER BY created_at DESC LIMIT 5;`);
    console.log("Recent Listings:");
    console.table(res2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkListings();
