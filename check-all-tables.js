const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkAllTables() {
  try {
    const tables = ['users', 'vendors', 'vendor_documents', 'vendor_bank_details', 'vendor_listings', 'bookings'];
    
    for (const table of tables) {
      const { rows } = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`\n=== Table: ${table} ===`);
      rows.forEach(r => {
        console.log(` - ${r.column_name} (${r.data_type})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

checkAllTables();
