const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addReplyColumn() {
  try {
    console.log('Adding vendor_reply column to reviews table...');
    await pool.query(`
      ALTER TABLE reviews
      ADD COLUMN IF NOT EXISTS vendor_reply TEXT;
    `);
    console.log('✅ vendor_reply column added successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add column:', error);
    process.exit(1);
  }
}

addReplyColumn();
