'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import ARViewer from '@/components/ARViewer';

export default function ARViewerPage() {
  const params = useParams();
  const artworkId = params.id;
  
  // 🔧 3단계 조건 상태 관리
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop' | null>(null);
  const [userChoice, setUserChoice] = useState<'ar' | 'desktop' | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | null>(null);
  
  // 중복 감지 방지
  const deviceDetectedRef = useRef(false);
  const [debugInfo, setDebugInfo] = useState<string>('초기화 중...');

  useEffect(() => {
    // 중복 감지 방지
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
    setDebugInfo(`디바이스 감지 완료: ${detectedType}`);
    
    console.log('📱 디바이스 타입 감지 완료:', detectedType);
    console.log('🔍 User Agent:', navigator.userAgent);
  }, []);

  // 🔧 카메라 권한 요청 함수
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
      
      console.log('📸 getUserMedia 호출 중...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ 카메라 권한 허용됨!', stream);
      
      // 스트림 정리
      stream.getTracks().forEach(track => {
        track.stop();
      });
      
      setCameraPermission('granted');
      setDebugInfo('카메라 권한 허용됨! ARViewer 렌더링 준비 완료');
      return true;
      
    } catch (error) {
      console.error('❌ 카메라 권한 요청 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      
      setCameraPermission('denied');
      setDebugInfo(`카메라 권한 실패: ${errorMessage}`);
      return false;
    }
  };

  // 🎯 3단계 조건 확인
  const shouldRenderARViewer = deviceType === 'mobile' && 
                               userChoice === 'ar' && 
                               cameraPermission === 'granted';
  
  const shouldRenderDesktopViewer = deviceType === 'desktop' || 
                                   (deviceType === 'mobile' && userChoice === 'desktop');

  console.log('🔍 렌더링 조건 체크:');
  console.log('  - 디바이스:', deviceType);
  console.log('  - 사용자 선택:', userChoice);
  console.log('  - 카메라 권한:', cameraPermission);
  console.log('  - ARViewer 렌더링 여부:', shouldRenderARViewer);
  console.log('  - DesktopViewer 렌더링 여부:', shouldRenderDesktopViewer);

  return (
    <div className="fixed inset-0 bg-black">
      {/* 🔧 디바이스 감지 완료까지 로딩 */}
      {!deviceType && (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">디바이스 감지 중...</p>
            <p className="text-sm opacity-50 mt-2">{debugInfo}</p>
          </div>
        </div>
      )}

      {/* 🔧 PC: 바로 데스크톱 3D 뷰어 선택 */}
      {deviceType === 'desktop' && !userChoice && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6 max-w-sm">
            <div className="text-6xl mb-4">🖥️✨</div>
            <p className="text-lg font-medium mb-2">3D 작품을 감상하시겠습니까?</p>
            <p className="text-sm opacity-75 mb-4">PC에서는 3D 뷰어로 작품을 감상할 수 있습니다</p>
            
            <div className="space-y-3 mb-4">
              <button
                onClick={() => {
                  console.log('🖥️ PC 사용자가 "3D 뷰어 시작" 선택');
                  setUserChoice('desktop');
                  setDebugInfo('PC 3D 뷰어 모드 선택됨');
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-3 rounded-lg font-medium"
              >
                🎨 3D 뷰어 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔧 모바일: 사용자 선택 UI (AR vs 3D) */}
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
                    setDebugInfo('AR 모드 선택됨 - 카메라 권한 요청 중...');
                    
                    const granted = await requestCameraPermission();
                    
                    if (!granted) {
                      // 권한 실패 시 다시 선택 화면으로
                      setUserChoice(null);
                      setDebugInfo('카메라 권한 실패 - 다시 선택해주세요');
                    }
                    
                  } catch (error) {
                    console.error('❌ AR 모드 선택 실패:', error);
                    setUserChoice(null);
                    setDebugInfo('AR 모드 선택 실패 - 다시 시도해주세요');
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
                  setDebugInfo('모바일 3D 뷰어 모드 선택됨');
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

      {/* 🔧 모바일 AR: 카메라 권한 대기 중 */}
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
                setDebugInfo('사용자가 취소함 - 다시 선택');
              }}
              className="mt-4 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 🔧 모바일 AR: 카메라 권한 실패 */}
      {deviceType === 'mobile' && userChoice === 'ar' && cameraPermission === 'denied' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-red-900/80 z-20">
          <div className="text-center p-6">
            <p className="text-lg font-bold mb-2">⚠️ 카메라 권한이 필요합니다</p>
            <p className="text-sm opacity-75 mb-4">AR 모드를 사용하려면 카메라 권한을 허용해주세요</p>
            <p className="text-xs opacity-50 mb-4">디버그: {debugInfo}</p>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setCameraPermission(null);
                  setDebugInfo('카메라 권한 재요청');
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
                  setDebugInfo('사용자가 뒤로가기 - 다시 선택');
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors"
              >
                뒤로가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎯 조건부 렌더링: ARViewer (모바일 + AR 선택 + 카메라 권한 허용) */}
      {shouldRenderARViewer && (
        <div className="w-full h-full">
          <ARViewer
            modelPath="/sample.glb"
            deviceType="mobile"
            onLoadComplete={() => {
              console.log('✅ ARViewer 로딩 완료');
              setDebugInfo('ARViewer 활성화 완료');
            }}
            onLoadError={(error: string) => {
              console.error('❌ ARViewer 로딩 실패:', error);
              setDebugInfo(`ARViewer 실패: ${error}`);
              // AR 실패 시 선택 화면으로 되돌리기
              setUserChoice(null);
              setCameraPermission(null);
            }}
            autoRotate={false} // AR 모드에서는 자동 회전 비활성화
          />
        </div>
      )}

      {/* 🎯 조건부 렌더링: DesktopViewer (PC 또는 모바일 3D 선택) */}
      {shouldRenderDesktopViewer && (
        <div className="w-full h-full">
          <ARViewer
            modelPath="/sample.glb"
            deviceType="desktop"
            onLoadComplete={() => {
              console.log('✅ DesktopViewer 로딩 완료');
              setDebugInfo('DesktopViewer 활성화 완료');
            }}
            onLoadError={(error: string) => {
              console.error('❌ DesktopViewer 로딩 실패:', error);
              setDebugInfo(`DesktopViewer 실패: ${error}`);
            }}
            autoRotate={true} // 3D 모드에서는 자동 회전 활성화
            rotationSpeed={0.05}
          />
        </div>
      )}

      {/* 상단 정보 패널 */}
      <div className="fixed top-4 left-4 bg-black/50 backdrop-blur-md text-white p-3 rounded-lg z-10">
        <h2 className="font-bold">조건부 렌더링 AR 뷰어</h2>
        <p className="text-sm opacity-75">작품 ID: {artworkId}</p>
        <p className="text-xs opacity-50">
          디바이스: {deviceType || '감지 중...'}
        </p>
        <p className="text-xs opacity-50">
          사용자 선택: {userChoice || '대기 중...'}
        </p>
        <p className="text-xs opacity-50">
          카메라 권한: {cameraPermission || '확인 중...'}
        </p>
        <div className="mt-2 text-xs">
          {shouldRenderARViewer && '🔥 ARViewer 활성화'}
          {shouldRenderDesktopViewer && '🔥 DesktopViewer 활성화'}
          {!shouldRenderARViewer && !shouldRenderDesktopViewer && '⏸️ 뷰어 대기 중'}
        </div>
      </div>

      {/* 디버그 정보 */}
      <div className="fixed bottom-4 left-4 bg-purple-600/70 text-white p-2 rounded text-xs z-10">
        <div>🔧 조건부 렌더링 디버그: {debugInfo}</div>
        <div>✅ 3단계 조건 확인 완료</div>
        <div>📱 불필요한 렌더링 완전 제거</div>
      </div>
    </div>
  );
}