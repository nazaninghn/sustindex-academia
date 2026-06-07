/**
 * Fix R4-H-04: environment-gated logger.
 *
 * - In development (NODE_ENV === 'development') all levels are passed through
 *   to the browser console so developers see errors during local work.
 * - In production the functions are no-ops — errors are silently swallowed
 *   unless a reporting service (e.g. Sentry) is integrated.  To wire one up,
 *   replace the `/* TODO: report to Sentry */` comment below with the call.
 *
 * Usage:
 *   import logger from '@/lib/logger';
 *   logger.error('Failed to load courses', err);
 */

const isDev = process.env.NODE_ENV !== 'production';

const logger = {
  /* eslint-disable no-console */
  log:   (...args: unknown[]) => { if (isDev) console.log(...args);   },
  warn:  (...args: unknown[]) => { if (isDev) console.warn(...args);  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args);
    } else {
      // TODO: report to Sentry / other error monitoring service
      // e.g. Sentry.captureException(args[1] instanceof Error ? args[1] : new Error(String(args[0])));
    }
  },
  /* eslint-enable no-console */
};

export default logger;
