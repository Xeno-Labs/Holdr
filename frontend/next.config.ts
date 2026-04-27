import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
        new webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] }),
      ];
    }

    return config;
  },
};

export default nextConfig;
