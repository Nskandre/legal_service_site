import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(process.env.TIMEWEB_BUILD === "1"
    ? {
        turbopack: {
          resolveAlias: {
            "@runtime/database": "./app/lib/database-postgres.ts",
            "@runtime/environment": "./app/lib/environment-node.ts",
          },
        },
      }
    : {}),
};

export default nextConfig;
