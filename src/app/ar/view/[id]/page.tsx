// src/app/ar/view/[id]/page.tsx

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import DesktopViewer from '@/components/DesktopViewer';
import { useArtwork } from '@/hooks/useArtwork';

export default function ARViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const artworkId = params.id as string;
  
  // 🎨 백엔드 API에서 작품 정보 로드
  const { artwork, loading: artworkLoading, error: artworkError } = useArtwork(artworkId);
  
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop' | null>(null);
  const [userChoice, setUserChoice] = useState<'ar' | 'desktop' | null>(null);
  
  const deviceDetectedRef = useRef(false);

  // Unity가 artworkId를 URL 파라미터에서 읽을 수 있도록 URL에 추가
  useEffect(() => {
    if (!artworkId) return;
    
    const currentArtworkId = searchParams.get('artworkId');
    if (currentArtworkId !== artworkId) {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.set('artworkId', artworkId);
      
      // URL을 업데이트하되 페이지를 새로고침하지 않음
      const newUrl = `${window.location.pathname}?${newSearchParams.toString()}`;
      window.history.replaceState({}, '', newUrl);
      
      console.log(`🔧 Unity를 위해 URL에 artworkId=${artworkId} 추가됨`);
    }
  }, [artworkId, searchParams]);

  useEffect(() => {
    if (deviceDetectedRef.current) return;
    
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const detectedType = isMobile ? 'mobile' : 'desktop';
    deviceDetectedRef.current = true;
    setDeviceType(detectedType);
    
    // 모든 디바이스에서 Desktop 뷰어로 진입 (AR 기능 비활성화)
    setUserChoice('desktop');
    console.log(`🖥️ ${detectedType} 기기에서 Desktop 뷰어로 진입`);
  }, []);

  // Unity WebGL 기반 뷰어 렌더링 조건
  const shouldRenderDesktopViewer = userChoice === 'desktop';

  return (
    <div className="fixed inset-0 bg-black">
      {/* 🎨 작품 로딩 상태 */}
      {artworkLoading && (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">작품 정보 로딩 중...</p>
            <p className="text-sm opacity-75 mt-2">ID: {artworkId}</p>
          </div>
        </div>
      )}
      
      {/* 🎨 작품 로드 오류 */}
      {artworkError && (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center p-6 max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2">작품을 찾을 수 없습니다</h2>
            <p className="text-sm opacity-75 mb-4">{artworkError}</p>
            <button 
              onClick={() => window.history.back()} 
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
            >
              뒤로가기
            </button>
          </div>
        </div>
      )}
      
      {/* 디바이스 감지 로딩 */}
      {!artworkLoading && !artworkError && !deviceType && (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">디바이스 감지 중...</p>
          </div>
        </div>
      )}

      {/* 🖥️ 모든 디바이스에서 Desktop 뷰어로 작품 감상 */}
      {shouldRenderDesktopViewer && artwork && (
        <div className="w-full h-full relative">
          <DesktopViewer 
            artwork={artwork}
          />
        </div>
      )}
    </div>
  );
}
