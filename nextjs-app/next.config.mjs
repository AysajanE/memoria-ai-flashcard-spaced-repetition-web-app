/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    serverComponentsExternalPackages: ['postgres'],
  },
  reactStrictMode: true,
  // Set the default runtime for route handlers
  serverRuntimeConfig: {
    runtime: 'nodejs'
  }
};

export default nextConfig; 