import express, { Application } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import customerRoutes from './routes/customerRoutes';
import vendorRoutes from './routes/vendorRoutes';
import adminRoutes from './routes/adminRoutes';
import supportRoutes from './routes/supportRoutes';
import chatRoutes from './routes/chatRoutes';
import locationRoutes from './routes/locationRoutes';
import paymentRoutes from './routes/paymentRoutes';
import settingsRoutes from './routes/settingsRoutes';
import { createPaymentModule } from './modules/payment/payment.module';
import * as customerController from './controllers/customerController';
import { resolveLocation, getLocationStats } from './controllers/locationController';
import { authMiddleware } from './middleware/authMiddleware';
import { requireRole } from './middleware/requireRole';

const app: Application = express();
const isProduction = process.env.NODE_ENV === 'production';
const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '');
const corsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
const allowAnyOrigin = corsOrigins.includes('*') || (!isProduction && corsOrigins.length === 0);

if (isProduction && corsOrigins.length === 0) {
  console.warn('CORS_ORIGINS is empty in production; only same-origin requests without Origin header will be allowed.');
}

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(5, Number(process.env.AUTH_RATE_LIMIT_MAX || 20)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Cok fazla giris denemesi. Lutfen daha sonra tekrar deneyin.',
  },
});

// Middleware
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowAnyOrigin || corsOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  })
);
// Increase body size limit for base64 document uploads (default is 100KB, documents can be 500KB+)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes
app.use('/api/auth', authRateLimit);
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.post('/api/location/resolve', resolveLocation);
app.get('/api/location/stats', getLocationStats);
app.use('/api/payment', paymentRoutes);
app.use('/api', createPaymentModule());
app.use('/api/settings', settingsRoutes);

// Public catalog aliases (customer app uses /api/products and /api/categories)
app.get('/api/categories', customerController.getCategories);
app.get('/api/products', customerController.getProducts);
app.get('/api/products/best-sellers', customerController.getBestSellerProducts);
app.get('/api/products/:id', customerController.getProductById);
app.get('/api/products/:id/reviews', customerController.getProductReviews);
app.post(
  '/api/products/:id/reviews',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.addProductReview
);

// Neighborhood live stats (real data)
app.get('/api/neighborhood/stats', customerController.getNeighborhoodLiveStats);

// Vendor list aliases (customer app uses /api/vendors/all)
app.get('/api/vendors', customerController.getVendors);
app.get('/api/vendors/all', customerController.getVendors);
app.get('/api/vendors/nearby', customerController.getVendors);
app.get('/api/vendors/:id/ratings/summary', customerController.getVendorRatingsSummary);
app.get('/api/vendors/:id/ratings', customerController.getVendorRatings);
app.get('/api/vendors/:id', customerController.getVendorById);

app.use('/api/customer', customerRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/admin', adminRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Not found',
  });
});

export default app;
