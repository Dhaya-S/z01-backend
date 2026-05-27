require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const email = process.argv[2];

if (!email) {
  console.log('Please provide a vendor email: node approve-vendor.js vendor@example.com');
  process.exit(1);
}

async function approveVendor() {
  try {
    const { rows } = await pool.query(
      "UPDATE vendors SET verification_status = 'Approved', onboarding_status = 'Completed' WHERE email = $1 RETURNING *",
      [email]
    );

    if (rows.length === 0) {
      console.log(`Vendor with email ${email} not found.`);
    } else {
      console.log(`Successfully approved vendor: ${email}`);
      console.log(rows[0]);
    }
  } catch (error) {
    console.error('Error approving vendor:', error);
  } finally {
    await pool.end();
  }
}

approveVendor();
