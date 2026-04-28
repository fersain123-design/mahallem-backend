type LogLevel = 'debug' | 'info' | 'error';

const rawLevel = String(process.env.LOG_LEVEL || '').trim().toLowerCase();
const LOG_LEVEL: LogLevel = rawLevel === 'debug' || rawLevel === 'error' ? (rawLevel as LogLevel) : 'info';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  error: 30,
};

const shouldLog = (target: LogLevel): boolean => {
  return LEVEL_ORDER[target] >= LEVEL_ORDER[LOG_LEVEL];
};

export const logger = {
  debug: (message: string, meta?: unknown) => {
    if (!shouldLog('debug')) return;
    if (meta === undefined) {
      console.debug(message);
      return;
    }
    console.debug(message, meta);
  },

  info: (message: string, meta?: unknown) => {
    if (!shouldLog('info')) return;
    if (meta === undefined) {
      console.info(message);
      return;
    }
    console.info(message, meta);
  },

  error: (message: string, meta?: unknown) => {
    if (!shouldLog('error')) return;
    if (meta === undefined) {
      console.error(message);
      return;
    }
    console.error(message, meta);
  },

  level: LOG_LEVEL,
};
