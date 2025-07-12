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
    ];
  },
};

export default nextConfig;
