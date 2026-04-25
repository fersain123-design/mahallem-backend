const fetch = require('node-fetch');

const createAdmin = async () => {
  try {
    const response = await fetch('http://127.0.0.1:4000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Ferhat Admin',
        email: 'fer.sain123@gmil.com',
        password: 'Ferhat.1577',
        role: 'ADMIN',
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Admin user başarıyla oluşturuldu!');
      console.log('Email:', 'fer.sain123@gmil.com');
      console.log('Şifre:', 'Ferhat.1577');
    } else {
      console.log('\n❌ Hata:', data.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
};

createAdmin();
