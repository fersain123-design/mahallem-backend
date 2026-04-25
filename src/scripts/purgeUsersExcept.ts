import '../config/env';

import prisma from '../config/db';
import { hashPassword } from '../utils/passwordUtils';

async function promptLine(question: string): Promise<string> {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = await rl.question(question);
    return String(ans || '').trim();
  } finally {
    rl.close();
  }
}

async function promptHidden(question: string): Promise<string> {
  const readline = await import('node:readline');

  return await new Promise<string>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    const onData = (char: Buffer) => {
      // Prevent echoing characters (best-effort on Windows terminals)
      const str = char.toString('utf8');
      if (str === '\r' || str === '\n' || str === '\u0004') return;
      // Write nothing (no '*' either)
    };

    try {
      if (process.stdin.isTTY) {
        process.stdin.on('data', onData);
      }

      rl.question(question, (answer) => {
        if (process.stdin.isTTY) {
          process.stdin.off('data', onData);
        }
        rl.close();
        resolve(String(answer || '').trim());
      });
    } catch {
      if (process.stdin.isTTY) {
        process.stdin.off('data', onData);
      }
      rl.close();
      resolve('');
    }
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

async function getEnvOrPrompt(name: string, prompt: string): Promise<string> {
  const value = String(process.env[name] || '').trim();
  if (value) return value;
  const ans = await promptLine(prompt);
  if (!ans) throw new Error(`Missing required value for: ${name}`);
  return ans;
}

async function getEnvOrPromptHidden(name: string, prompt: string): Promise<string> {
  const value = String(process.env[name] || '').trim();
  if (value) return value;
  const ans = await promptHidden(prompt);
  if (!ans) throw new Error(`Missing required value for: ${name}`);
  return ans;
}

function assertSafeToRun(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run: NODE_ENV=production');
  }

  const dbUrl = String(process.env.DATABASE_URL || '').toLowerCase();
  // Best-effort guard: allow local dev DBs only.
  // This project uses SQLite in dev, so allow local file URLs/paths too.
  const looksLocal =
    dbUrl.startsWith('file:') ||
    dbUrl.includes('localhost') ||
    dbUrl.includes('127.0.0.1') ||
    dbUrl.includes('host.docker.internal') ||
    dbUrl.includes('\\') || // Windows path
    dbUrl.includes(':/'); // file path-ish

  if (!looksLocal) {
    throw new Error(
      'Refusing to run: DATABASE_URL does not look like a local database. ' +
        'If you really intend to do this, run it against a local DB.'
    );
  }

}

async function ensureAdminUser(): Promise<{ id: string; email: string }> {
  const email = await getEnvOrPrompt('ADMIN_EMAIL', 'Admin email: ');
  const name = (process.env.ADMIN_NAME || 'Admin').trim();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });

  // Only require a password if we need to CREATE the admin, or if caller explicitly wants to reset it.
  const passwordProvided = Boolean(String(process.env.ADMIN_PASSWORD || '').trim());
  const password = existing ? (passwordProvided ? await getEnvOrPromptHidden('ADMIN_PASSWORD', 'Admin password (hidden): ') : '') : await getEnvOrPromptHidden('ADMIN_PASSWORD', 'Admin password (hidden): ');
  const passwordHash = password ? await hashPassword(password) : undefined;

  if (!existing) {
    if (!passwordHash) {
      throw new Error('ADMIN_PASSWORD is required to create the admin user (set env var or run interactively).');
    }

    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'ADMIN',
      },
      select: { id: true, email: true },
    });
    console.log(`✓ Created admin user: ${created.email}`);
    return created;
  }

  const data: Record<string, any> = {
    name,
    role: 'ADMIN',
    isActive: true,
    deactivatedAt: null,
    deactivationReason: null,
  };
  if (passwordHash) data.passwordHash = passwordHash;

  const updated = await prisma.user.update({
    where: { email },
    data,
    select: { id: true, email: true },
  });
  console.log(`✓ Updated admin user: ${updated.email}${passwordHash ? ' (password reset)' : ''}`);
  return updated;
}

async function main() {
  assertSafeToRun();

  const confirm = String(process.env.CONFIRM_PURGE_USERS || '').trim().toUpperCase();
  let confirmed = confirm === 'YES';
  if (!confirmed) {
    const typed = (await promptLine(
      'This will DELETE ALL USERS except the admin AND DELETE ALL PRODUCTS + ORDERS. Type YES to continue: '
    ))
      .trim()
      .toUpperCase();
    confirmed = typed === 'YES';
  }
  if (!confirmed) {
    throw new Error('Aborted: confirmation not provided.');
  }

  const keepAdmin = await ensureAdminUser();

  const usersToDelete = await prisma.user.findMany({
    where: { id: { not: keepAdmin.id } },
    select: { id: true, email: true, role: true },
  });

  console.log(`⚠️ Resetting data: deleting all products/orders and ${usersToDelete.length} users (keeping: ${keepAdmin.email})`);

  const results = await prisma.$transaction(async (tx) => {
    // Delete in dependency-safe order (SQLite may not enforce cascades depending on pragmas).
    const payoutItems = await tx.payoutItem.deleteMany({});
    const payouts = await tx.payout.deleteMany({});

    // Order -> OrderItem is cascade, but OrderItem has FKs referenced by PayoutItem (handled above).
    const orders = await tx.order.deleteMany({});
    const orderItems = await tx.orderItem.deleteMany({});

    // Cart -> CartItem is cascade, but CartItem references Product.
    const carts = await tx.cart.deleteMany({});
    const cartItems = await tx.cartItem.deleteMany({});

    const productImages = await tx.productImage.deleteMany({});
    const products = await tx.product.deleteMany({});

    const promotions = await tx.promotion.deleteMany({});
    const campaigns = await tx.campaign.deleteMany({});
    const violations = await tx.vendorViolation.deleteMany({});

    const addresses = await tx.customerAddress.deleteMany({
      where: { userId: { not: keepAdmin.id } },
    });

    const supportConversations = await tx.supportConversation.deleteMany({
      where: { userId: { not: keepAdmin.id } },
    });

    const notifications = await tx.notification.deleteMany({
      where: { userId: { not: keepAdmin.id } },
    });

    const vendorProfiles = await tx.vendorProfile.deleteMany({
      where: { userId: { not: keepAdmin.id } },
    });

    const users = await tx.user.deleteMany({
      where: { id: { not: keepAdmin.id } },
    });

    return {
      users,
      vendorProfiles,
      orders,
      orderItems,
      carts,
      cartItems,
      products,
      productImages,
      promotions,
      campaigns,
      payouts,
      payoutItems,
      addresses,
      supportConversations,
      notifications,
      violations,
    };
  });

  console.log('✓ Purge completed. Deleted counts:');
  console.log({
    users: results.users.count,
    vendorProfiles: results.vendorProfiles.count,
    products: results.products.count,
    productImages: results.productImages.count,
    orders: results.orders.count,
    orderItems: results.orderItems.count,
    payouts: results.payouts.count,
    payoutItems: results.payoutItems.count,
    carts: results.carts.count,
    cartItems: results.cartItems.count,
    addresses: results.addresses.count,
    supportConversations: results.supportConversations.count,
    notifications: results.notifications.count,
    promotions: results.promotions.count,
    campaigns: results.campaigns.count,
    vendorViolations: results.violations.count,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
