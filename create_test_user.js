const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db'
    }
  }
});

async function createTestUser() {
  try {
    // Check if vendor user exists
    let user = await prisma.user.findUnique({
      where: { email: 'test@vendor.com' },
      include: { vendorProfile: true }
    });
    
    if (!user) {
      // Hash password
      const hashedPassword = await bcrypt.hash('testpass123', 10);
      
      // Create user
      user = await prisma.user.create({
        data: {
          name: 'Test Vendor',
          email: 'test@vendor.com',
          passwordHash: hashedPassword,
          phone: '5551234567',
          role: 'VENDOR'
        }
      });
      
      console.log('Created vendor user:', user.id);
    } else {
      console.log('Vendor user already exists:', user.id);
    }
    
    // Create vendor profile if it doesn't exist
    if (!user.vendorProfile) {
      const vendorProfile = await prisma.vendorProfile.create({
        data: {
          userId: user.id,
          shopName: 'Test Shop',
          businessType: 'manav',
          status: 'APPROVED',
          iban: 'TR330006100519786457841326',
          bankName: 'Test Bank'
        }
      });
      
      console.log('Created vendor profile:', vendorProfile.id);
    } else {
      console.log('Vendor profile already exists:', user.vendorProfile.id);
    }
    
    // Check if admin user exists
    let adminUser = await prisma.user.findUnique({
      where: { email: 'admin@mahallem.com' }
    });
    
    if (!adminUser) {
      // Hash admin password
      const adminHashedPassword = await bcrypt.hash('admin123', 10);
      
      // Create admin user
      adminUser = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: 'admin@mahallem.com',
          passwordHash: adminHashedPassword,
          phone: '5551111111',
          role: 'ADMIN'
        }
      });
      
      console.log('Created admin user:', adminUser.id);
    } else {
      console.log('Admin user already exists:', adminUser.id);
    }
    
    console.log('Test users setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();