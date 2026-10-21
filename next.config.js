// Translations (next-intl): the request's language and messages come from
// src/i18n/request.ts.
const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts')

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
    // sharp/libheif on our server (a critical AVIF RCE, GHSA-2xp9-vwfh-vxw4,
    // was only fixed in 15.5.24; we are on 15.5.28), and the old
    // `remotePatterns: [{ hostname: '**' }]` let anyone point it at any
    // image on the internet. next/image renders a plain <img src>. If it is
    // ever re-enabled, list only hosts attackers cannot upload to (never
    // '**', never all of a shared host such as res.cloudinary.com).
    // src/lib/security/next-config.test.ts guards this.
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = withNextIntl(nextConfig)
