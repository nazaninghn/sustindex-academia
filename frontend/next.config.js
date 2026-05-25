/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  },
  images: {
    // Allow local /assets/ images (served from public/)
    unoptimized: false,
    remotePatterns: [],
  },
}

module.exports = nextConfig
