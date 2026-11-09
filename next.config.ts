import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingExcludes: {
    '/*': ['./.local/**/*', './research/**/*', './docs/**/*', './test/**/*', './pocs/**/*', './scripts/**/*', './infra/**/*'],
  },
  poweredByHeader: false,
  rewrites() {
    const backend = process.env['DEMO_BACKEND_URL'];
    if (!backend) return [];
    const url = new URL(backend);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('DEMO_BACKEND_URL must be an HTTPS origin');
    // Vercel serves the UI; the existing persistent Docker app owns all API state.
    return { beforeFiles: [{ source: '/api/:path*', destination: `${url.origin}/api/:path*` }], afterFiles: [], fallback: [] };
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'" + (process.env['NODE_ENV'] === 'development' ? " 'unsafe-eval'" : '') + "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" },
    ] }];
  },
};
export default config;
