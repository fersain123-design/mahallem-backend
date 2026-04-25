"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureHashMatch = exports.generateResetSessionToken = exports.hashSecret = exports.generateOtpCode = void 0;
const crypto_1 = __importDefault(require("crypto"));
const generateOtpCode = () => {
    const code = crypto_1.default.randomInt(0, 1000000);
    return code.toString().padStart(6, '0');
};
exports.generateOtpCode = generateOtpCode;
const hashSecret = (value) => {
    return crypto_1.default.createHash('sha256').update(String(value)).digest('hex');
};
exports.hashSecret = hashSecret;
const generateResetSessionToken = () => {
    return crypto_1.default.randomBytes(32).toString('hex');
};
exports.generateResetSessionToken = generateResetSessionToken;
const secureHashMatch = (incoming, storedHashHex) => {
    const incomingHash = (0, exports.hashSecret)(incoming);
    const incomingBuffer = Buffer.from(incomingHash, 'hex');
    const storedBuffer = Buffer.from(String(storedHashHex || ''), 'hex');
    if (incomingBuffer.length !== storedBuffer.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(incomingBuffer, storedBuffer);
};
exports.secureHashMatch = secureHashMatch;
