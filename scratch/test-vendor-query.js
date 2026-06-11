const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testQuery() {
  try {
    const vendorId = 18; // Using an example vendor ID from the database
    console.log('Testing query on vendors table...');
    const vendorRes = await pool.query('SELECT name, email, phone FROM vendors WHERE id = $1', [vendorId]);
    console.log('Result:', vendorRes.rows);
  } catch (error) {
    console.error('Error during query:', error.message);
  } finally {
    await pool.end();
  }
}

testQuery();
