import * as Sentry from '@sentry/nextjs';

/**
 * Sentry — Edge runtime config.
 *
 * Runs inside middleware and edge route handlers. Keep this minimal — the
 * edge runtime has limited APIs.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  debug: false,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
