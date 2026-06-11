const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runTest() {
  try {
    // 1. Get an active listing ID to test with
    const listingsRes = await pool.query("SELECT id, vendor_id, category, status FROM vendor_listings WHERE status = 'active' LIMIT 1");
    if (listingsRes.rows.length === 0) {
      console.log('No active listings found in database to test.');
      return;
    }
    const listing = listingsRes.rows[0];
    console.log(`Using listing ID ${listing.id} (Category: ${listing.category}, Status: ${listing.status})`);

    const todayStr = new Date().toISOString().split('T')[0];

    // 2. Insert a temporary availability block for this listing today
    console.log(`Inserting temporary availability block for listing ${listing.id} on date ${todayStr}...`);
    const blockRes = await pool.query(
      `INSERT INTO vendor_availability_blocks (vendor_id, category, start_date, end_date, reason, listing_id, units)
       VALUES ($1, $2, $3, $4, 'Temporary Test Block', $5, 1) RETURNING id`,
      [listing.vendor_id, listing.category, `${todayStr} 00:00:00`, `${todayStr} 23:59:59`, listing.id]
    );
    const blockId = blockRes.rows[0].id;
    console.log(`Block inserted with ID ${blockId}`);

    // 3. Query the listing for today
    console.log(`Querying listing status for today (${todayStr})...`);
    const query = `
      SELECT vl.id, vl.listing_title,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM vendor_availability_blocks vab
          WHERE vab.vendor_id = vl.vendor_id 
            AND vab.category = vl.category 
            AND (vab.listing_id IS NULL OR vab.listing_id = vl.id)
            AND $2::DATE BETWEEN vab.start_date::DATE AND vab.end_date::DATE
        ) THEN 'paused'
        ELSE vl.status
      END as status
      FROM vendor_listings vl 
      WHERE vl.id = $1
    `;
    const checkRes = await pool.query(query, [listing.id, todayStr]);
    const statusToday = checkRes.rows[0].status;
    console.log(`Listing status returned for today: '${statusToday}'`);

    // 4. Query the listing for tomorrow (should not be paused)
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    console.log(`Querying listing status for tomorrow (${tomorrowStr})...`);
    const checkResTomorrow = await pool.query(query, [listing.id, tomorrowStr]);
    const statusTomorrow = checkResTomorrow.rows[0].status;
    console.log(`Listing status returned for tomorrow: '${statusTomorrow}'`);

    // 5. Clean up the block
    console.log('Cleaning up temporary block...');
    await pool.query('DELETE FROM vendor_availability_blocks WHERE id = $1', [blockId]);
    console.log('Cleanup successful!');

    // 6. Assertions
    if (statusToday === 'paused' && statusTomorrow === 'active') {
      console.log('✅ Success: Listing status is correctly paused on the blocked date and active on other dates!');
    } else {
      console.log('❌ Error: Status logic check failed.');
    }

  } catch (err) {
    console.error('Test run failed:', err);
  } finally {
    await pool.end();
  }
}

runTest();
