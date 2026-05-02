const { spawnSync } = require('child_process');

const directPgUrl = String(process.env.POSTGRES_DATABASE_URL || '').trim();
const fallbackDatabaseUrl = String(process.env.DATABASE_URL || '').trim();
const resolvedPgUrl = directPgUrl || fallbackDatabaseUrl;

if (!resolvedPgUrl || !/^postgres(ql)?:\/\//i.test(resolvedPgUrl)) {
  console.log(
    '[prisma:pg:migrate:deploy:safe] PostgreSQL URL not found in POSTGRES_DATABASE_URL or DATABASE_URL; skipping deploy.'
  );
  process.exit(0);
}

const envForDeploy = {
  ...process.env,
  POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL || resolvedPgUrl,
  POSTGRES_DIRECT_URL: process.env.POSTGRES_DIRECT_URL || resolvedPgUrl,
};

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'migrate', 'deploy', '--schema', 'prisma/postgres/schema.prisma'],
  {
    stdio: 'inherit',
    shell: false,
    env: envForDeploy,
  }
);

if (result.status !== 0) {
  const code = Number.isFinite(result.status) ? result.status : 1;
  process.exit(code);
}

console.log('[prisma:pg:migrate:deploy:safe] Migration deploy completed successfully.');
