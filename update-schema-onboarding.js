import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function updateSchema() {
  try {
    console.log('Connecting to database...');
    
    // Add onboarding_status and current_step to vendors table
    await pool.query(`
      ALTER TABLE vendors 
      ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'Started',
      ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1;
    `);
    console.log('Columns onboarding_status and current_step added to vendors table.');

    console.log('Schema update complete.');
    process.exit(0);
  } catch (error) {
    console.error('Schema update failed:', error);
    process.exit(1);
  }
}

updateSchema();
