'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { UnityWebGLInstance } from '@/types/global';



interface ARViewerProps {
  artworkId?: string; // 작품 ID
  onLoadComplete?: () => void;
  onLoadError?: (error: string) => void;
  onSwitchTo3D?: () => void;
}

export default function ARViewer({
  artworkId,
  onLoadComplete,
  onLoadError,
  onSwitchTo3D,
}: ARViewerProps) {
  // 상태 관리
  const [status, setStatus] = useState<'loading' | 'ar-active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('AR 뷰어 초기화 중...');
  const [showTimeoutPopup, setShowTimeoutPopup] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  // ref 관리
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const unityInstanceRef = useRef<UnityWebGLInstance | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onLoadErrorRef = useRef(onLoadError);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete;
    onLoadErrorRef.current = onLoadError;
    
    // 컴포넌트 언마운트 시 카메라 스트림 정리
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [onLoadComplete, onLoadError]);

  // 카메라 권한 요청 및 스트림 시작
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('이 브라우저는 카메라를 지원하지 않습니다');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      // 스트림을 ref에 저장하여 유지
      cameraStreamRef.current = stream;
      
      // 비디오 요소에 스트림 연결
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setCameraPermission('granted');
      return true;
      
    } catch (error) {
      console.error('카메라 권한 요청 실패:', error);
      setCameraPermission('denied');
      return false;
    }
  }, []);

  // Unity WebGL AR 초기화
  const initUnityAR = useCallback(async () => {
    try {
      setDebugInfo('카메라 권한 확인 중...');
      
      // 카메라 권한 확인
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        throw new Error('카메라 권한이 필요합니다');
      }

              setDebugInfo('AR 뷰어 로딩 중...');
      
      // Unity 로더 스크립트 동적 로드
      if (!window.createUnityInstance) {
        const script = document.createElement('script');
        script.src = '/Build/Build.loader.js';
        script.async = false; // 동기 로딩으로 변경
        script.crossOrigin = 'anonymous';
        script.type = 'text/javascript';
        
        await new Promise((resolve, reject) => {
          script.onload = () => {
            console.log('✅ Unity 로더 스크립트 로딩 완료');
            resolve(undefined);
          };
          script.onerror = () => {
            console.error('❌ Unity 로더 스크립트 로딩 실패');
            reject(new Error('Unity 로더 스크립트 로딩 실패'));
          };
          document.head.appendChild(script);
        });
        
        // Unity 인스턴스 생성 함수가 로드될 때까지 대기
        let attempts = 0;
        while (!window.createUnityInstance && attempts < 100) { // 대기 시간 증가
          await new Promise(resolve => setTimeout(resolve, 50));
          attempts++;
        }
        
        if (!window.createUnityInstance) {
          throw new Error('Unity 인스턴스 생성 함수를 찾을 수 없습니다');
        }
        
        // 추가 대기 시간으로 안정성 확보
        await new Promise(resolve => setTimeout(resolve, 500));
      }

              setDebugInfo('AR 뷰어 인스턴스 생성 중...');
      
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas 요소를 찾을 수 없습니다');
      }

      const config = {
        dataUrl: "/Build/Build.data.gz",
        frameworkUrl: "/Build/Build.framework.js.gz",
        codeUrl: "/Build/Build.wasm.gz",
        // AR 모드를 위한 설정
        autoSyncPersistentDataPath: true,
        // Unity 배경을 투명하게 설정
        backgroundColor: '#00000000'
      };

      unityInstanceRef.current = await window.createUnityInstance!(canvas, config);
      
              setDebugInfo('AR 뷰어 초기화 완료! AR 모드 활성화 중...');
      
      // Unity에 AR 모드 활성화 명령
      unityInstanceRef.current.SendMessage('ARController', 'EnableARMode');
      
      setStatus('ar-active');
      onLoadCompleteRef.current?.();
      
    } catch (error) {
      console.error('Unity WebGL AR 초기화 실패:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unity WebGL AR 초기화 실패');
      setStatus('error');
      onLoadErrorRef.current?.(error instanceof Error ? error.message : 'Unity WebGL AR 초기화 실패');
    }
  }, [requestCameraPermission]);

  // Unity에 작품 ID 전송 (개선된 방식)
  const loadArtworkInUnity = useCallback((artworkId: string) => {
    if (!unityInstanceRef.current) {
      console.warn('Unity 인스턴스가 아직 준비되지 않았습니다');
      return;
    }
    
    try {
              setDebugInfo('AR에 작품 정보 전송 중...');
      
      console.log(`🎯 Unity AR에 작품 ID 전송: ${artworkId}`);
      
      // Unity의 ARModelViewer 게임오브젝트에 작품 ID 전송
      // Unity WebGL에서 직접 API 호출하여 GLB 다운로드
      unityInstanceRef.current.SendMessage('ARModelViewer', 'LoadArtworkById', artworkId);
      
              setDebugInfo('AR 작품 정보 전송 완료! 모델 로딩 중...');
      
    } catch (error) {
      console.error('Unity AR 작품 로딩 실패:', error);
      setErrorMessage('AR 작품 로딩 실패');
      setStatus('error');
              onLoadErrorRef.current?.('AR 모델 로딩 실패');
    }
  }, [unityInstanceRef]);





  // 3D 뷰어로 전환
  const handleSwitchTo3D = useCallback(() => {
    if (onSwitchTo3D) {
      onSwitchTo3D();
    }
  }, [onSwitchTo3D]);



  // 컴포넌트 마운트 시 Unity AR 초기화
  useEffect(() => {
    if (containerRef.current && canvasRef.current) {
      initUnityAR();
    }
  }, [initUnityAR]);

  // 작품 ID 변경 시 Unity에 전송
  useEffect(() => {
    if (unityInstanceRef.current && artworkId) {
      loadArtworkInUnity(artworkId);
    }
  }, [artworkId, loadArtworkInUnity]);

  // 타임아웃 처리
  useEffect(() => {
    if (status === 'loading') {
    timeoutRef.current = setTimeout(() => {
        setShowTimeoutPopup(true);
      }, 30000); // 30초 타임아웃
    }
      
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [status]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (unityInstanceRef.current) {
        try {
          unityInstanceRef.current.SendMessage('ARController', 'DisableARMode');
          unityInstanceRef.current.Quit();
        } catch (error) {
          console.warn('Unity AR 정리 중 오류:', error);
        }
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black">
      {/* 카메라 비디오 배경 */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover z-0"
        autoPlay
        playsInline
        muted
        style={{ 
          transform: 'scaleX(-1)', // 거울 효과 (선택사항)
          filter: 'brightness(1.0)' // Unity 오버레이를 위해 밝기 조정
        }}
      />
      
      {/* Unity AR Canvas */}
      <div ref={containerRef} className="relative w-full h-full z-10">
        <canvas
          ref={canvasRef}
          id="unity-ar-canvas"
          className="w-full h-full block"
          style={{ 
            touchAction: 'manipulation',
            outline: 'none',
            background: 'transparent', // Unity 배경을 투명하게
            mixBlendMode: 'screen', // Unity와 카메라 화면을 블렌드
            opacity: 0.9 // Unity 투명도 조정
          }}
        />

        {/* 로딩 오버레이 */}
      {status === 'loading' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium">Unity AR 초기화 중...</p>
              <p className="text-sm opacity-75 mt-2">{debugInfo}</p>
              {cameraPermission === 'denied' && (
                <p className="text-red-400 text-sm mt-2">
                  카메라 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용해주세요.
                </p>
              )}
            </div>
        </div>
      )}
      
        {/* 에러 오버레이 */}
      {status === 'error' && (
          <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-10">
            <div className="text-center text-white p-6">
              <div className="text-4xl mb-4">❌</div>
              <h3 className="text-xl font-bold mb-2">Unity AR 초기화 실패</h3>
              <p className="text-sm opacity-90 mb-4">{errorMessage}</p>
              <div className="space-y-2">
            <button
                  onClick={() => {
                    setStatus('loading');
                    setErrorMessage('');
                    initUnityAR();
                  }}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors mr-2"
            >
              다시 시도
            </button>
                <button
                  onClick={handleSwitchTo3D}
                  className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors"
                >
                  3D 뷰어로 전환
                </button>
              </div>
            </div>
          </div>
        )}



        {/* 컨트롤 버튼들 */}
        <div className="absolute top-4 left-4 z-20">
          {/* 3D 뷰어 전환 버튼 */}
          <button
            onClick={handleSwitchTo3D}
            className="bg-black/50 backdrop-blur-md hover:bg-black/70 text-white p-3 rounded-full transition-all duration-200"
            title="3D 뷰어로 전환"
          >
            🎨
          </button>
        </div>



        {/* 타임아웃 팝업 */}
      {showTimeoutPopup && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-bold mb-4">로딩 시간 초과</h3>
              <p className="text-sm text-gray-600 mb-4">
                Unity AR 초기화에 시간이 오래 걸리고 있습니다. 다시 시도하거나 3D 뷰어로 전환해보세요.
              </p>
              <div className="space-y-2">
              <button
                  onClick={() => {
                    setShowTimeoutPopup(false);
                    setStatus('loading');
                    initUnityAR();
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition-colors"
                >
                  다시 시도
              </button>
              <button
                  onClick={handleSwitchTo3D}
                  className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded transition-colors"
                >
                  3D 뷰어로 전환
              </button>
            </div>
                      </div>
          </div>
        )}
        

      </div>
    </div>
  );
}