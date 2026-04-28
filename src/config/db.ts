import { PrismaClient } from '@prisma/client';

const rawLogLevel = String(process.env.LOG_LEVEL || '').trim().toLowerCase();
const logLevel = rawLogLevel === 'debug' || rawLogLevel === 'error' ? rawLogLevel : 'info';

const prismaLog =
  logLevel === 'debug'
    ? ['query', 'info', 'warn', 'error']
    : logLevel === 'error'
      ? ['error']
      : ['info', 'warn', 'error'];

const prisma = new PrismaClient({
  log: prismaLog as any,
});

export default prisma;
