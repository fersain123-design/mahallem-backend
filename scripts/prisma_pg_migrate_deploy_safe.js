const { spawnSync } = require('child_process');

const pgUrl = String(process.env.POSTGRES_DATABASE_URL || '').trim();
if (!pgUrl) {
  console.log('[prisma:pg:migrate:deploy:safe] POSTGRES_DATABASE_URL not set; skipping deploy.');
  process.exit(0);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'migrate', 'deploy', '--schema', 'prisma/postgres/schema.prisma'],
  {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  }
);

if (result.status !== 0) {
  const code = Number.isFinite(result.status) ? result.status : 1;
  process.exit(code);
}

console.log('[prisma:pg:migrate:deploy:safe] Migration deploy completed successfully.');
