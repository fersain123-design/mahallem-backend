import './config/env';
import './types/express';
import app from './app';
import prisma, { ensureSqliteCompatibility } from './config/db';
import { spatialService } from './services/spatialService';
import { startProductProcessingWorker } from './services/productProcessingQueue';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';

const parsedPort = Number(process.env.PORT || 4000);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000;
const HOST = '0.0.0.0';
const IMAGE_CLEANER_BOOT_REQUIRED = String(process.env.IMAGE_CLEANER_BOOT_REQUIRED || '0') !== '0';
const IMAGE_CLEANER_BOOT_STRICT = String(process.env.IMAGE_CLEANER_BOOT_STRICT || '0') === '1';
const IMAGE_CLEANER_BOOT_TIMEOUT_MS = Number(process.env.IMAGE_CLEANER_BOOT_TIMEOUT_MS || 20000);
const IMAGE_CLEANER_HEALTH_URL = process.env.IMAGE_CLEANER_HEALTH_URL?.trim() || '';
const IMAGE_CLEANER_ENSURE_SCRIPT =
  process.env.IMAGE_CLEANER_ENSURE_SCRIPT?.trim() || path.join(path.resolve(__dirname, '..'), 'scripts', 'ensure_image_cleaner.js');

const withTimeout = async <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return (await Promise.race([promise, timeoutPromise])) as T;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isImageCleanerHealthy = async (): Promise<boolean> => {
  if (!IMAGE_CLEANER_HEALTH_URL) {
    return false;
  }

  try {
    const target = new URL(IMAGE_CLEANER_HEALTH_URL);
    const requestModule = target.protocol === 'https:' ? https : http;

    return await new Promise<boolean>((resolve) => {
      const req = requestModule.request(
        {
          method: 'GET',
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port,
          path: `${target.pathname}${target.search}`,
          timeout: 1500,
        },
        (res) => resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300)
      );

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  } catch {
    return false;
  }
};

const runImageCleanerEnsureScript = async (): Promise<void> => {
  if (!fs.existsSync(IMAGE_CLEANER_ENSURE_SCRIPT)) {
    throw new Error(`Image cleaner ensure script not found: ${IMAGE_CLEANER_ENSURE_SCRIPT}`);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [IMAGE_CLEANER_ENSURE_SCRIPT], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      windowsHide: true,
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code && code !== 0) {
        reject(new Error(`Image cleaner ensure script exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
};

const ensureImageCleanerAtBoot = async (): Promise<void> => {
  if (!IMAGE_CLEANER_HEALTH_URL) {
    console.log('ℹ IMAGE_CLEANER_HEALTH_URL not set; skipping image cleaner health boot check.');
    return;
  }

  if (await isImageCleanerHealthy()) {
    console.log('✓ Image cleaner is healthy');
    return;
  }

  console.log('↻ Image cleaner not healthy at boot, running ensure script...');
  await runImageCleanerEnsureScript();

  const deadline = Date.now() + IMAGE_CLEANER_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isImageCleanerHealthy()) {
      console.log('✓ Image cleaner became healthy');
      return;
    }
    await wait(400);
  }

  throw new Error(`Image cleaner is not healthy after ${IMAGE_CLEANER_BOOT_TIMEOUT_MS}ms`);
};

const kickoffImageCleanerBoot = (): void => {
  if (!IMAGE_CLEANER_BOOT_REQUIRED) {
    console.log('ℹ Image cleaner boot requirement disabled by IMAGE_CLEANER_BOOT_REQUIRED=0');
    return;
  }

  void ensureImageCleanerAtBoot().catch((error) => {
    if (IMAGE_CLEANER_BOOT_STRICT) {
      console.error('✗ Image cleaner boot health check failed in strict mode:', error);
      process.exit(1);
      return;
    }

    console.warn('⚠ Image cleaner boot health check failed; continuing server runtime.');
    console.warn('  Set IMAGE_CLEANER_BOOT_STRICT=1 to exit process on cleaner boot issues.');
  });
};

const startServer = async () => {
  try {
    // Test database connection
    await withTimeout(prisma.$connect(), 30000, 'Database connection timed out (30s).');
    await ensureSqliteCompatibility();
    console.log('✓ Database connected successfully');

    await startProductProcessingWorker();

    const server = app.listen(PORT, HOST, () => {
      console.log(`
╔════════════════════════════════════════════╗
    ║      Mahallem Backend Server Started       ║
║         http://${HOST}:${PORT}                 ║
╚════════════════════════════════════════════╝
      `);

      kickoffImageCleanerBoot();
      
      // Server başlar başlamaz GeoJSON'u R-Tree'ye yükle
      try {
        spatialService.loadGeoJSON('neighborhoods.geojson');
      } catch (err) {
        console.error('GeoJSON yüklenemedi, spatial index devre dışı:', err);
      }
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`✗ Port ${PORT} is already in use.`);
        console.error(`✱ Stop the running backend process on port ${PORT}, or start with another port.`);
        console.error('✱ Example (PowerShell): $env:PORT="4001"; npm run dev');
      } else {
        console.error('✗ Failed to bind HTTP server:', err);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    if (!process.env.DATABASE_URL) {
      console.error('✱ Missing DATABASE_URL. Set it in .env or .env.development');
    }
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
