import type { NextConfig } from 'next';

// When media is served from the R2 bucket's domain (not /mock-media), let
// next/image optimise images from it.
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? '';
const remoteMedia = /^https?:\/\//.test(mediaBase)
  ? [new URL(`${mediaBase.replace(/\/+$/, '')}/**`)]
  : [];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Stores and the dashboard run on subdomains of localhost in development
  // (saree-demo.localhost, app.localhost).
  allowedDevOrigins: ['*.localhost'],
  images: {
    remotePatterns: remoteMedia,
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
