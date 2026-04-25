const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const migrationName = '20260308130000_add_seller_campaign_customer_notifications';
const expectedColumn = 'customerNotifiedAt';

async function main() {
  const columns = await prisma.$queryRawUnsafe('PRAGMA table_info("SellerCampaign")');
  const hasColumn = Array.isArray(columns) && columns.some((column) => String(column.name) === expectedColumn);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT migration_name AS migrationName, finished_at AS finishedAt, rolled_back_at AS rolledBackAt
     FROM _prisma_migrations
     WHERE migration_name = '${migrationName}'
     ORDER BY started_at DESC
     LIMIT 1`
  );

  const migrationRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  const isFailed = Boolean(migrationRow && !migrationRow.finishedAt && !migrationRow.rolledBackAt);

  if (!hasColumn || !isFailed) {
    console.log(
      JSON.stringify({
        repaired: false,
        reason: hasColumn ? 'no_failed_record' : 'column_missing',
        hasColumn,
        isFailed,
      })
    );
    return;
  }

  const repairedRows = await prisma.$executeRawUnsafe(
    `UPDATE _prisma_migrations
     SET finished_at = CURRENT_TIMESTAMP,
         logs = NULL
     WHERE migration_name = '${migrationName}'
       AND finished_at IS NULL
       AND rolled_back_at IS NULL`
  );

  console.log(
    JSON.stringify({
      repaired: repairedRows > 0,
      repairedRows,
      hasColumn,
      isFailed,
    })
  );
}

main()
  .catch(async (error) => {
    console.error(error && error.message ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });