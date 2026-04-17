import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbopack: {
      root: __dirname,
    },
  },
  async redirects() {
    return [
      {
        source: '/resultados-v2',
        destination: '/radar-v2/resultados',
        permanent: true,
      },
      {
        source: '/resultados-v2/:path*',
        destination: '/radar-v2/resultados/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
