import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['steel-sdk', 'playwright-core'],
  // Playwright loads browsers.json and runtime assets dynamically. Vercel's
  // dependency tracer cannot infer these paths through pnpm's symlink layout.
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**/*',
    ],
  },
  allowedDevOrigins:['100.121.141.15','oracle.lemming-vector.ts.net'],
};
export default config;
