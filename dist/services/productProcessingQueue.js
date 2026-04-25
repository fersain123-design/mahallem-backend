"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProductProcessingQueueEnabled = exports.enqueueProductProcessingJob = exports.startProductProcessingWorker = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const db_1 = __importDefault(require("../config/db"));
const productImageProcessingService_1 = require("./productImageProcessingService");
const QUEUE_NAME = 'product-image-processing';
const QUEUE_ENABLED = String(process.env.PRODUCT_PROCESSING_QUEUE_ENABLED || '1') !== '0';
const QUEUE_BOOT_STRICT = String(process.env.PRODUCT_PROCESSING_QUEUE_BOOT_STRICT || '0') === '1';
const QUEUE_FALLBACK_ENABLED = String(process.env.PRODUCT_PROCESSING_FALLBACK_ENABLED || '1') !== '0';
const REDIS_URL = process.env.REDIS_URL?.trim() || '';
const PRODUCT_PROCESSING_JOB_TIMEOUT_MS = Math.max(15000, Number(process.env.PRODUCT_PROCESSING_JOB_TIMEOUT_MS || 120000));
let redisConnection = null;
let processingQueue = null;
let processingWorker = null;
let queueDegradedToFallback = false;
let queueDegradedLogged = false;
const fallbackInFlightJobs = new Set();
const defaultJobOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2000,
    },
    removeOnComplete: 200,
    removeOnFail: 400,
};
const withJobTimeout = async (payload) => {
    await Promise.race([
        processJobWithStatus(payload),
        new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`product processing timed out after ${PRODUCT_PROCESSING_JOB_TIMEOUT_MS}ms`));
            }, PRODUCT_PROCESSING_JOB_TIMEOUT_MS);
        }),
    ]);
};
const getRedisConnection = () => {
    if (!REDIS_URL) {
        throw new Error('REDIS_URL is not set');
    }
    if (!redisConnection) {
        redisConnection = new ioredis_1.default(REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
            lazyConnect: true,
            retryStrategy: () => null,
            reconnectOnError: () => false,
            enableOfflineQueue: false,
        });
        // Ignore low-level connection errors here; we handle fallback centrally.
        redisConnection.on('error', () => undefined);
    }
    return redisConnection;
};
const getQueue = async () => {
    if (!QUEUE_ENABLED) {
        throw new Error('Product processing queue is disabled');
    }
    if (queueDegradedToFallback) {
        throw new Error('Product processing queue is running in fallback mode');
    }
    if (!processingQueue) {
        const connection = getRedisConnection();
        if (connection.status === 'wait') {
            await connection.connect();
        }
        processingQueue = new bullmq_1.Queue(QUEUE_NAME, {
            connection,
            defaultJobOptions,
        });
    }
    return processingQueue;
};
const processJob = async (payload) => {
    const product = await db_1.default.product.findUnique({
        where: { id: payload.productId },
        select: { id: true },
    });
    if (!product) {
        return;
    }
    const urls = [];
    for (let idx = 0; idx < payload.imageJobs.length; idx += 1) {
        const imageJob = payload.imageJobs[idx];
        const url = await (0, productImageProcessingService_1.processQueuedProductImage)(imageJob, `${payload.vendorId}_${payload.productId}_${idx + 1}`);
        urls.push(url);
    }
    if (urls.length === 0) {
        throw new Error('No valid image produced for product');
    }
    await db_1.default.product.update({
        where: { id: payload.productId },
        data: {
            imageUrl: urls[0],
            isActive: true,
            approvalStatus: 'APPROVED',
            images: {
                deleteMany: {},
                create: urls.map((imageUrl, index) => ({
                    imageUrl,
                    sortOrder: index,
                })),
            },
        },
    });
};
const processJobWithStatus = async (payload) => {
    try {
        await processJob(payload);
    }
    catch (error) {
        await db_1.default.product
            .update({
            where: { id: payload.productId },
            data: {
                isActive: false,
                approvalStatus: 'REJECTED',
            },
        })
            .catch(() => undefined);
        throw error;
    }
};
const runFallbackJob = (payload) => {
    const jobId = `fallback:product:${payload.productId}`;
    if (fallbackInFlightJobs.has(jobId)) {
        return jobId;
    }
    fallbackInFlightJobs.add(jobId);
    setImmediate(async () => {
        try {
            await withJobTimeout(payload);
            console.log(`[queue:fallback] product processing completed: ${jobId}`);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[queue:fallback] product processing failed: ${jobId} - ${msg}`);
        }
        finally {
            fallbackInFlightJobs.delete(jobId);
        }
    });
    return jobId;
};
const startProductProcessingWorker = async () => {
    if (!QUEUE_ENABLED || processingWorker) {
        return;
    }
    if (!REDIS_URL) {
        if (QUEUE_FALLBACK_ENABLED) {
            queueDegradedToFallback = true;
            if (!queueDegradedLogged) {
                console.warn('[queue] REDIS_URL is missing, switched to in-memory fallback mode.');
                queueDegradedLogged = true;
            }
            return;
        }
        if (QUEUE_BOOT_STRICT) {
            throw new Error('REDIS_URL is required when PRODUCT_PROCESSING_FALLBACK_ENABLED=0');
        }
        console.warn('[queue] REDIS_URL is missing, queue disabled at runtime.');
        return;
    }
    try {
        const queue = await getQueue();
        const connection = getRedisConnection();
        processingWorker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
            await withJobTimeout(job.data);
        }, {
            connection,
            concurrency: Math.max(1, Number(process.env.PRODUCT_PROCESSING_WORKER_CONCURRENCY || 2)),
        });
        processingWorker.on('completed', (job) => {
            console.log(`[queue] product processing completed: ${job.id}`);
        });
        processingWorker.on('failed', (job, err) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[queue] product processing failed: ${job?.id || 'unknown'} - ${msg}`);
        });
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
        console.log('[queue] product-image-processing worker ready', counts);
    }
    catch (error) {
        const message = String(error?.message || error);
        if (QUEUE_BOOT_STRICT) {
            throw error;
        }
        if (QUEUE_FALLBACK_ENABLED) {
            queueDegradedToFallback = true;
            if (!queueDegradedLogged) {
                console.warn(`[queue] Redis unavailable, switched to in-memory fallback mode: ${message}`);
                queueDegradedLogged = true;
            }
            return;
        }
        console.warn(`[queue] worker startup failed, queue disabled at runtime: ${message}`);
    }
};
exports.startProductProcessingWorker = startProductProcessingWorker;
const enqueueProductProcessingJob = async (payload) => {
    if (!QUEUE_ENABLED) {
        if (!QUEUE_FALLBACK_ENABLED) {
            throw new Error('Product processing queue is disabled');
        }
        return runFallbackJob(payload);
    }
    if (queueDegradedToFallback) {
        return runFallbackJob(payload);
    }
    if (!REDIS_URL) {
        if (!QUEUE_FALLBACK_ENABLED) {
            throw new Error('REDIS_URL is required when product processing fallback is disabled');
        }
        queueDegradedToFallback = true;
        return runFallbackJob(payload);
    }
    try {
        const queue = await getQueue();
        const job = await queue.add('process-product-images', payload, {
            jobId: `product:${payload.productId}`,
        });
        return String(job.id || `product:${payload.productId}`);
    }
    catch (error) {
        if (!QUEUE_FALLBACK_ENABLED) {
            throw error;
        }
        queueDegradedToFallback = true;
        if (!queueDegradedLogged) {
            const message = String(error?.message || error);
            console.warn(`[queue] enqueue failed, switched to in-memory fallback mode: ${message}`);
            queueDegradedLogged = true;
        }
        return runFallbackJob(payload);
    }
};
exports.enqueueProductProcessingJob = enqueueProductProcessingJob;
const isProductProcessingQueueEnabled = () => QUEUE_ENABLED || QUEUE_FALLBACK_ENABLED;
exports.isProductProcessingQueueEnabled = isProductProcessingQueueEnabled;
