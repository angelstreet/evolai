const path = require('node:path');

const isDev = process.env.NODE_ENV !== 'production';

// Next.js App Router emits inline bootstrap scripts, so script-src needs 'unsafe-inline' until the
// app moves to per-request nonces. Everything else is locked to the same origin (ADR 0032).
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Local runs on a shared, memory-tight host may skip the in-build lint and typecheck, which CI
  // runs as their own steps anyway (`pnpm lint`, `pnpm typecheck`). Deploys never set this.
  eslint: { ignoreDuringBuilds: process.env['NEXT_SKIP_BUILD_CHECKS'] === '1' },
  typescript: { ignoreBuildErrors: process.env['NEXT_SKIP_BUILD_CHECKS'] === '1' },
  poweredByHeader: false,
  async redirects() {
    // evolai.io/app opens the Evolai operations app (Frappe + ERPNext, separate repo angelstreet/evolai_app), hosted on the
    // owner's proxmox3 VM 390 behind app.evolai.io. Temporary (307) so the target can change without browsers caching it.
    return [
      { source: '/app', destination: 'https://app.evolai.io/', permanent: false },
      { source: '/app/:path*', destination: 'https://app.evolai.io/evolai/:path*', permanent: false },
    ];
  },
  async rewrites() {
    // Browsers ask for /favicon.ico on their own; serve the kit's icon instead of a copy (TASK-AD2).
    return [{ source: '/favicon.ico', destination: '/brand/kit/02_Icons/favicon.ico' }];
  },
  async headers() {
    const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/admin/:path*', headers: noindex },
      { source: '/login', headers: noindex },
      { source: '/board', headers: noindex },
      { source: '/api/:path*', headers: noindex },
    ];
  },
  transpilePackages: [
    // M10: server actions import Zod schemas from @evolai/contracts, whose source uses
    // NodeNext-style `.js` import specifiers. Webpack does not rewrite those to `.ts`, so
    // we transpile the package from source. (M3 + M5 + M6 + M7 + M8 did not exercise this
    // path because the server action layer only landed in M10.)
    '@evolai/contracts',
    '@evolai/domain',
    // TASK-C: web imports catalogs from @evolai/i18n and mascots from @evolai/ui; both are
    // consumed from source with NodeNext-style specifiers.
    '@evolai/i18n',
    '@evolai/ui',
  ],
  webpack(config) {
    // The contracts / domain packages use NodeNext import specifiers (`./team.js`). Webpack
    // resolves them literally. Tell it to fall back to the TypeScript source.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
  experimental: {
    // No PWA / no extra instrumentation: M5 only renders the employee mobile survey.
    // TASK-V (ADR 0042): pdfkit runs from node_modules (it reads its own files at run time), and
    // the report PDF routes ship the two Inter files of the design system with the function.
    serverComponentsExternalPackages: ['pdfkit'],
    outputFileTracingRoot: path.join(__dirname, '..', '..'),
    outputFileTracingIncludes: {
      '/admin/reports/[engagementId]/pdf': ['../../packages/ui/pdf-fonts/inter-latin-*.ttf'],
      '/client/report/pdf': ['../../packages/ui/pdf-fonts/inter-latin-*.ttf'],
    },
  },
};

module.exports = nextConfig;
