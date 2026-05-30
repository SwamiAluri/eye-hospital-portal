/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile CornerstoneJS packages (they contain TypeScript source)
  transpilePackages: [
    '@cornerstonejs/core',
    '@cornerstonejs/tools',
    '@cornerstonejs/streaming-image-volume-loader',
    '@cornerstonejs/dicom-image-loader',
  ],
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // Enable WebAssembly support for CornerstoneJS
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
      layers: true,
    };
    
    // Treat WASM as static assets instead of modules
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    
    // Ignore node-specific modules in client-side bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
      };
    }
    
    // External CornerstoneJS WASM packages on server
    if (isServer) {
      config.externals = [...(config.externals || []), '@icr/polyseg-wasm'];
    }
    
    return config;
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Redirect duplicate /imaging/* routes to canonical /diagnostic/* routes
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/favicon.svg', permanent: false },
      { source: '/dashboard/imaging/oct', destination: '/dashboard/diagnostic/oct-imaging', permanent: true },
      { source: '/dashboard/imaging/biometry', destination: '/dashboard/diagnostic/biometry', permanent: true },
      { source: '/dashboard/imaging/electrophysiology', destination: '/dashboard/diagnostic/electrophysiology', permanent: true },
      { source: '/dashboard/imaging/retinopathy', destination: '/dashboard/diagnostic/retinopathy-screening', permanent: true },
      { source: '/dashboard/imaging/fundus', destination: '/dashboard/diagnostic/fundus-imaging', permanent: true },
    ];
  },
}

module.exports = nextConfig
