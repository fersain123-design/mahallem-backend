const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, email: true, role: true, phone: true, phoneNormalized: true, authProvider: true },
    take: 20
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
