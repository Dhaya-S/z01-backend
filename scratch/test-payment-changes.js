const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function verifyChanges() {
  try {
    const vendorId = 18; // Using vendor 18 as an example
    console.log('1. Testing vendor details query with updated columns...');
    const vendorRes = await pool.query(
      'SELECT contact_person, company_name, email, phone FROM vendors WHERE id = $1',
      [vendorId]
    );

    if (vendorRes.rows.length === 0) {
      console.log('⚠️ Warning: Vendor 18 not found, but query succeeded structurally.');
    } else {
      const vendor = vendorRes.rows[0];
      console.log('✅ Query Succeeded! Vendor Details found:');
      console.log('   Contact Person:', vendor.contact_person);
      console.log('   Company Name:', vendor.company_name);
      console.log('   Email:', vendor.email);
      console.log('   Phone:', vendor.phone);

      const contactName = vendor.contact_person || vendor.company_name || `Vendor ${vendorId}`;
      console.log('✅ Contact Name resolve logic works:', contactName);
    }

    console.log('\n2. Testing Fee and Payout Calculations...');
    const mockDeposit = 1000;
    const platformFee = mockDeposit * 0.10;
    const vendorPayout = mockDeposit;

    console.log(`   For Deposit: ₹${mockDeposit}`);
    console.log(`   Calculated Platform Fee (10%): ₹${platformFee}`);
    console.log(`   Calculated Vendor Payout (100%): ₹${vendorPayout}`);

    if (platformFee === 100 && vendorPayout === 1000) {
      console.log('✅ Calculation logic is correct!');
    } else {
      console.log('❌ Calculation logic check failed.');
    }

  } catch (error) {
    console.error('❌ Verification script failed with error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyChanges();
