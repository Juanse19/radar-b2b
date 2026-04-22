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
    ];
  },
};

export default nextConfig;
