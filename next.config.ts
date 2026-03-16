import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Forces Next.js to generate static HTML/CSS/JS
  images: {
    unoptimized: true, // Required because the mobile app can't optimize images on the fly
  }
};

export default nextConfig;
