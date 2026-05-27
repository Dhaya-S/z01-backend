import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  try {
    console.log('Connecting to database...');
    
    // Ensure UUID extension exists
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('UUID extension ensured.');

    // Create Users table (if not exists, with UUID)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table ensured.');

    // Create Vendors table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        company_name VARCHAR(255),
        contact_person VARCHAR(255),
        phone VARCHAR(20),
        email VARCHAR(255),
        business_type VARCHAR(50),
        gst_number VARCHAR(50),
        verification_status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Vendors table created.');

    // Create Vendor Documents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_documents (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
        company_registration VARCHAR(255),
        pan_card VARCHAR(255),
        gst_certificate VARCHAR(255),
        owner_id VARCHAR(255),
        address_proof VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Vendor Documents table created.');

    // Create Vendor Bank Details table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_bank_details (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
        account_holder_name VARCHAR(255),
        bank_name VARCHAR(255),
        account_number VARCHAR(100),
        ifsc_code VARCHAR(50),
        cheque_file VARCHAR(255),
        verification_status VARCHAR(50) DEFAULT 'For Verify',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Vendor Bank Details table created.');

    // Create Vendor Listings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_listings (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL, -- 'Studio', 'Equipment', 'Manpower'
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2),
        image_url VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Vendor Listings table created.');

    // Create Bookings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
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
    console.log('Bookings table created.');

    console.log('Database initialization complete.');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

initDB();
