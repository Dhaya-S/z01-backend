require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkLocations() {
  const { rows } = await pool.query('SELECT company_name, location FROM vendors ORDER BY id DESC LIMIT 5');
  console.log("Recent Vendors Location Data:");
  console.log(JSON.stringify(rows, null, 2));
  pool.end();
}

checkLocations();
