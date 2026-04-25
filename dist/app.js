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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const errorHandler_1 = require("./middleware/errorHandler");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const customerRoutes_1 = __importDefault(require("./routes/customerRoutes"));
const vendorRoutes_1 = __importDefault(require("./routes/vendorRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const supportRoutes_1 = __importDefault(require("./routes/supportRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const settingsRoutes_1 = __importDefault(require("./routes/settingsRoutes"));
const payment_module_1 = require("./modules/payment/payment.module");
const customerController = __importStar(require("./controllers/customerController"));
const locationController_1 = require("./controllers/locationController");
const authMiddleware_1 = require("./middleware/authMiddleware");
const requireRole_1 = require("./middleware/requireRole");
const app = (0, express_1.default)();
const isProduction = process.env.NODE_ENV === 'production';
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, '');
const corsOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
const allowAnyOrigin = corsOrigins.includes('*') || (!isProduction && corsOrigins.length === 0);
if (isProduction && corsOrigins.length === 0) {
    console.warn('CORS_ORIGINS is empty in production; only same-origin requests without Origin header will be allowed.');
}
const authRateLimit = (0, express_rate_limit_1.default)({
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
app.use((0, cors_1.default)({
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
}));
// Increase body size limit for base64 document uploads (default is 100KB, documents can be 500KB+)
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Static uploads
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
// API Routes
app.use('/api/auth', authRateLimit);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/locations', locationRoutes_1.default);
app.post('/api/location/resolve', locationController_1.resolveLocation);
app.get('/api/location/stats', locationController_1.getLocationStats);
app.use('/api/payment', paymentRoutes_1.default);
app.use('/api', (0, payment_module_1.createPaymentModule)());
app.use('/api/settings', settingsRoutes_1.default);
// Public catalog aliases (customer app uses /api/products and /api/categories)
app.get('/api/categories', customerController.getCategories);
app.get('/api/products', customerController.getProducts);
app.get('/api/products/best-sellers', customerController.getBestSellerProducts);
app.get('/api/products/:id', customerController.getProductById);
app.get('/api/products/:id/reviews', customerController.getProductReviews);
app.post('/api/products/:id/reviews', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.addProductReview);
// Neighborhood live stats (real data)
app.get('/api/neighborhood/stats', customerController.getNeighborhoodLiveStats);
// Vendor list aliases (customer app uses /api/vendors/all)
app.get('/api/vendors', customerController.getVendors);
app.get('/api/vendors/all', customerController.getVendors);
app.get('/api/vendors/nearby', customerController.getVendors);
app.get('/api/vendors/:id/ratings/summary', customerController.getVendorRatingsSummary);
app.get('/api/vendors/:id/ratings', customerController.getVendorRatings);
app.get('/api/vendors/:id', customerController.getVendorById);
app.use('/api/customer', customerRoutes_1.default);
app.use('/api/support', supportRoutes_1.default);
app.use('/api/chat', chatRoutes_1.default);
app.use('/api/vendor', vendorRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
// Error handling
app.use(errorHandler_1.errorHandler);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Not found',
    });
});
exports.default = app;
