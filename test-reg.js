async function testRegister() {
  try {
    const res = await fetch('http://localhost:3000/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: `test${Date.now()}@test.com`,
        password: 'password123',
        user_type: 'vendor',
        metadata: { contactPerson: 'Arjun', phone: '1234567890' }
      })
    });
    
    if (!res.ok) {
      console.log('Error Data:', await res.text());
    } else {
      console.log('Success:', await res.json());
    }
  } catch (err) {
    console.log('Error:', err.message);
  }
}

testRegister();
