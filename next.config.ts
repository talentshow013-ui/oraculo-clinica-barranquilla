import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El panel es local: sin telemetría ni imágenes remotas.
  images: { unoptimized: true },
};

export default nextConfig;
