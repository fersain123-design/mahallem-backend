"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMail = void 0;
const normalizeError = (error) => {
    if (!error) {
        return undefined;
    }
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return JSON.stringify(error);
};
const logMail = ({ to, subject, status, error }) => {
    const payload = {
        to,
        subject,
        status,
        error: normalizeError(error),
        timestamp: new Date().toISOString(),
    };
    console.log('[MAIL_LOG]', payload);
};
exports.logMail = logMail;
