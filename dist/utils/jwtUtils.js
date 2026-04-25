"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '12h';
const WEAK_JWT_SECRETS = new Set(['your-secret-key', 'dev-secret-change-me', 'changeme', 'secret']);
const assertJwtSecret = () => {
    const normalizedSecret = String(JWT_SECRET || '').trim();
    if (!normalizedSecret) {
        throw new Error('JWT_SECRET is missing. Set a strong secret in environment variables.');
    }
    const isWeak = normalizedSecret.length < 32 || WEAK_JWT_SECRETS.has(normalizedSecret);
    if (isWeak && process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is too weak for production. Use at least 32 random characters.');
    }
    if (isWeak) {
        console.warn('Security warning: JWT_SECRET is weak. Use at least 32 random characters.');
    }
};
assertJwtSecret();
const generateToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRATION,
    });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        throw new Error('Invalid or expired token');
    }
};
exports.verifyToken = verifyToken;
