#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const NPM_CLI = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runPrismaGenerate(args) {
  const options = {
    stdio: 'pipe',
    encoding: 'utf8',
    shell: false,
    env: process.env,
  };

  if (process.platform === 'win32') {
    const shellCmd = `npm exec -- prisma generate ${args.join(' ')}`.trim();
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', shellCmd], options);
  }

  return spawnSync(NPM_CLI, ['exec', '--', 'prisma', 'generate', ...args], options);
}

function isWindowsEngineLockError(result) {
  if (process.platform !== 'win32') {
    return false;
  }

  const message = String(result?.stderr || '') + String(result?.output || '');
  return message.includes('EPERM: operation not permitted, rename')
    && message.includes('query_engine-windows.dll.node');
}

function hasUsableGeneratedClient() {
  const clientDir = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');
  const engineFile = path.join(clientDir, 'query_engine-windows.dll.node');
  const jsClientFile = path.join(clientDir, 'index.js');
  return fs.existsSync(engineFile) && fs.existsSync(jsClientFile);
}

const firstRun = runPrismaGenerate([]);
if (firstRun.error) {
  console.error('[prisma-generate-safe] Failed to launch Prisma CLI:', firstRun.error.message);
}
if (firstRun.stdout) {
  process.stdout.write(firstRun.stdout);
}
if (firstRun.stderr) {
  process.stderr.write(firstRun.stderr);
}
if (firstRun.status === 0) {
  process.exit(0);
}

// When backend already holds the engine DLL lock on Windows, keep existing generated engine client.
if (isWindowsEngineLockError(firstRun)) {
  if (hasUsableGeneratedClient()) {
    console.warn('\n[prisma-generate-safe] Detected Windows Prisma engine lock. Reusing existing generated Prisma client.');
    console.warn('[prisma-generate-safe] To fully regenerate, stop running backend processes and run: npm run prisma:generate\n');
    process.exit(0);
  }

  console.error('\n[prisma-generate-safe] Detected Windows Prisma engine lock, and no usable generated engine client was found.');
  console.error('[prisma-generate-safe] Stop running backend processes, then run: npm run prisma:generate\n');
  process.exit(firstRun.status || 1);
}

process.exit(firstRun.status || 1);
