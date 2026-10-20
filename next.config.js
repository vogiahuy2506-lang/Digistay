/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` emits a self-contained server.js + minimal node_modules
  // tree into `.next/standalone`, which is what the production Docker
  // image actually runs. See Dockerfile (stage 3).
  output: 'standalone',
  // Don't advertise the framework (X-Powered-By: Next.js).
  poweredByHeader: false,
  images: {
    // Image optimization is OFF: /_next/image decodes untrusted images with
    // sharp/libheif on our server, and Next 14.x gets no fix for a critical
    // RCE there (GHSA-2xp9-vwfh-vxw4, AVIF) nor for several DoS issues; the
    // old `remotePatterns: [{ hostname: '**' }]` let anyone point it at any
    // image on the internet. next/image now renders a plain <img src>.
    // Re-enable only on Next >= 15.5.24, with a short remotePatterns list
    // that attackers cannot upload to (never '**', never all of a shared
    // host such as res.cloudinary.com). src/lib/security/next-config.test.ts
    // guards this.
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
