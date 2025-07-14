'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import DesktopViewer from '@/components/DesktopViewer';
import ARViewer from '@/components/ARViewer';

export default function ARViewerPage() {
  const params = useParams();
  const artworkId = params.id;
  
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop' | null>(null);
  const [userChoice, setUserChoice] = useState<'ar' | 'desktop' | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | null>(null);
  const [showARErrorPopup, setShowARErrorPopup] = useState(false);
  const [arErrorMessage, setArErrorMessage] = useState('');
  
  const deviceDetectedRef = useRef(false);
  const renderLoggedRef = useRef(false);
  const [debugInfo, setDebugInfo] = useState<string>('초기화 중...');

  useEffect(() => {
    if (deviceDetectedRef.current) {
      return;
    }
    
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    const detectedType = isMobile ? 'mobile' : 'desktop';
    
    deviceDetectedRef.current = true;
    setDeviceType(detectedType);
    setDebugInfo(`디바이스 감지 완료: ${detectedType}`);
    
    console.log('📱 디바이스 타입 감지 완료:', detectedType);
  }, []);

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      console.log('📸 카메라 권한 요청 시작...');
      setDebugInfo('카메라 권한 요청 중...');
      
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('이 브라우저는 카메라를 지원하지 않습니다');
      }
      
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ 카메라 권한 허용됨!');
      
      stream.getTracks().forEach(track => {
        track.stop();
      });
      
      setCameraPermission('granted');
      setDebugInfo('카메라 권한 허용됨! AR 렌더링 시작');
      return true;
      
    } catch (error) {
      console.error('❌ 카메라 권한 요청 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      
      setCameraPermission('denied');
      setDebugInfo(`카메라 권한 실패: ${errorMessage}`);
      return false;
    }
  };

  // AR 오류 처리 함수
  const handleARError = (error: string) => {
    console.error('❌ AR 뷰어 오류:', error);
    setArErrorMessage(error);
    setShowARErrorPopup(true);
    // AR 상태 초기화
    setUserChoice(null);
    setCameraPermission(null);
  };

  // 🎯 명확한 조건 분리
  const shouldRenderDesktopViewer = deviceType === 'desktop';
  const shouldRenderARViewer = deviceType === 'mobile' && 
                               userChoice === 'ar' && 
                               cameraPermission === 'granted';
  const shouldRenderMobileDesktopViewer = deviceType === 'mobile' && userChoice === 'desktop';

  // 렌더링 조건 로그 (한 번만)
  useEffect(() => {
    if (deviceType && !renderLoggedRef.current) {
      console.log('🔍 완전 분리된 렌더링 조건:');
      console.log('  - 디바이스:', deviceType);
      console.log('  - 순수 3D 렌더링 (DesktopViewer):', shouldRenderDesktopViewer);
      console.log('  - AR 렌더링 (ARViewer):', shouldRenderARViewer);
      console.log('  - 모바일 3D 렌더링 (DesktopViewer):', shouldRenderMobileDesktopViewer);
      renderLoggedRef.current = true;
    }
  }, [deviceType, shouldRenderDesktopViewer, shouldRenderARViewer, shouldRenderMobileDesktopViewer]);

  return (
    <div className="fixed inset-0 bg-black">
      {/* 디바이스 감지 로딩 */}
      {!deviceType && (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">디바이스 감지 중...</p>
            <p className="text-sm opacity-50 mt-2">{debugInfo}</p>
          </div>
        </div>
      )}

      {/* 🔧 PC: 순수 DesktopViewer 렌더링 (AR 코드 완전 제거) */}
      {shouldRenderDesktopViewer && (
        <div className="w-full h-full">
          <DesktopViewer
            modelPath="/sample.glb"
            onLoadComplete={() => {
              console.log('✅ PC 순수 3D 뷰어 로딩 완료');
            }}
            onLoadError={(error: string) => {
              console.error('❌ PC 순수 3D 뷰어 로딩 실패:', error);
            }}
            autoRotate={true}
            rotationSpeed={0.05}
          />
        </div>
      )}

      {/* 🔧 모바일: 사용자 선택 UI */}
      {deviceType === 'mobile' && !userChoice && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6 max-w-sm">
            <div className="text-6xl mb-4">📱✨</div>
            <p className="text-lg font-medium mb-2">어떻게 작품을 감상하시겠습니까?</p>
            <p className="text-sm opacity-75 mb-4">AR로 현실 공간에 배치하거나, 3D 뷰어로 감상할 수 있습니다</p>
            
            <div className="space-y-3 mb-4">
              <button
                onClick={async () => {
                  try {
                    console.log('📸 모바일 사용자가 "AR 보기" 선택');
                    setUserChoice('ar');
                    
                    const granted = await requestCameraPermission();
                    
                    if (!granted) {
                      setUserChoice(null);
                    }
                    
                  } catch (error) {
                    console.error('❌ AR 모드 선택 실패:', error);
                    setUserChoice(null);
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-3 rounded-lg font-medium"
              >
                📸 카메라로 AR 보기
              </button>
              
              <button
                onClick={() => {
                  console.log('🎨 모바일 사용자가 "3D 뷰어" 선택');
                  setUserChoice('desktop');
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 transition-colors px-4 py-3 rounded-lg font-medium"
              >
                🎨 3D 뷰어로 보기
              </button>
            </div>
            
            <div className="text-xs opacity-50">
              AR 모드를 선택하면 카메라 권한이 필요합니다
            </div>
          </div>
        </div>
      )}

      {/* 카메라 권한 대기 */}
      {deviceType === 'mobile' && userChoice === 'ar' && !cameraPermission && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">카메라 권한 확인 중...</p>
            <p className="text-sm opacity-50 mt-2">{debugInfo}</p>
            <button 
              onClick={() => {
                setUserChoice(null);
                setCameraPermission(null);
              }}
              className="mt-4 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 카메라 권한 실패 */}
      {deviceType === 'mobile' && userChoice === 'ar' && cameraPermission === 'denied' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-red-900/80 z-20">
          <div className="text-center p-6">
            <p className="text-lg font-bold mb-2">⚠️ 카메라 권한이 필요합니다</p>
            <p className="text-sm opacity-75 mb-4">AR 모드를 사용하려면 카메라 권한을 허용해주세요</p>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setCameraPermission(null);
                  requestCameraPermission();
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
              >
                다시 시도
              </button>
              <button 
                onClick={() => {
                  setUserChoice(null);
                  setCameraPermission(null);
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors"
              >
                뒤로가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 AR 오류 팝업 */}
      {showARErrorPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">AR 뷰어 오류</h3>
              <p className="text-gray-600 mb-4">
                현재 {arErrorMessage.includes('MindAR') ? 'MindAR 초기화' : 
                      arErrorMessage.includes('카메라') ? '카메라 접근' : 
                      arErrorMessage.includes('권한') ? '권한' : 
                      '시스템'} 오류로 AR 뷰어를 사용할 수 없습니다.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                3D 뷰어로 작품을 감상해보세요!
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    setShowARErrorPopup(false);
                    setUserChoice('desktop');
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-colors font-medium"
                >
                  🎨 3D 뷰어로 감상하기
                </button>
                
                <button 
                  onClick={() => {
                    setShowARErrorPopup(false);
                    setArErrorMessage('');
                  }}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  다시 선택하기
                </button>
              </div>

              {/* 디버그 정보 (개발용) */}
              <details className="mt-4 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer">오류 상세정보</summary>
                <p className="text-xs text-gray-400 mt-2 break-all">{arErrorMessage}</p>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* 🎯 3단계 조건 만족시에만 ARViewer 렌더링 */}
      {shouldRenderARViewer && (
        <div className="w-full h-full">
          <ARViewer
            modelPath="/sample.glb"
            deviceType="mobile"
            onLoadComplete={() => {
              console.log('✅ 모바일 AR (MindAR) 로딩 완료');
            }}
            onLoadError={handleARError}
            autoRotate={false}
          />
        </div>
      )}

      {/* 🎯 모바일에서 3D 선택시 DesktopViewer 렌더링 */}
      {shouldRenderMobileDesktopViewer && (
        <div className="w-full h-full">
          <DesktopViewer
            modelPath="/sample.glb"
            onLoadComplete={() => {
              console.log('✅ 모바일 3D 뷰어 로딩 완료');
            }}
            onLoadError={(error: string) => {
              console.error('❌ 모바일 3D 뷰어 로딩 실패:', error);
            }}
            autoRotate={true}
            rotationSpeed={0.05}
          />
        </div>
      )}

      {/* 최소한의 상태 표시 */}
      <div className="fixed top-4 right-4 bg-black/70 text-white p-2 rounded text-xs z-10">
        <div>작품 ID: {artworkId}</div>
        <div>디바이스: {deviceType || '감지 중...'}</div>
        <div>
          {shouldRenderDesktopViewer && '🖥️ 순수 3D 모드'}
          {shouldRenderARViewer && '📱 AR 모드 (MindAR)'}
          {shouldRenderMobileDesktopViewer && '📱 모바일 3D 모드'}
          {deviceType === 'mobile' && !userChoice && '📱 선택 대기'}
        </div>
      </div>
    </div>
  );
}