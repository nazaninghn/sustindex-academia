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
    remotePatterns: [],
  },
}

module.exports = nextConfig
