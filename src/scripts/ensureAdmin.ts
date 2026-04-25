import '../config/env';

import prisma from '../config/db';
import { hashPassword } from '../utils/passwordUtils';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

async function main() {
  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');
  const name = (process.env.ADMIN_NAME || 'Admin').trim();

  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'ADMIN',
      },
    });
    console.log(`✓ Created admin user: ${email}`);
    return;
  }

  await prisma.user.update({
    where: { email },
    data: {
      name,
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log(`✓ Updated admin user: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
