const { spawnSync } = require('child_process');

const directPgUrl = String(process.env.POSTGRES_DATABASE_URL || '').trim();
const fallbackDatabaseUrl = String(process.env.DATABASE_URL || '').trim();
const resolvedPgUrl = directPgUrl || fallbackDatabaseUrl;
const explicitDirectUrl = String(process.env.POSTGRES_DIRECT_URL || '').trim();
const isSupabasePooler = /pooler\.supabase\.com(?::6543)?/i.test(resolvedPgUrl);

if (!resolvedPgUrl || !/^postgres(ql)?:\/\//i.test(resolvedPgUrl)) {
  console.log(
    '[prisma:pg:migrate:deploy:safe] PostgreSQL URL not found in POSTGRES_DATABASE_URL or DATABASE_URL; skipping deploy.'
  );
  process.exit(0);
}

if (isSupabasePooler && !explicitDirectUrl) {
  console.error(
    '[prisma:pg:migrate:deploy:safe] Supabase pooler URL detected. Set POSTGRES_DIRECT_URL to direct host (db.<project-ref>.supabase.co:5432) for migrations.'
  );
  process.exit(1);
}

const envForDeploy = {
  ...process.env,
  POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL || resolvedPgUrl,
  ...(explicitDirectUrl ? { POSTGRES_DIRECT_URL: explicitDirectUrl } : {}),
};

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'migrate', 'deploy', '--schema', 'prisma/postgres/schema.prisma'],
  {
    stdio: 'inherit',
    shell: false,
    env: envForDeploy,
    timeout: 180000,
  }
);

if (result.error && result.error.code === 'ETIMEDOUT') {
  console.error(
    '[prisma:pg:migrate:deploy:safe] Migration timed out after 180s. Verify POSTGRES_DIRECT_URL (direct 5432) and network access.'
  );
  process.exit(1);
}

if (result.status !== 0) {
  const code = Number.isFinite(result.status) ? result.status : 1;
  process.exit(code);
}

console.log('[prisma:pg:migrate:deploy:safe] Migration deploy completed successfully.');
