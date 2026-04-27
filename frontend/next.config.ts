import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Silence the "multiple lockfiles" workspace root warning
  outputFileTracingRoot: path.join(__dirname, '../'),

  serverExternalPackages: ['@zama-fhe/relayer-sdk'],

  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
        buffer: require.resolve('buffer/'),
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': false,
      };

      const webpack = require('webpack');
      config.plugins = [
        ...(config.plugins ?? []),
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          // Some SDK transitive deps reference the Node.js `global` object in browser builds
          global: require.resolve('./lib/global-shim.js'),
          process: require.resolve('process/browser'),
        }),
      ];
    }

    return config;
  },
};

export default nextConfig;
