import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@node-rs/argon2', 'pg'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
