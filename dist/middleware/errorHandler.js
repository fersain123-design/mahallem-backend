"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const zod_1 = require("zod");
class AppError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
const errorHandler = (error, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) => {
    console.error('Error:', error);
    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            success: false,
            message: error.message,
        });
        return;
    }
    if (error instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(isProd
            ? {}
            : {
                error: {
                    name: error?.name,
                    message: error?.message,
                },
            }),
    });
};
exports.errorHandler = errorHandler;
