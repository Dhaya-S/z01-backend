/**
 * migrate-new-onboarding.js
 * Run with: node migrate-new-onboarding.js
 * Adds all new columns needed for the 7-step onboarding flow.
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔌 Connected to Neon PostgreSQL...');

    // ── vendors table ─────────────────────────────────────────────────────────
    await client.query(`
      ALTER TABLE vendors
        ADD COLUMN IF NOT EXISTS service_types   TEXT[],
        ADD COLUMN IF NOT EXISTS bio             TEXT,
        ADD COLUMN IF NOT EXISTS profile_photo   VARCHAR(500),
        ADD COLUMN IF NOT EXISTS location        JSONB,
        ADD COLUMN IF NOT EXISTS user_type       VARCHAR(50) DEFAULT 'vendor';
    `);
    console.log('✅ vendors: service_types, bio, profile_photo, location, user_type added');

    // ── vendor_documents table ─────────────────────────────────────────────────
    // Add new columns for the new VERIFY step (Gov ID, Selfie, Business doc)
    await client.query(`
      ALTER TABLE vendor_documents
        ADD COLUMN IF NOT EXISTS government_id        VARCHAR(500),
        ADD COLUMN IF NOT EXISTS selfie               VARCHAR(500),
        ADD COLUMN IF NOT EXISTS business_registration VARCHAR(500);
    `);
    console.log('✅ vendor_documents: government_id, selfie, business_registration added');

    // ── vendor_bank_details table ──────────────────────────────────────────────
    await client.query(`
      ALTER TABLE vendor_bank_details
        ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100);
    `);
    console.log('✅ vendor_bank_details: upi_id added');

    // ── users table ────────────────────────────────────────────────────────────
    // Ensure user_type column exists
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT 'customer';
    `);
    console.log('✅ users: user_type column ensured');

    console.log('\n🎉 Migration complete! All new columns are ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
