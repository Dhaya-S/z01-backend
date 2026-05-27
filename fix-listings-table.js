import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fixTable() {
  try {
    console.log('Dropping and re-creating vendor_listings table...');
    
    // Drop existing table to start fresh since it has wrong column types
    await pool.query('DROP TABLE IF EXISTS bookings CASCADE;');
    await pool.query('DROP TABLE IF EXISTS vendor_listings CASCADE;');
    
    // Re-create vendor_listings with correct schema
    await pool.query(`
      CREATE TABLE vendor_listings (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL, -- 'Studio', 'Equipment', 'Manpower'
        sub_category VARCHAR(255),
        listing_title VARCHAR(255) NOT NULL,
        short_description TEXT,
        area_sqft INTEGER,
        capacity INTEGER,
        amenities JSONB DEFAULT '[]',
        brand VARCHAR(255),
        model VARCHAR(255),
        specifications TEXT,
        quantity INTEGER DEFAULT 1,
        deposit_amount DECIMAL(10, 2),
        price_per_hour DECIMAL(10, 2),
        price_per_day DECIMAL(10, 2),
        minimum_booking_hours INTEGER DEFAULT 1,
        cancellation_policy VARCHAR(50) DEFAULT 'flexible',
        opening_time TIME,
        closing_time TIME,
        location_address TEXT,
        delivery_available BOOLEAN DEFAULT FALSE,
        id_verification_required BOOLEAN DEFAULT FALSE,
        min_age INTEGER DEFAULT 18,
        insurance_required BOOLEAN DEFAULT FALSE,
        rules TEXT,
        terms_pdf_url VARCHAR(255),
        image_1 VARCHAR(255),
        image_2 VARCHAR(255),
        image_3 VARCHAR(255),
        image_4 VARCHAR(255),
        image_5 VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('vendor_listings table created.');

    // Re-create bookings table
    await pool.query(`
      CREATE TABLE bookings (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        listing_id INTEGER REFERENCES vendor_listings(id),
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        total_amount DECIMAL(10, 2),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('bookings table created.');

    console.log('Database fix complete.');
    process.exit(0);
  } catch (error) {
    console.error('Fix failed:', error);
    process.exit(1);
  }
}

fixTable();
