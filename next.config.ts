import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/** Solo la imagen Docker define `KATIA_DOCKER_BUILD=1` (evita colisión con vars en Vercel). */
const useStandalone = process.env.KATIA_DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  ...(process.env.KATIA_VISUAL_PREVIEW === "1" && process.env.KATIA_USE_DEMO_DB === "1" ? { devIndicators: false as const } : {}),
  ...(useStandalone ? { output: "standalone" as const } : {}),
};

const hasSentryDsn = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export default hasSentryDsn
  ? withSentryConfig(nextConfig, {
      silent: false,
      sourcemaps: { disable: false },
      widenClientFileUpload: true,
    })
  : nextConfig;
