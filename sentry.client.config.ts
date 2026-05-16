import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Registrar 10% de transacciones en producción, 100% en dev
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Replay de sesión solo cuando hay error (costo mínimo)
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}
