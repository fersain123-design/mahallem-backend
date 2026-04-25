const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
  const schemaHashPath = path.join(projectRoot, '.prisma-schema.sha256');

  // Prisma Client JS types are generated under node_modules/@prisma/client.
  // The engine binary alone is not a reliable indicator that the client was generated.
  const prismaClientTypesPath = path.join(projectRoot, 'node_modules', '@prisma', 'client', 'index.d.ts');

  const enginePath = path.join(
    projectRoot,
    'node_modules',
    '.prisma',
    'client',
    'query_engine-windows.dll.node'
  );

  const schemaText = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') : '';
  const currentHash = schemaText ? sha256(schemaText) : '';
  const previousHash = fs.existsSync(schemaHashPath)
    ? String(fs.readFileSync(schemaHashPath, 'utf8') || '').trim()
    : '';

  const hasEngine = fs.existsSync(enginePath);
  const hasClientTypes = fs.existsSync(prismaClientTypesPath);

  const shouldGenerate =
    !hasEngine ||
    !hasClientTypes ||
    !previousHash ||
    (currentHash && previousHash !== currentHash);

  if (!shouldGenerate) {
    console.log('[predev] Prisma client up-to-date; skipping prisma generate.');
    return;
  }

  console.log('[predev] Running prisma generate (schema changed or client missing)...');

  const isWindows = process.platform === 'win32';

  // Prefer running the Prisma CLI JS entrypoint via Node to avoid Windows .cmd
  // spawning issues (EINVAL) that can happen with non-ASCII paths.
  const prismaCliJs = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
  const prismaCmd = path.join(projectRoot, 'node_modules', '.bin', isWindows ? 'prisma.cmd' : 'prisma');

  /** @type {import('child_process').SpawnSyncReturns<Buffer>} */
  let result;

  if (fs.existsSync(prismaCliJs)) {
    result = spawnSync(process.execPath, [prismaCliJs, 'generate'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: false,
    });
  } else {
    const command = fs.existsSync(prismaCmd) ? prismaCmd : 'prisma';
    const shouldUseShell = isWindows && /\.(cmd|bat)$/i.test(command);
    result = spawnSync(command, ['generate'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: shouldUseShell,
    });
  }

  // Fallback for rare cases where spawning still fails.
  if (result?.error) {
    console.warn('[predev] Prisma generate failed, retrying with npx prisma generate...');
    result = spawnSync('npx', ['prisma', 'generate'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: isWindows,
    });
  }

  if (result.error) {
    console.error('[predev] Failed to run prisma generate:', result.error);
    process.exit(1);
  }

  if (result.status === 0 && currentHash) {
    try {
      fs.writeFileSync(schemaHashPath, currentHash, 'utf8');
    } catch (e) {
      console.warn('[predev] Failed to write schema hash file:', e);
    }
  }

  process.exit(result.status ?? 0);
}

main();
