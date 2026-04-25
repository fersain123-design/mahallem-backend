const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.vendorProfile.update({
    where: { id: 'cmjxa96kq0002i3pgs3if61es' },
    data: { status: 'APPROVED' }
  });
  console.log('Updated:', result.status);
}

main().catch(console.error).finally(() => prisma.$disconnect());
