// src/app/ar/view/[id]/page.tsx

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import DesktopViewer from '@/components/DesktopViewer';
import ARViewer from '@/components/ARViewer';

export default function ARViewerPage() {
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop' | null>(null);
  const [userChoice, setUserChoice] = useState<'ar' | 'desktop' | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | null>(null);
  const [showARErrorPopup, setShowARErrorPopup] = useState(false);
  
  // 🔧 고유 키로 컴포넌트 강제 재렌더링 보장
  const [arViewerKey, setARViewerKey] = useState(0);
  const [desktopViewerKey, setDesktopViewerKey] = useState(0);
  
  const deviceDetectedRef = useRef(false);
  const pageCleanupRef = useRef(false);

  // 🔧 React Hook 경고 해결: useCallback으로 안정적인 참조 제공
  const forcePageCleanup = useCallback(() => {
    if (pageCleanupRef.current) return;
    pageCleanupRef.current = true;
    
    console.log('🧹 페이지 레벨 정리 시작 (캐시 보존)');
    
    // 🎯 핵심 변경: 캐시 삭제 대신 DOM 요소만 정리
    setTimeout(() => {
      // MindAR DOM 요소만 제거 (캐시는 보존)
      const mindArElements = document.querySelectorAll(
        '[class*="mindar"], [id*="mindar"]'
      );
      mindArElements.forEach(el => {
        try {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        } catch (error) {
          console.warn('MindAR 요소 제거 실패:', error);
        }
      });
      
      console.log('✅ 페이지 레벨 정리 완료 (캐시 보존됨)');
    }, 100);
  }, []); // 🔧 빈 의존성 배열로 안정적인 참조 보장

  // 🔧 페이지 언마운트시 cleanup - 의존성 문제 해결
  useEffect(() => {
    // 🔧 cleanup 함수에서 현재 시점의 함수 참조를 복사
    const currentCleanup = forcePageCleanup;
    
    return () => {
      console.log('🧹 페이지 언마운트 - 정리 수행');
      currentCleanup();
    };
  }, [forcePageCleanup]);

  // 디바이스 감지 로직
  useEffect(() => {
    if (deviceDetectedRef.current) return;
    
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const detectedType = isMobile ? 'mobile' : 'desktop';
    deviceDetectedRef.current = true;
    setDeviceType(detectedType);
  }, []);

  // 카메라 권한 요청 함수
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('이 브라우저는 카메라를 지원하지 않습니다');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');
      return true;
    } catch (permissionError) {
      console.warn('카메라 권한 요청 실패:', permissionError);
      setCameraPermission('denied');
      return false;
    }
  }, []);
  
  // AR 버튼 클릭 핸들러
  const handleArButtonClick = useCallback(async () => {
    setUserChoice('ar');
    setARViewerKey(prev => prev + 1);
    pageCleanupRef.current = false;
    
    if (navigator.permissions) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(permissionStatus.state);
        
        if (permissionStatus.state === 'prompt') {
          const granted = await requestCameraPermission();
          if (!granted) setUserChoice(null);
        }
      } catch (permissionQueryError) {
        console.warn('권한 상태 조회 실패:', permissionQueryError);
        await requestCameraPermission();
      }
    } else {
      await requestCameraPermission();
    }
  }, [requestCameraPermission]);

  // AR 에러 핸들러
  const handleARError = useCallback((error: string | Error | unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ AR 뷰어 오류:', errorMessage);
    setShowARErrorPopup(true);
    setUserChoice(null);
    setCameraPermission(null);
    forcePageCleanup();
  }, [forcePageCleanup]);

  // AR에서 뒤로가기 핸들러
  const handleBackFromAR = useCallback(() => {
    console.log('🔙 ARViewer에서 뒤로가기');
    setUserChoice(null);
    setCameraPermission(null);
    setShowARErrorPopup(false);
    setARViewerKey(prev => prev + 1);
    forcePageCleanup();
  }, [forcePageCleanup]);

  // 3D 뷰어로 전환 핸들러
  const handleSwitchTo3D = useCallback(() => {
    console.log('🎨 AR에서 3D 뷰어로 전환');
    setUserChoice('desktop');
    setCameraPermission(null);
    setShowARErrorPopup(false);
    setARViewerKey(prev => prev + 1);
    setDesktopViewerKey(prev => prev + 1);
    forcePageCleanup();
  }, [forcePageCleanup]);

  // 데스크톱 모드 선택 핸들러
  const handleDesktopModeSelect = useCallback(() => {
    setUserChoice('desktop');
    setDesktopViewerKey(prev => prev + 1);
    pageCleanupRef.current = false;
  }, []);

  // 에러 팝업에서 3D 뷰어로 이동 핸들러
  const handleErrorPopupToDesktop = useCallback(() => {
    setShowARErrorPopup(false);
    setUserChoice('desktop');
    setDesktopViewerKey(prev => prev + 1);
    pageCleanupRef.current = false;
  }, []);

  // 렌더링 조건
  const shouldRenderDesktopViewer = deviceType === 'desktop';
  const shouldRenderARViewer = deviceType === 'mobile' && userChoice === 'ar' && cameraPermission === 'granted';
  const shouldRenderMobileDesktopViewer = deviceType === 'mobile' && userChoice === 'desktop';

  return (
    <div className="fixed inset-0 bg-black">
      {!deviceType && (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">디바이스 감지 중...</p>
          </div>
        </div>
      )}

      {shouldRenderDesktopViewer && (
        <div className="w-full h-full relative">
          <DesktopViewer 
            key={`desktop-${desktopViewerKey}`}
            modelPath="/sample.glb" 
          />
        </div>
      )}

      {deviceType === 'mobile' && !userChoice && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6 max-w-sm">
            <div className="text-6xl mb-4">📱✨</div>
            <p className="text-lg font-medium mb-2">어떻게 작품을 감상하시겠습니까?</p>
            <p className="text-sm opacity-75 mb-4">AR로 현실 공간에 배치하거나, 3D 뷰어로 감상할 수 있습니다</p>
            <div className="space-y-3 mb-4">
              <button 
                onClick={handleArButtonClick} 
                className="w-full bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-3 rounded-lg font-medium"
              >
                📸 카메라로 AR 보기
              </button>
              <button 
                onClick={handleDesktopModeSelect}
                className="w-full bg-gray-600 hover:bg-gray-700 transition-colors px-4 py-3 rounded-lg font-medium"
              >
                🎨 3D 뷰어로 보기
              </button>
            </div>
          </div>
        </div>
      )}
      
      {deviceType === 'mobile' && userChoice === 'ar' && cameraPermission === 'prompt' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">카메라 권한 확인 중...</p>
            <button onClick={handleBackFromAR} className="mt-4 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors">
              취소
            </button>
          </div>
        </div>
      )}

      {deviceType === 'mobile' && userChoice === 'ar' && cameraPermission === 'denied' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-red-900/80 z-20">
          <div className="text-center p-6 max-w-sm">
            <p className="text-lg font-bold mb-2">⚠️ 카메라 권한이 차단되었습니다</p>
            <p className="text-sm opacity-75 mb-4">AR 모드를 사용하려면 브라우저의 사이트 설정에서 카메라 권한을 직접 허용해주셔야 합니다.</p>
            <button onClick={handleBackFromAR} className="w-full bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors">
              선택 화면으로 돌아가기
            </button>
          </div>
        </div>
      )}

      {showARErrorPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">AR 뷰어 오류</h3>
              <p className="text-gray-600 mb-6">시스템 오류로 AR 뷰어를 사용할 수 없습니다. 3D 뷰어로 작품을 감상해보세요!</p>
              <div className="space-y-3">
                <button 
                  onClick={handleErrorPopupToDesktop}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium"
                >
                  🎨 3D 뷰어로 감상하기
                </button>
                <button onClick={handleBackFromAR} className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors">
                  다시 선택하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🎯 캐시 보존 방식의 AR 뷰어 */}
      {shouldRenderARViewer && (
        <div className="w-full h-full">
          <ARViewer 
            key={`ar-${arViewerKey}`}
            modelPath="/sample.glb" 
            deviceType="mobile" 
            onLoadError={handleARError} 
            onBackPressed={handleBackFromAR} 
            onSwitchTo3D={handleSwitchTo3D}
          />
        </div>
      )}

      {/* 모바일 3D 뷰어 */}
      {shouldRenderMobileDesktopViewer && (
        <div className="w-full h-full relative">
          <button 
            onClick={handleBackFromAR} 
            className="absolute top-4 left-4 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full z-20 transition-colors" 
            aria-label="뒤로가기"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <DesktopViewer 
            key={`mobile-desktop-${desktopViewerKey}`}
            modelPath="/sample.glb" 
            autoRotate={true} 
          />
        </div>
      )}
    </div>
  );
}