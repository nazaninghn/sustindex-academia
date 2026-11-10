/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Fix C-1: must be the bare origin — no /api/v1 suffix.
    // api.ts builds every path as `${API_URL}/api/v1/...`, so adding /api/v1 here
    // would produce double-prefixed URLs like /api/v1/api/v1/surveys/ → 404.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  images: {
    // Allow local /assets/ images (served from public/)
    unoptimized: false,
    remotePatterns: [
      // Landing page photography (Mission collage + How We Help carousel) —
      // all free-license Unsplash photos, verified individually.
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

// Authenticated pages must never be served from the browser's HTTP cache or its back/forward cache,
// so Back after logout / session expiry cannot reveal a stale private page.
const PRIVATE = ['/dashboard', '/surveys', '/questionnaire', '/results', '/history', '/action-plan',
                 '/compare', '/courses', '/documents', '/profile', '/admin'];
nextConfig.headers = async () => PRIVATE.flatMap((p) => [p, `${p}/:path*`].map((source) => ({
  source,
  headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
})));

module.exports = nextConfig
