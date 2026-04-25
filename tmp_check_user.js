const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({
    where: { email: 'customer@demo.com' },
    select: { id: true, email: true, phone: true, phoneNormalized: true, authProvider: true }
  });
  console.log(JSON.stringify(user, null, 2));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
