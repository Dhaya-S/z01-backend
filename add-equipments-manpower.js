import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addEquipmentsManpower() {
  try {
    console.log('Adding equipments and manpower to vendor_listings...');
    
    await pool.query(`
      ALTER TABLE vendor_listings 
      ADD COLUMN IF NOT EXISTS equipments JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS manpower JSONB DEFAULT '[]';
    `);

    console.log('vendor_listings table updated successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Schema update failed:', error);
    process.exit(1);
  }
}

addEquipmentsManpower();
