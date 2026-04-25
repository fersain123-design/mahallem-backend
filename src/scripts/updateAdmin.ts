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

async function updateAdmin() {
  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');
  const name = (process.env.ADMIN_NAME || 'Admin').trim();

  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'ADMIN',
      },
      select: { email: true, role: true },
    });
    console.log('✅ Admin created:', created.email, 'Role:', created.role);
    return;
  }

  const updated = await prisma.user.update({
    where: { email },
    data: {
      name,
      role: 'ADMIN',
      passwordHash,
      isActive: true,
      deactivatedAt: null,
      deactivationReason: null,
    },
    select: { email: true, role: true },
  });
  console.log('✅ Admin updated:', updated.email, 'Role:', updated.role);
}

updateAdmin()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
