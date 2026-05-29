const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function deepDiagnose() {
  try {
    console.log('=== VENDOR ID 18 ===');
    const v18 = await pool.query('SELECT * FROM vendors WHERE id = 18');
    console.log(JSON.stringify(v18.rows[0], null, 2));

    console.log('\n=== ROUTE CONFLICT TEST ===');
    console.log('When Flutter calls GET /bookings/vendor/18:');
    console.log('  NestJS route :userId = "vendor" (WRONG) — swallows the request!');
    console.log('  GET vendor/:vendorId NEVER gets reached because :userId matches first.');
    console.log('  This is the PRIMARY bug causing bookings to not appear.');

    console.log('\n=== WHAT findByUser("vendor") WOULD RETURN ===');
    const bad = await pool.query(`
      SELECT b.*, vl.listing_title as item_name
      FROM bookings b
      LEFT JOIN vendor_listings vl ON b.listing_id = vl.id
      WHERE b.user_id = 'vendor'
    `);
    console.log(` Rows returned: ${bad.rows.length} (expected 0 — "vendor" is not a real user_id)`);

    console.log('\n=== CORRECT QUERY: Bookings for vendor_id=18 ===');
    const correct = await pool.query(`
      SELECT b.id, b.listing_id, b.status, vl.listing_title, vl.vendor_id
      FROM bookings b
      JOIN vendor_listings vl ON b.listing_id = vl.id
      WHERE vl.vendor_id = 18
    `);
    console.log(` Rows: ${correct.rows.length}`);
    correct.rows.forEach(r => console.log('  ', JSON.stringify(r)));

    console.log('\n=== DASHBOARD ENDPOINT: Bookings for user_id of vendor 18 ===');
    const v18user = await pool.query('SELECT user_id FROM vendors WHERE id = 18');
    const userId18 = v18user.rows[0]?.user_id;
    console.log(` vendor 18 user_id: ${userId18}`);

    const dashboardBookings = await pool.query(`
      SELECT b.id, b.status, vl.listing_title
      FROM bookings b
      JOIN vendor_listings vl ON b.listing_id = vl.id
      WHERE vl.vendor_id = (SELECT id FROM vendors WHERE user_id = $1)
    `, [userId18]);
    console.log(` Dashboard query rows: ${dashboardBookings.rows.length}`);
    dashboardBookings.rows.forEach(r => console.log('  ', JSON.stringify(r)));

    process.exit(0);
  } catch (error) {
    console.error('Deep diagnose failed:', error.message);
    process.exit(1);
  }
}

deepDiagnose();
