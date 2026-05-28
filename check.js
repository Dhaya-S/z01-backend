import * as dotenv from 'dotenv';
dotenv.config();
import('pg').then(m => {
  const pool = new m.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.query('SELECT id, contact_person FROM vendors').then(r => {
    console.log(r.rows);
    return pool.query('SELECT * FROM vendor_listings');
  }).then(r => {
    console.log('Listings:', r.rows);
  }).finally(() => pool.end());
})
