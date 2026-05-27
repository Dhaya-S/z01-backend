import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function listAllTables() {
  try {
    const { rows } = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE' 
      AND table_schema NOT IN ('information_schema', 'pg_catalog')
    `);
    console.log('Tables:', rows);
    process.exit(0);
  } catch (error) {
    console.error('List failed:', error);
    process.exit(1);
  }
}

listAllTables();
