"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jwtUtils_1 = require("../utils/jwtUtils");
const db_1 = __importDefault(require("../config/db"));
const ACCOUNT_SUSPEND_REASON_PREFIX = '[SUSPENDED]';
const SUSPENDED_VENDOR_MESSAGE = 'Hesabınız kötüye kullanıldığı için askıya alınmıştır. Size bir e-posta gönderdik.';
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'No token provided',
            });
            return;
        }
        const token = authHeader.substring(7);
        const decoded = (0, jwtUtils_1.verifyToken)(token);
        req.user = decoded;
        const dbUser = await db_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, isActive: true, role: true, deactivationReason: true },
        });
        if (!dbUser) {
            res.status(401).json({ success: false, message: 'User not found' });
            return;
        }
        if (dbUser.isActive === false) {
            const reason = String(dbUser.deactivationReason || '').trim();
            if (reason.startsWith(ACCOUNT_SUSPEND_REASON_PREFIX)) {
                res.status(403).json({ success: false, message: SUSPENDED_VENDOR_MESSAGE });
                return;
            }
            res.status(403).json({ success: false, message: 'Account is deactivated' });
            return;
        }
        next();
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
        });
    }
};
exports.authMiddleware = authMiddleware;
