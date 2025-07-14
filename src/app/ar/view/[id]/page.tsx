'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import ARViewer from '@/components/ARViewer';

export default function ARViewerPage() {
  const params = useParams();
  const artworkId = params.id;
  // 🔧 초기값을 null로 설정하여 디바이스 감지 완료까지 대기
  // 🔧 디바이스 타입 감지 및 중복 방지
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop' | null>(null);
  const deviceDetectedRef = useRef(false);
  const [isViewerReady, setIsViewerReady] = useState(false);

  useEffect(() => {
    // 🔧 중복 감지 방지
    if (deviceDetectedRef.current) {
      console.log('🔄 디바이스 감지 중복 실행 방지');
      return;
    }
    
    // 디바이스 타입 감지
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    const detectedType = isMobile ? 'mobile' : 'desktop';
    
    deviceDetectedRef.current = true;
    setDeviceType(detectedType);
    
    console.log('📱 디바이스 타입 감지 완료:', detectedType);
    console.log('🔍 User Agent:', navigator.userAgent);
  }, []);

  const handleLoadComplete = () => {
    setIsViewerReady(true);
    console.log('✅ 뷰어 로딩 완료');
  };

  const handleLoadError = (error: string) => {
    console.error('❌ 뷰어 로딩 실패:', error);
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* AR 뷰어 컨테이너 */}
      <div id="ar-container" className="w-full h-full relative">
        {/* 🔧 디바이스 감지 완료 후에만 ARViewer 렌더링 */}
        {deviceType && (
          <ARViewer
            modelPath="/sample.glb"
            deviceType={deviceType}
            onLoadComplete={handleLoadComplete}
            onLoadError={handleLoadError}
            autoRotate={true}          // 자동 회전 활성화
            rotationSpeed={0.05}        // 천천히 회전 (0.05 = 매우 천천히, 0.1 = 천천히, 0.5 = 보통)
          />
        )}
        
        {/* 🔧 디바이스 감지 중 로딩 화면 */}
        {!deviceType && (
          <div className="flex items-center justify-center h-full text-white">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium">디바이스 감지 중...</p>
              <p className="text-sm opacity-50 mt-2">잠시만 기다려주세요</p>
            </div>
          </div>
        )}
      </div>

      {/* 플로팅 버튼들 - 뷰어 준비 완료 후 표시 */}
      {isViewerReady && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-20">
          <button 
            className="bg-white/20 backdrop-blur-md text-white px-4 py-3 rounded-lg hover:bg-white/30 transition-all duration-200"
            onClick={() => console.log('공유 버튼 클릭')}
          >
            📤 공유
          </button>
          <button 
            className="bg-white/20 backdrop-blur-md text-white px-4 py-3 rounded-lg hover:bg-white/30 transition-all duration-200"
            onClick={() => console.log('댓글 버튼 클릭')}
          >
            💬 댓글
          </button>
          <button 
            className="bg-white/20 backdrop-blur-md text-white px-4 py-3 rounded-lg hover:bg-white/30 transition-all duration-200"
            onClick={() => console.log('작가 버튼 클릭')}
          >
            👤 작가
          </button>
        </div>
      )}

      {/* 상단 정보 패널 */}
      <div className="fixed top-4 left-4 bg-black/50 backdrop-blur-md text-white p-3 rounded-lg z-10">
        <h2 className="font-bold">샘플 AR 작품</h2>
        <p className="text-sm opacity-75">작품 ID: {artworkId}</p>
        <p className="text-xs opacity-50">
          {deviceType === 'mobile' ? '📱 모바일 AR 모드' : '🖥️ 데스크톱 3D 모드'}
        </p>
        <p className="text-xs opacity-50 mt-1">
          🔄 자동 회전 활성화 (마우스 드래그로 수동 조작 가능)
        </p>
      </div>
    </div>
  );
}