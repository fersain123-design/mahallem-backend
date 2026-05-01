"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSqliteCompatibility = void 0;
const client_1 = require("@prisma/client");
const rawLogLevel = String(process.env.LOG_LEVEL || '').trim().toLowerCase();
const logLevel = rawLogLevel === 'debug' || rawLogLevel === 'error' ? rawLogLevel : 'info';
const prismaLog = logLevel === 'debug'
    ? ['query', 'info', 'warn', 'error']
    : logLevel === 'error'
        ? ['error']
        : ['info', 'warn', 'error'];
const prisma = new client_1.PrismaClient({
    log: prismaLog,
});
const SQLITE_VENDOR_PROFILE_COMPAT_COLUMNS = [
    { name: 'taxSheetReviewStatus', sqlType: "TEXT NOT NULL DEFAULT 'PENDING'" },
    { name: 'taxSheetReviewNote', sqlType: 'TEXT' },
    { name: 'residenceDocReviewStatus', sqlType: "TEXT NOT NULL DEFAULT 'PENDING'" },
    { name: 'residenceDocReviewNote', sqlType: 'TEXT' },
    { name: 'idPhotoFrontReviewStatus', sqlType: "TEXT NOT NULL DEFAULT 'PENDING'" },
    { name: 'idPhotoFrontReviewNote', sqlType: 'TEXT' },
    { name: 'idPhotoBackReviewStatus', sqlType: "TEXT NOT NULL DEFAULT 'PENDING'" },
    { name: 'idPhotoBackReviewNote', sqlType: 'TEXT' },
];
const SQLITE_VENDOR_CHAT_CONVERSATION_COMPAT_COLUMNS = [
    { name: 'workflowStatus', sqlType: "TEXT NOT NULL DEFAULT 'OPEN'" },
    { name: 'orderId', sqlType: 'TEXT' },
    { name: 'isSupport', sqlType: 'BOOLEAN NOT NULL DEFAULT false' },
    { name: 'supportCategory', sqlType: 'TEXT' },
    { name: 'escalatedToAdmin', sqlType: 'BOOLEAN NOT NULL DEFAULT false' },
    { name: 'escalatedAt', sqlType: 'DATETIME' },
    { name: 'adminSupportConversationId', sqlType: 'TEXT' },
    { name: 'closedAt', sqlType: 'DATETIME' },
    { name: 'customerRating', sqlType: 'INTEGER' },
    { name: 'customerFeedback', sqlType: 'TEXT' },
    { name: 'customerLastReadAt', sqlType: 'DATETIME' },
    { name: 'vendorLastReadAt', sqlType: 'DATETIME' },
];
const isSqliteUrl = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized.startsWith('file:') || normalized.startsWith('sqlite:');
};
const ensureSqliteCompatibility = async () => {
    if (!isSqliteUrl(process.env.DATABASE_URL || '')) {
        return;
    }
    const ensureTableColumns = async (tableName, columns) => {
        const rows = (await prisma.$queryRawUnsafe(`PRAGMA table_info("${tableName}")`));
        const existing = new Set(rows.map((row) => String(row?.name || '').trim()).filter(Boolean));
        for (const column of columns) {
            if (existing.has(column.name))
                continue;
            await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ADD COLUMN "${column.name}" ${column.sqlType}`);
        }
    };
    await ensureTableColumns('VendorProfile', SQLITE_VENDOR_PROFILE_COMPAT_COLUMNS);
    await ensureTableColumns('VendorChatConversation', SQLITE_VENDOR_CHAT_CONVERSATION_COMPAT_COLUMNS);
};
exports.ensureSqliteCompatibility = ensureSqliteCompatibility;
exports.default = prisma;
