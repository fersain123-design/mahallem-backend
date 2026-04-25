const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updateAdmin() {
  try {
    // Zaten var olan user'ı kontrol et
    const existingUser = await prisma.user.findUnique({
      where: { email: 'fer.sain123@gmail.com' },
      include: { vendorProfile: true },
    });

    console.log('Existing user:', JSON.stringify(existingUser, null, 2));

    // Role'ü ADMIN olarak güncelle
    const hashedPassword = await bcrypt.hash('Ferhat.1577', 10);

    const updatedUser = await prisma.user.update({
      where: { email: 'fer.sain123@gmail.com' },
      data: {
        name: 'Ferhat Admin',
        role: 'ADMIN',
        passwordHash: hashedPassword,
      },
      include: { vendorProfile: true },
    });

    console.log('\n✅ Admin user başarıyla güncellendi!');
    console.log('Email:', updatedUser.email);
    console.log('Role:', updatedUser.role);
    console.log('Name:', updatedUser.name);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdmin();
