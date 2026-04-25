/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: {
      items: true,
      refunds: true,
      webhookLogs: { orderBy: { receivedAt: 'desc' }, take: 8 },
      attempts: { orderBy: { createdAt: 'desc' }, take: 8 },
      order: true,
    },
  });

  const counts = {
    payment: await prisma.payment.count(),
    paymentItem: await prisma.paymentItem.count(),
    paymentAttempt: await prisma.paymentAttempt.count(),
    submerchant: await prisma.submerchant.count(),
    refund: await prisma.refund.count(),
    webhookLog: await prisma.paymentWebhookLog.count(),
  };

  const summary = payments.map((p) => ({
    paymentId: p.id,
    orderId: p.orderId,
    paymentStatus: p.status,
    orderStatus: p.order ? p.order.status : null,
    orderPaymentStatus: p.order ? p.order.paymentStatus : null,
    refundCount: p.refunds.length,
    itemCount: p.items.length,
    webhookCount: p.webhookLogs.length,
    duplicateWebhookCount: p.webhookLogs.filter((w) => w.isDuplicate).length,
    attemptTypes: p.attempts.map((a) => a.requestType),
  }));

  const readiness = await prisma.submerchant.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      vendorId: true,
      status: true,
      readinessReason: true,
      subMerchantKey: true,
      updatedAt: true,
    },
  });

  const missingBlockEvidence = await prisma.submerchant.findFirst({
    where: { readinessReason: { contains: 'missing_iban' } },
    orderBy: { updatedAt: 'desc' },
    select: { vendorId: true, status: true, readinessReason: true, updatedAt: true },
  });

  const duplicateEvidence = await prisma.paymentWebhookLog.findFirst({
    where: { isDuplicate: true },
    orderBy: { receivedAt: 'desc' },
    select: {
      paymentId: true,
      callbackToken: true,
      isDuplicate: true,
      processStatus: true,
      receivedAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        counts,
        summary,
        readiness,
        missingBlockEvidence,
        duplicateEvidence,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
