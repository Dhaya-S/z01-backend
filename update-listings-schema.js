import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function updateSchema() {
  try {
    console.log('Updating vendor_listings schema...');
    
    await pool.query(`
      ALTER TABLE vendor_listings 
      RENAME COLUMN name TO listing_title;
      
      ALTER TABLE vendor_listings 
      RENAME COLUMN description TO short_description;
      
      ALTER TABLE vendor_listings 
      RENAME COLUMN price TO price_per_hour;
      
      ALTER TABLE vendor_listings 
      RENAME COLUMN image_url TO image_1;

      ALTER TABLE vendor_listings 
      ADD COLUMN IF NOT EXISTS sub_category VARCHAR(255),
      ADD COLUMN IF NOT EXISTS area_sqft INTEGER,
      ADD COLUMN IF NOT EXISTS capacity INTEGER,
      ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS brand VARCHAR(255),
      ADD COLUMN IF NOT EXISTS model VARCHAR(255),
      ADD COLUMN IF NOT EXISTS specifications TEXT,
      ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS price_per_day DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS minimum_booking_hours INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cancellation_policy VARCHAR(50) DEFAULT 'flexible',
      ADD COLUMN IF NOT EXISTS opening_time TIME,
      ADD COLUMN IF NOT EXISTS closing_time TIME,
      ADD COLUMN IF NOT EXISTS location_address TEXT,
      ADD COLUMN IF NOT EXISTS delivery_available BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS id_verification_required BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS min_age INTEGER DEFAULT 18,
      ADD COLUMN IF NOT EXISTS insurance_required BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS rules TEXT,
      ADD COLUMN IF NOT EXISTS terms_pdf_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS image_2 VARCHAR(255),
      ADD COLUMN IF NOT EXISTS image_3 VARCHAR(255),
      ADD COLUMN IF NOT EXISTS image_4 VARCHAR(255),
      ADD COLUMN IF NOT EXISTS image_5 VARCHAR(255);
    `);

    console.log('vendor_listings table updated successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Schema update failed:', error);
    process.exit(1);
  }
}

updateSchema();
