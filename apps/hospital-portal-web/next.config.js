/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Transpile CornerstoneJS packages (they contain TypeScript source)
  transpilePackages: [
    '@cornerstonejs/core',
    '@cornerstonejs/tools',
    '@cornerstonejs/streaming-image-volume-loader',
    '@cornerstonejs/dicom-image-loader',
  ],
  experimental: {
    serverComponentsExternalPackages: [],
    // Tree-shake large icon/UI barrels so dashboard shell does not pull every export.
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'date-fns',
      'recharts',
    ],
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
      // Phase 3 — legacy insurance UI → CCMS (canonical Coverage & Claims)
      { source: '/dashboard/insurance', destination: '/dashboard/ccms', permanent: true },
      { source: '/dashboard/insurance/:path*', destination: '/dashboard/ccms/:path*', permanent: true },
    ];
  },
}

module.exports = nextConfig
