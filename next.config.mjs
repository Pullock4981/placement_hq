import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @param {string} phase */
const createNextConfig = (phase) => ({
  // Keep development chunks separate from production builds. Running `next build`
  // while a local dev server is open must not invalidate the CSS files it serves.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  // Prevent googleapis (and its transitive deps) from being bundled by webpack.
  // They rely on Node.js built-ins that are not available in the browser bundle.
  // Next.js 14 uses `experimental.serverComponentsExternalPackages`; the top-level
  // `serverExternalPackages` key is Next.js 15+. Using the correct key for v14:
  experimental: {
    serverComponentsExternalPackages: [
      'googleapis',
      'google-auth-library',
      'pdf-parse',
      'pdfjs-dist',
      '@napi-rs/canvas',
    ],
  },
  optimizeFonts: false,

  eslint: {
    // Prevent lint warnings in test files from failing production builds on Vercel
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
});

export default createNextConfig;
