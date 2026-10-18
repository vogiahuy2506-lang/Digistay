/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` emits a self-contained server.js + minimal node_modules
  // tree into `.next/standalone`, which is what the production Docker
  // image actually runs. See Dockerfile (stage 3).
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
