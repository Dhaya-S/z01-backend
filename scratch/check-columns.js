import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkColumns() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'vendors'");
    console.log('Columns in vendors table:', res.rows.map(r => r.column_name));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
checkColumns();
