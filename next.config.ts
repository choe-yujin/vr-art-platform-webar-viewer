import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 프로덕션 최적화
  output: 'standalone',
  
  // 이미지 최적화
  images: {
    domains: ['cdn.livingbrush.shop', 's3.amazonaws.com'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // 정적 파일 압축
  compress: true,
  
  // 실험적 기능 - optimizeCss 비활성화
  experimental: {
    // optimizeCss: true, // 비활성화
  },
  
  // Unity WebGL 빌드 파일 최적화
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Unity WebGL 빌드 파일들을 정적 자산으로 처리
      config.module.rules.push({
        test: /\.(wasm|gz)$/,
        type: 'asset/resource',
      });
      
      // WASM 파일 로딩 최적화
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    }
    return config;
  },
  
  // 커스텀 헤더
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/Build/Build.loader.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/proxy/glb',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type',
          },
        ],
      },
      {
        source: '/Build/:path*.wasm.gz',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
          {
            key: 'Content-Encoding',
            value: 'gzip',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/Build/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/Build/:path*.gz',
        headers: [
          {
            key: 'Content-Encoding',
            value: 'gzip',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/Build/Build.framework.js.gz',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Content-Encoding',
            value: 'gzip',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/Build/Build.data.gz',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/octet-stream',
          },
          {
            key: 'Content-Encoding',
            value: 'gzip',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // HTTPS 리다이렉트
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://livingbrush.shop/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
