import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      // Legacy v1 redirects (keep — existing bookmarks)
      {
        source: '/resultados-v2',
        destination: '/resultados',
        permanent: true,
      },
      {
        source: '/resultados-v2/:path*',
        destination: '/resultados/:path*',
        permanent: true,
      },
      // S0: radar-v2 → comercial bounded context rename (301)
      {
        source: '/radar-v2/vivo',
        destination: '/en-vivo',
        permanent: true,
      },
      {
        source: '/radar-v2/:path*',
        destination: '/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
