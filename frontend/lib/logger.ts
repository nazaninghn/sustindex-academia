// Fix R4-H-04: environment-gated logger.
//
// In development (NODE_ENV === 'development') all levels pass through to the
// browser console. In production the functions are silent no-ops so error
// details are never exposed to end users.
//
// Usage:
//   import logger from '@/lib/logger';
//   logger.error('Failed to load courses', err);

const isDev = process.env.NODE_ENV !== 'production';

/* eslint-disable no-console */
const logger = {
  log:   (...args: unknown[]) => { if (isDev) console.log(...args);   },
  warn:  (...args: unknown[]) => { if (isDev) console.warn(...args);  },
  error: (...args: unknown[]) => { if (isDev) console.error(...args); },
};
/* eslint-enable no-console */

export default logger;
