import type { NextConfig } from "next";

/** Solo la imagen Docker define `KATIA_DOCKER_BUILD=1` (evita colisión con vars en Vercel). */
const useStandalone = process.env.KATIA_DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  ...(useStandalone ? { output: "standalone" as const } : {}),
};

export default nextConfig;
