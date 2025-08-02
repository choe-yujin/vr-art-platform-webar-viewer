// src/app/ar/view/[id]/page.tsx

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import DesktopViewer from '@/components/DesktopViewer';
import ARViewer from '@/components/ARViewer';
import { useArtwork } from '@/hooks/useArtwork';

export default function ARViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const artworkId = params.id as string;
  
  // 🎨 백엔드 API에서 작품 정보 로드
  const { artwork, loading: artworkLoading, error: artworkError } = useArtwork(artworkId);
  
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop' | null>(null);
  const [userChoice, setUserChoice] = useState<'ar' | 'desktop' | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | null>(null);
  const [showARErrorPopup, setShowARErrorPopup] = useState(false);
  
  // 🔧 고유 키로 컴포넌트 강제 재렌더링 보장
  const [arViewerKey, setARViewerKey] = useState(0);
  const [desktopViewerKey, setDesktopViewerKey] = useState(0);
  
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
  }, []);

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('이 브라우저는 카메라를 지원하지 않습니다');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');
      return true;
    } catch {
      setCameraPermission('denied');
      return false;
    }
  };
  
  const handleArButtonClick = async () => {
    setUserChoice('ar');
    // 🔧 AR 뷰어 새로운 키로 완전 재초기화
    setARViewerKey(prev => prev + 1);
    
    if (navigator.permissions) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(permissionStatus.state);
        
        if (permissionStatus.state === 'prompt') {
          const granted = await requestCameraPermission();
          if (!granted) setUserChoice(null);
        }
      } catch {
        await requestCameraPermission();
      }
    } else {
      await requestCameraPermission();
    }
  };

  const handleARError = (error: string) => {
    console.error('❌ AR 뷰어 오류:', error);
    setShowARErrorPopup(true);
    setUserChoice(null);
    setCameraPermission(null);
  };

  const handleBackFromAR = () => {
    console.log('🔙 ARViewer에서 뒤로가기');
    // 🔧 완전한 상태 초기화
    setUserChoice(null);
    setCameraPermission(null);
    setShowARErrorPopup(false);
    // AR 뷰어 키 증가로 완전 언마운트 보장
    setARViewerKey(prev => prev + 1);
  };

  const handleSwitchTo3D = () => {
    console.log('🎨 AR에서 3D 뷰어로 전환');
    // 🔧 AR 완전 정리 후 3D 뷰어로 전환
    setUserChoice('desktop');
    setCameraPermission(null);
    setShowARErrorPopup(false);
    // 양쪽 뷰어 모두 새로운 키로 재초기화
    setARViewerKey(prev => prev + 1);
    setDesktopViewerKey(prev => prev + 1);
  };

  // Unity WebGL 기반 뷰어 렌더링 조건
  const shouldRenderDesktopViewer = deviceType === 'desktop' || userChoice === 'desktop';
  const shouldRenderARViewer = deviceType === 'mobile' && userChoice === 'ar' && cameraPermission === 'granted';
  const shouldRenderMobileDesktopViewer = deviceType === 'mobile' && userChoice === 'desktop';

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

      {/* 🖥️ 데스크톱 & 모바일 3D 뷰어 */}
      {shouldRenderDesktopViewer && artwork && (
        <div className="w-full h-full relative">
          <DesktopViewer 
            key={`viewer-${desktopViewerKey}`}
            artwork={artwork}
          />
        </div>
      )}

      {/* 📱 Unity WebGL AR 뷰어 */}
      {shouldRenderARViewer && artwork && (
        <div className="w-full h-full relative">
          <ARViewer 
            key={`ar-viewer-${arViewerKey}`}
            artworkId={artwork.artworkId.toString()}
            onLoadComplete={() => console.log('Unity AR 로딩 완료')}
            onLoadError={handleARError}
            onBackPressed={handleBackFromAR}
            onSwitchTo3D={handleSwitchTo3D}
          />
        </div>
      )}

      {/* 📱 모바일 3D 뷰어 */}
      {shouldRenderMobileDesktopViewer && artwork && (
        <div className="w-full h-full relative">
          <DesktopViewer 
            key={`mobile-viewer-${desktopViewerKey}`}
            artwork={artwork}
          />
        </div>
      )}

      {/* AR 관련 UI들 */}
      {/* 📱 모바일 선택 화면 */}
      {deviceType === 'mobile' && !userChoice && artwork && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6 max-w-sm">
            {/* 🔧 작품 정보 미리보기 (실제 데이터 사용) */}
            <div className="bg-black/50 rounded-lg p-4 mb-6 text-left">
              <h2 className="font-bold text-xl mb-2">{artwork.title}</h2>
              <p className="text-sm opacity-90 mb-1">
                <span className="text-blue-300">작가:</span> {artwork.user?.nickname || 'Unknown'}
              </p>
              {artwork.description && (
                <p className="text-xs opacity-70 mt-2 leading-relaxed">
                  {artwork.description.length > 100 
                    ? `${artwork.description.substring(0, 100)}...`
                    : artwork.description
                  }
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs opacity-60">
                <span className="flex items-center gap-1">
                  <span className="text-red-400">❤️</span>
                  <span>{artwork.favoriteCount?.toLocaleString() || 0}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-blue-400">👁️</span>
                  <span>{artwork.viewCount?.toLocaleString() || 0}</span>
                </span>
              </div>
            </div>
            
            <div className="text-6xl mb-4">📱✨</div>
            <p className="text-lg font-medium mb-2">어떻게 작품을 감상하시겠습니까?</p>
            <p className="text-sm opacity-75 mb-4">AR로 현실 공간에 배치하거나, 3D 뷰어로 감상할 수 있습니다</p>
            <div className="space-y-3 mb-4">
              <button onClick={handleArButtonClick} className="w-full bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-3 rounded-lg font-medium">
                📸 카메라로 AR 보기
              </button>
              <button 
                onClick={() => {
                  setUserChoice('desktop');
                  setDesktopViewerKey(prev => prev + 1);
                }} 
                className="w-full bg-gray-600 hover:bg-gray-700 transition-colors px-4 py-3 rounded-lg font-medium"
              >
                🎨 3D 뷰어로 보기
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 카메라 권한 확인 중 */}
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

      {/* 카메라 권한 차단됨 */}
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

      {/* AR 오류 팝업 */}
      {showARErrorPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">AR 뷰어 오류</h3>
              <p className="text-gray-600 mb-6">시스템 오류로 AR 뷰어를 사용할 수 없습니다. 3D 뷰어로 작품을 감상해보세요!</p>
              <div className="space-y-3">
                <button 
                  onClick={() => { 
                    setShowARErrorPopup(false); 
                    setUserChoice('desktop');
                    setDesktopViewerKey(prev => prev + 1);
                  }} 
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

      {/* 🔧 AR 뷰어: 고유 키로 완전 재렌더링 보장 */}
      {shouldRenderARViewer && artwork && (
        <div className="w-full h-full">
          <ARViewer 
            key={`ar-${arViewerKey}`}
            artworkId={artwork.artworkId.toString()}
            onLoadError={handleARError} 
            onBackPressed={handleBackFromAR} 
            onSwitchTo3D={handleSwitchTo3D}
          />
        </div>
      )}

      {/* 🔧 모바일 3D 뷰어: 고유 키로 완전 재렌더링 보장 */}
      {shouldRenderMobileDesktopViewer && artwork && (
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
            artwork={artwork}
          />
        </div>
      )}
    </div>
  );
}
