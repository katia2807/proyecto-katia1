import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  /**
   * `standalone` sirve para `npm run start` / Docker (`node .next/standalone/server.js`).
   * Vercel inyecta `VERCEL=1` en el build: ahí no debe usarse standalone o el deploy suele
   * responder 404 NOT_FOUND en la raíz (el runtime serverless no arranca como ese bundle).
   */
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
};

export default nextConfig;
