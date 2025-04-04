/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // If you rely on 'postgres' in Server Components (though preferred via actions/routes)
    serverComponentsExternalPackages: ["postgres"], 
  },
  reactStrictMode: true,
  // serverRuntimeConfig has been removed as per previous feedback
};

module.exports = nextConfig;