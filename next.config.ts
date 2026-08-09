import type {NextConfig} from 'next';
import path from 'node:path';

/**
 * Version = build date, encoded as YY M D with no leading zeros: a build made
 * on 2026-08-07 is `2687`. Computed here rather than stored as a constant so it
 * can never be stale, and exposed as an env var because a static export has no
 * server to ask at runtime. Kept in sync with `Edu-task/lib/version.ts`, which
 * is what the app reads.
 */
function buildVersion(): string {
  const now = new Date();
  return `${now.getFullYear() % 100}${now.getMonth() + 1}${now.getDate()}`;
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd()),
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: buildVersion(),
  },
  eslint: {
    // Linting gates the build again. It was disabled, which is how dozens of
    // unused imports accumulated unnoticed.
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'export',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify - file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
