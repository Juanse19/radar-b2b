import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // ─── Turbopack: silence workspace-root warning (using --webpack in dev) ─────
  turbopack: {},

  // ─── Fix: multiple lockfiles workspace-root warning ─────────────────────────
  outputFileTracingRoot: __dirname,

  // ─── Webpack: limit memory in dev ───────────────────────────────────────────
  webpack(config, { dev, isServer }) {
    if (dev) {
      // Exclude heavy directories from file watching (prevents RAM spike on Windows)
      config.watchOptions = {
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
          '**/dist/**',
        ],
        // Poll fallback only if FSEvents/inotify fails; 0 = use native watchers
        poll: false,
      };

      // Reduce in-memory cache size per compilation (default is unlimited)
      config.cache = {
        type: 'filesystem',
        maxMemoryGenerations: 1,
      };
    }
    return config;
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
