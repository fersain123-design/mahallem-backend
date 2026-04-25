"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateIyzicoAuthorizationHeader = void 0;
const crypto_1 = __importDefault(require("crypto"));
const generateIyzicoAuthorizationHeader = (args) => {
    const randomKey = args.randomKey || `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    const payload = `${randomKey}${args.uriPath}${args.requestBody}`;
    const signature = crypto_1.default
        .createHmac('sha256', args.secretKey)
        .update(payload)
        .digest('hex');
    const authValue = `apiKey:${args.apiKey}&randomKey:${randomKey}&signature:${signature}`;
    const authorization = `IYZWSv2 ${Buffer.from(authValue).toString('base64')}`;
    return { randomKey, authorization, signature };
};
exports.generateIyzicoAuthorizationHeader = generateIyzicoAuthorizationHeader;
