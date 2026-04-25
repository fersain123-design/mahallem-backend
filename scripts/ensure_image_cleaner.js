const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const CLEANER_HOST = process.env.IMAGE_CLEANER_HOST || '127.0.0.1';
const CLEANER_PORT = Number(process.env.IMAGE_CLEANER_PORT || 8000);
const CLEANER_HEALTH_PATH = process.env.IMAGE_CLEANER_HEALTH_PATH || '/health';
const CLEANER_START_TIMEOUT_MS = Number(process.env.IMAGE_CLEANER_START_TIMEOUT_MS || 15000);
const CLEANER_ENABLE_REMBG = process.env.IMAGE_CLEANER_ENABLE_REMBG || '1';

const repoRoot = path.resolve(__dirname, '..', '..');
const cleanerDir = path.join(repoRoot, 'backend');
const runLogsDir = path.join(repoRoot, '_runlogs');
const cleanerPidFile = path.join(runLogsDir, 'image-cleaner.pid.txt');
const ensureLockFile = path.join(runLogsDir, 'image-cleaner.ensure.lock');

const cleanerPythonCandidates = [
  String(process.env.IMAGE_CLEANER_PYTHON || '').trim(),
  path.join(cleanerDir, '.venv313', 'Scripts', 'python.exe'),
  path.join(cleanerDir, '.venv312', 'Scripts', 'python.exe'),
  path.join(cleanerDir, '.venv311', 'Scripts', 'python.exe'),
  path.join(cleanerDir, '.venv310', 'Scripts', 'python.exe'),
  path.join(cleanerDir, '.venv', 'Scripts', 'python.exe'),
  path.join(cleanerDir, 'venv', 'Scripts', 'python.exe'),
].filter(Boolean);

const cleanerPython = cleanerPythonCandidates.find((candidate) => fs.existsSync(candidate));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isProcessAlive = (pid) => {
  const normalized = Number(pid);
  if (!Number.isFinite(normalized) || normalized <= 0) return false;
  try {
    process.kill(normalized, 0);
    return true;
  } catch {
    return false;
  }
};

const readExistingCleanerPid = () => {
  try {
    if (!fs.existsSync(cleanerPidFile)) return null;
    const raw = fs.readFileSync(cleanerPidFile, 'utf8').trim();
    if (!raw) return null;
    const pid = Number(raw);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
};

const isLockFresh = () => {
  try {
    if (!fs.existsSync(ensureLockFile)) return false;
    const stat = fs.statSync(ensureLockFile);
    return Date.now() - Number(stat.mtimeMs || 0) < CLEANER_START_TIMEOUT_MS + 5000;
  } catch {
    return false;
  }
};

const acquireEnsureLock = () => {
  try {
    fs.mkdirSync(runLogsDir, { recursive: true });
    const fd = fs.openSync(ensureLockFile, 'wx');
    fs.writeFileSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
};

const releaseEnsureLock = () => {
  try {
    if (fs.existsSync(ensureLockFile)) fs.unlinkSync(ensureLockFile);
  } catch {
    // ignore lock cleanup issues
  }
};

const isCleanerHealthy = () =>
  new Promise((resolve) => {
    const req = http.request(
      {
        host: CLEANER_HOST,
        port: CLEANER_PORT,
        path: CLEANER_HEALTH_PATH,
        method: 'GET',
        timeout: 1500,
      },
      (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });

const startCleaner = () => {
  const existingPid = readExistingCleanerPid();
  if (existingPid && isProcessAlive(existingPid)) {
    console.log('[image-cleaner] existing process detected pid=', existingPid);
    return true;
  }

  if (isLockFresh()) {
    console.log('[image-cleaner] startup lock exists; another ensure is already starting cleaner');
    return true;
  }

  if (!acquireEnsureLock()) {
    console.log('[image-cleaner] could not acquire startup lock; skipping duplicate start');
    return true;
  }

  if (!cleanerPython) {
    console.warn('[image-cleaner] python executable not found. tried:', cleanerPythonCandidates);
    releaseEnsureLock();
    return false;
  }

  if (!fs.existsSync(path.join(cleanerDir, 'main.py'))) {
    console.warn('[image-cleaner] cleaner app not found in:', cleanerDir);
    releaseEnsureLock();
    return false;
  }

  try {
    fs.mkdirSync(runLogsDir, { recursive: true });
    const outFd = fs.openSync(path.join(runLogsDir, 'image-cleaner.ensure.out.txt'), 'a');
    const errFd = fs.openSync(path.join(runLogsDir, 'image-cleaner.ensure.err.txt'), 'a');

    const childEnv = { ...process.env, IMAGE_CLEANER_ENABLE_REMBG: CLEANER_ENABLE_REMBG };

    const child = spawn(
      cleanerPython,
      ['-m', 'uvicorn', 'main:app', '--host', CLEANER_HOST, '--port', String(CLEANER_PORT)],
      {
        cwd: cleanerDir,
        detached: true,
        stdio: ['ignore', outFd, errFd],
        windowsHide: true,
        env: childEnv,
      }
    );

    child.unref();
    fs.writeFileSync(cleanerPidFile, String(child.pid || ''));
    releaseEnsureLock();
    return true;
  } catch (error) {
    console.warn('[image-cleaner] failed to start:', String(error && error.message ? error.message : error));
    releaseEnsureLock();
    return false;
  }
};

async function main() {
  try {
    const healthy = await isCleanerHealthy();
    if (healthy) {
      console.log('[image-cleaner] already running');
      return;
    }

    const started = startCleaner();
    if (!started) {
      return;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < CLEANER_START_TIMEOUT_MS) {
      if (await isCleanerHealthy()) {
        console.log('[image-cleaner] started and healthy');
        return;
      }
      await wait(500);
    }

    if (await isCleanerHealthy()) {
      console.log('[image-cleaner] healthy after timeout window');
      return;
    }

    console.warn('[image-cleaner] start requested but health check did not pass in time');
  } catch (error) {
    console.warn('[image-cleaner] ensure step failed:', String(error && error.message ? error.message : error));
  } finally {
    releaseEnsureLock();
  }
}

main();
