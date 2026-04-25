const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  const demoProducts = await prisma.product.findMany({
    where: {
      name: 'Diger Demo',
      vendor: {
        user: {
          email: {
            startsWith: 'vendor-',
            endsWith: '@demo.com',
          },
        },
      },
    },
    select: { id: true },
  });

  const ids = demoProducts.map((product) => product.id);
  if (!ids.length) {
    console.log(JSON.stringify({ deletedProducts: 0 }, null, 2));
    return;
  }

  const deleted = await prisma.product.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(JSON.stringify({ deletedProducts: deleted.count }, null, 2));
}

main()
  .catch((error) => {
    console.error('cleanup_demo_diger_products failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
