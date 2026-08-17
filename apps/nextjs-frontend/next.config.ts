import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ['@sdr/shared'],
  outputFileTracingRoot: path.join(appDir, '../..'),
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  async rewrites() {
    const origin = process.env.API_PROXY_ORIGIN?.replace(/\/$/, '');
    if (!origin) {
      return [];
    }

    return [
      {
        source: '/backend/:path*',
        destination: `${origin}/:path*`,
      },
    ];
  },
  async headers() {
    const privatePage = [
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ];

    return [
      {
        source: '/drive',
        headers: [
          ...privatePage,
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        source: '/share',
        headers: [
          ...privatePage,
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default nextConfig;
