import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@rxova/journey-core", "@rxova/journey-react"],
  eslint: { ignoreDuringBuilds: true }
};

export default config;
