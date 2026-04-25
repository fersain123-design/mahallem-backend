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
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.verifyOtp = exports.forgotPassword = exports.loginWithSupabase = exports.loginWithGoogle = exports.getCurrentUser = exports.verifyLoginOtp = exports.requestLoginOtp = exports.login = exports.register = void 0;
const authService = __importStar(require("../services/authService"));
const validationSchemas_1 = require("../utils/validationSchemas");
const register = async (req, res, next) => {
    try {
        const data = validationSchemas_1.RegisterSchema.parse(req.body);
        const result = await authService.registerUser(data);
        res.status(201).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const data = validationSchemas_1.LoginSchema.parse(req.body);
        const result = await authService.loginUser(data);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const requestLoginOtp = async (req, res, next) => {
    try {
        const data = validationSchemas_1.RequestLoginOtpSchema.parse(req.body);
        const result = await authService.requestLoginOtp(data, {
            ip: req.ip,
            userAgent: req.get('user-agent') || undefined,
        });
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.requestLoginOtp = requestLoginOtp;
const verifyLoginOtp = async (req, res, next) => {
    try {
        const data = validationSchemas_1.VerifyLoginOtpSchema.parse(req.body);
        const result = await authService.verifyLoginOtp(data);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyLoginOtp = verifyLoginOtp;
const getCurrentUser = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }
        const user = await authService.getCurrentUser(req.user.userId);
        res.status(200).json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCurrentUser = getCurrentUser;
const loginWithGoogle = async (req, res, next) => {
    try {
        const idToken = String(req.body?.token || req.body?.idToken || req.body?.credential || '').trim();
        if (!idToken) {
            res.status(400).json({
                success: false,
                message: 'Google token is required',
            });
            return;
        }
        const result = await authService.loginWithGoogle(idToken);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.loginWithGoogle = loginWithGoogle;
const loginWithSupabase = async (req, res, next) => {
    try {
        const accessToken = String(req.body?.token || req.body?.accessToken || '').trim();
        if (!accessToken) {
            res.status(400).json({
                success: false,
                message: 'Supabase token is required',
            });
            return;
        }
        const result = await authService.loginWithSupabaseAccessToken(accessToken);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.loginWithSupabase = loginWithSupabase;
const forgotPassword = async (req, res, next) => {
    try {
        const data = validationSchemas_1.ForgotPasswordSchema.parse(req.body);
        const result = await authService.forgotPassword(data, {
            ip: req.ip,
            userAgent: req.get('user-agent') || undefined,
        });
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.forgotPassword = forgotPassword;
const verifyOtp = async (req, res, next) => {
    try {
        const data = validationSchemas_1.VerifyOtpSchema.parse(req.body);
        const result = await authService.verifyPasswordResetOtp(data);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyOtp = verifyOtp;
const resetPassword = async (req, res, next) => {
    try {
        const data = validationSchemas_1.ResetPasswordSchema.parse(req.body);
        const result = await authService.resetPassword(data);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.resetPassword = resetPassword;
