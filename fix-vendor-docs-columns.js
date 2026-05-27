/**
 * fix-vendor-docs-columns.js
 * ─────────────────────────
 * Adds the three new Step-4 document columns to vendor_documents if they don't exist.
 * Safe to re-run (uses ADD COLUMN IF NOT EXISTS).
 *
 * Run with:  node fix-vendor-docs-columns.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fixColumns() {
  const client = await pool.connect();
  try {
    console.log('🔌 Connecting to Neon PostgreSQL...');

    // 1. Add missing doc columns
    await client.query(`
      ALTER TABLE vendor_documents
        ADD COLUMN IF NOT EXISTS government_id         VARCHAR(500),
        ADD COLUMN IF NOT EXISTS selfie                VARCHAR(500),
        ADD COLUMN IF NOT EXISTS business_registration  VARCHAR(500);
    `);
    console.log('✅ vendor_documents: government_id, selfie, business_registration ensured.');

    // 2. Verify columns are now present
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'vendor_documents'
      ORDER BY ordinal_position;
    `);
    console.log('\n📋 Current vendor_documents columns:');
    rows.forEach(r => console.log(`   • ${r.column_name} (${r.data_type})`));

    console.log('\n🎉 Done! Neon DB is ready for gov_id, selfie and business_registration.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixColumns();
