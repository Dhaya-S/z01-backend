const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected to DB');
    
    // Add cover_photo column
    await client.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cover_photo TEXT;');
    console.log('Successfully added cover_photo column to vendors table');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

run();
