# Render Deployment Notes

## Build Command

npm install && npm run build && npx prisma migrate deploy

## Start Command

npm start

## Required Environment Variables

- NODE_ENV=production
- PORT=10000
- DATABASE_URL=<your-postgres-connection-string>
- JWT_SECRET=<long-random-secret>
- CORS_ORIGINS=https://admin.mahallem.live,https://seller.mahallem.live,https://musteri.mahallem.live
- IMAGE_CLEANER_URL=https://image.mahallem.live/clean-image
- IMAGE_CLEANER_HEALTH_URL=https://image.mahallem.live/health

## Optional but Recommended

- REDIS_URL=<managed-redis-url>
- PRODUCT_PROCESSING_QUEUE_ENABLED=1
- PRODUCT_PROCESSING_FALLBACK_ENABLED=1
- PRODUCT_PROCESSING_QUEUE_BOOT_STRICT=0
- PRODUCT_PROCESSING_WORKER_CONCURRENCY=2
- PRODUCT_PROCESSING_JOB_TIMEOUT_MS=120000

## Optional Image Cleaner Variables

- IMAGE_CLEANER_BOOT_REQUIRED=0
- IMAGE_CLEANER_BOOT_STRICT=0
- IMAGE_CLEANER_BOOT_TIMEOUT_MS=20000
- IMAGE_CLEANER_AUTO_ENSURE=0
- IMAGE_CLEANER_STRICT=0
- IMAGE_CLEANER_ENSURE_SCRIPT=

## Notes

- Server binds to 0.0.0.0 and uses process.env.PORT.
- /health returns {"status":"ok"}.
- If REDIS_URL is missing, backend falls back to in-memory product processing queue mode.
- Image cleaner boot checks are non-blocking for server startup.
- If image service is down during product upload, backend performs controlled fallback instead of crashing boot.
