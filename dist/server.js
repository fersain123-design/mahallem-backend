"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/env");
require("./types/express");
const app_1 = __importDefault(require("./app"));
const db_1 = __importStar(require("./config/db"));
const spatialService_1 = require("./services/spatialService");
const productProcessingQueue_1 = require("./services/productProcessingQueue");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const child_process_1 = require("child_process");
const parsedPort = Number(process.env.PORT || 4000);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000;
const HOST = '0.0.0.0';
const IMAGE_CLEANER_BOOT_REQUIRED = String(process.env.IMAGE_CLEANER_BOOT_REQUIRED || '0') !== '0';
const IMAGE_CLEANER_BOOT_STRICT = String(process.env.IMAGE_CLEANER_BOOT_STRICT || '0') === '1';
const IMAGE_CLEANER_BOOT_TIMEOUT_MS = Number(process.env.IMAGE_CLEANER_BOOT_TIMEOUT_MS || 20000);
const IMAGE_CLEANER_HEALTH_URL = process.env.IMAGE_CLEANER_HEALTH_URL?.trim() || '';
const IMAGE_CLEANER_ENSURE_SCRIPT = process.env.IMAGE_CLEANER_ENSURE_SCRIPT?.trim() || path_1.default.join(path_1.default.resolve(__dirname, '..'), 'scripts', 'ensure_image_cleaner.js');
const withTimeout = async (promise, ms, message) => {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
        return (await Promise.race([promise, timeoutPromise]));
    }
    finally {
        if (timeoutHandle)
            clearTimeout(timeoutHandle);
    }
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isImageCleanerHealthy = async () => {
    if (!IMAGE_CLEANER_HEALTH_URL) {
        return false;
    }
    try {
        const target = new URL(IMAGE_CLEANER_HEALTH_URL);
        const requestModule = target.protocol === 'https:' ? https_1.default : http_1.default;
        return await new Promise((resolve) => {
            const req = requestModule.request({
                method: 'GET',
                protocol: target.protocol,
                hostname: target.hostname,
                port: target.port,
                path: `${target.pathname}${target.search}`,
                timeout: 1500,
            }, (res) => resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300));
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        });
    }
    catch {
        return false;
    }
};
const runImageCleanerEnsureScript = async () => {
    if (!fs_1.default.existsSync(IMAGE_CLEANER_ENSURE_SCRIPT)) {
        throw new Error(`Image cleaner ensure script not found: ${IMAGE_CLEANER_ENSURE_SCRIPT}`);
    }
    await new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(process.execPath, [IMAGE_CLEANER_ENSURE_SCRIPT], {
            cwd: path_1.default.resolve(__dirname, '..'),
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
const ensureImageCleanerAtBoot = async () => {
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
const kickoffImageCleanerBoot = () => {
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
        await withTimeout(db_1.default.$connect(), 30000, 'Database connection timed out (30s).');
        await (0, db_1.ensureSqliteCompatibility)();
        console.log('✓ Database connected successfully');
        await (0, productProcessingQueue_1.startProductProcessingWorker)();
        const server = app_1.default.listen(PORT, HOST, () => {
            console.log(`
╔════════════════════════════════════════════╗
    ║      Mahallem Backend Server Started       ║
║         http://${HOST}:${PORT}                 ║
╚════════════════════════════════════════════╝
      `);
            kickoffImageCleanerBoot();
            // Server başlar başlamaz GeoJSON'u R-Tree'ye yükle
            try {
                spatialService_1.spatialService.loadGeoJSON('neighborhoods.geojson');
            }
            catch (err) {
                console.error('GeoJSON yüklenemedi, spatial index devre dışı:', err);
            }
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`✗ Port ${PORT} is already in use.`);
                console.error(`✱ Stop the running backend process on port ${PORT}, or start with another port.`);
                console.error('✱ Example (PowerShell): $env:PORT="4001"; npm run dev');
            }
            else {
                console.error('✗ Failed to bind HTTP server:', err);
            }
            process.exit(1);
        });
    }
    catch (error) {
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
    await db_1.default.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await db_1.default.$disconnect();
    process.exit(0);
});
startServer();
