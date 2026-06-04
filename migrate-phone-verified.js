import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  try {
    console.log('Running phone verification migration...');

    // Add phone_verified column to users table
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
    `);
    console.log('✓ Added phone_verified column to users');

    // Add user_type column if not exists (some older schemas may lack it)
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT 'customer';
    `);
    console.log('✓ Ensured user_type column exists on users');

    // Add index on phone for fast OTP-based login lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
    `);
    console.log('✓ Created index idx_users_phone');

    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
