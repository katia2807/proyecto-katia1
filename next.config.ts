import type { NextConfig } from "next";

/** Solo el build de la imagen Docker define `NEXT_STANDALONE=1`. Vercel y CI usan salida estándar de Next. */
const useStandalone = process.env.NEXT_STANDALONE === "1";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  ...(useStandalone ? { output: "standalone" as const } : {}),
};

export default nextConfig;
