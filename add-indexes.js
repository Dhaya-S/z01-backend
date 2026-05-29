const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addIndexes() {
  try {
    console.log('Connecting to database...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_vendor_listings_vendor_id ON vendor_listings (vendor_id)',
      'CREATE INDEX IF NOT EXISTS idx_vendor_listings_category ON vendor_listings (category)',
      'CREATE INDEX IF NOT EXISTS idx_vendor_listings_vendor_category ON vendor_listings (vendor_id, category)',
      'CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_bookings_listing_id ON bookings (listing_id)',
      'CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor_id ON vendor_documents (vendor_id)',
      'CREATE INDEX IF NOT EXISTS idx_vendor_bank_details_vendor_id ON vendor_bank_details (vendor_id)',
    ];

    for (const idx of indexes) {
      await pool.query(idx);
      const name = idx.match(/idx_\w+/)?.[0] || idx;
      console.log(`✓ ${name}`);
    }

    console.log('\n✅ All performance indexes applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

addIndexes();
