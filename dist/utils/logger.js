"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const rawLevel = String(process.env.LOG_LEVEL || '').trim().toLowerCase();
const LOG_LEVEL = rawLevel === 'debug' || rawLevel === 'error' ? rawLevel : 'info';
const LEVEL_ORDER = {
    debug: 10,
    info: 20,
    error: 30,
};
const shouldLog = (target) => {
    return LEVEL_ORDER[target] >= LEVEL_ORDER[LOG_LEVEL];
};
exports.logger = {
    debug: (message, meta) => {
        if (!shouldLog('debug'))
            return;
        if (meta === undefined) {
            console.debug(message);
            return;
        }
        console.debug(message, meta);
    },
    info: (message, meta) => {
        if (!shouldLog('info'))
            return;
        if (meta === undefined) {
            console.info(message);
            return;
        }
        console.info(message, meta);
    },
    error: (message, meta) => {
        if (!shouldLog('error'))
            return;
        if (meta === undefined) {
            console.error(message);
            return;
        }
        console.error(message, meta);
    },
    level: LOG_LEVEL,
};
