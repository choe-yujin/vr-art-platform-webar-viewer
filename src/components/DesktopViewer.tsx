'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ArtworkResponse } from '@/utils/api';
import { UnityWebGLInstance } from '@/types/global';



interface DesktopViewerProps {
  modelPath: string;
  artwork?: ArtworkResponse | null;
  onLoadComplete?: () => void;
  onLoadError?: (error: string) => void;
}

export default function DesktopViewer({ 
  modelPath, 
  artwork,
  onLoadComplete, 
  onLoadError
}: DesktopViewerProps) {
  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('Unity WebGL 초기화 중...');
  
  const [showPromoHeader, setShowPromoHeader] = useState<boolean>(true);
  const [showArtistInfo, setShowArtistInfo] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [backgroundDark, setBackgroundDark] = useState<boolean>(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const unityInstanceRef = useRef<UnityWebGLInstance | null>(null);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onLoadErrorRef = useRef(onLoadError);

  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete;
    onLoadErrorRef.current = onLoadError;
  }, [onLoadComplete, onLoadError]);

  // Unity WebGL 초기화
  const initUnityWebGL = useCallback(async () => {
    try {
      setDebugInfo('Unity WebGL 로더 스크립트 로딩 중...');
      
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

      setDebugInfo('Unity WebGL 인스턴스 생성 중...');
      
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas 요소를 찾을 수 없습니다');
      }

      const config = {
        dataUrl: "/Build/Build.data.gz",
        frameworkUrl: "/Build/Build.framework.js.gz",
        codeUrl: "/Build/Build.wasm.gz"
      };

      unityInstanceRef.current = await window.createUnityInstance!(canvas, config);
      
      setDebugInfo('Unity WebGL 초기화 완료! 모델 로딩 준비 중...');
      setStatus('active');
      
      onLoadCompleteRef.current?.();
      
    } catch (error) {
      console.error('Unity WebGL 초기화 실패:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unity WebGL 초기화 실패');
      setStatus('error');
      onLoadErrorRef.current?.(error instanceof Error ? error.message : 'Unity WebGL 초기화 실패');
    }
  }, []);

  // Unity에 모델 로딩 명령 전송
  const loadModelInUnity = useCallback((modelUrl: string) => {
    if (!unityInstanceRef.current) {
      console.warn('Unity 인스턴스가 아직 준비되지 않았습니다');
      return;
    }

    try {
      setDebugInfo('Unity에 모델 로딩 명령 전송 중...');
      
      console.log(`🎯 Unity에 모델 URL 전송: ${modelUrl}`);
      
      // Unity의 WebGLModelViewer 게임오브젝트에 메시지 전송
      unityInstanceRef.current.SendMessage('WebGLModelViewer', 'LoadModelFromURL', modelUrl);
      
      setDebugInfo('모델 로딩 명령 전송 완료!');

    } catch (error) {
      console.error('Unity 모델 로딩 실패:', error);
      setErrorMessage('모델 로딩 실패');
      setStatus('error');
      onLoadErrorRef.current?.('모델 로딩 실패');
    }
  }, [unityInstanceRef]);

  // 배경 토글
  const toggleBackground = useCallback(() => {
    if (!unityInstanceRef.current) return;
    
    try {
      setBackgroundDark(!backgroundDark);
      unityInstanceRef.current.SendMessage('BackgroundController', 'ToggleBackground');
    } catch (error) {
      console.error('배경 토글 실패:', error);
    }
  }, [backgroundDark]);

  // 링크 복사
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('링크 복사 실패:', error);
    }
  };

  // 컴포넌트 마운트 시 Unity 초기화
  useEffect(() => {
    if (containerRef.current && canvasRef.current) {
      initUnityWebGL();
    }
  }, [initUnityWebGL]);

  // 모델 경로 변경 시 Unity에 전송
  useEffect(() => {
    if (unityInstanceRef.current && modelPath) {
      loadModelInUnity(modelPath);
    }
  }, [modelPath, loadModelInUnity]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (unityInstanceRef.current) {
        try {
          unityInstanceRef.current.Quit();
        } catch (error) {
          console.warn('Unity 정리 중 오류:', error);
        }
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900">
      {/* 프로모션 헤더 */}
      {showPromoHeader && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-3 text-center">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">🎨 LivingBrush AR - Unity WebGL 뷰어</span>
            <button 
              onClick={() => setShowPromoHeader(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Unity Canvas 컨테이너 */}
      <div 
        ref={containerRef}
        className="relative w-full h-full"
        style={{ 
          paddingTop: showPromoHeader ? '60px' : '0px',
          background: backgroundDark ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' : 'linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 50%, #cce7ff 100%)'
        }}
      >
        {/* Unity Canvas */}
        <canvas
          ref={canvasRef}
          id="unity-canvas"
          className="w-full h-full block"
          style={{
            touchAction: 'manipulation',
            outline: 'none'
          }}
        />

        {/* 로딩 오버레이 */}
      {status === 'loading' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium">Unity WebGL 로딩 중...</p>
              <p className="text-sm opacity-75 mt-2">{debugInfo}</p>
            </div>
        </div>
      )}
      
        {/* 에러 오버레이 */}
      {status === 'error' && (
          <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-10">
            <div className="text-center text-white p-6">
              <div className="text-4xl mb-4">❌</div>
              <h3 className="text-xl font-bold mb-2">Unity WebGL 로딩 실패</h3>
              <p className="text-sm opacity-90 mb-4">{errorMessage}</p>
            <button 
                onClick={() => {
                  setStatus('loading');
                  setErrorMessage('');
                  initUnityWebGL();
                }}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}
      
        {/* 컨트롤 버튼들 */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
          {/* 배경 토글 버튼 */}
          <button 
            onClick={toggleBackground}
            className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full transition-all duration-200 shadow-lg"
            title="배경 테마 변경"
          >
            {backgroundDark ? '☀️' : '🌙'}
          </button>

          {/* 작품 정보 버튼 */}
          {artwork && (
            <button 
              onClick={() => setShowArtistInfo(!showArtistInfo)}
              className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full transition-all duration-200 shadow-lg"
              title="작품 정보"
            >
              ℹ️
            </button>
          )}
            
          {/* 공유 버튼 */}
            <button 
            onClick={() => setShowShareModal(true)}
            className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full transition-all duration-200 shadow-lg"
            title="공유하기"
          >
            📤
            </button>
        </div>
      
        {/* 작품 정보 모달 */}
      {showArtistInfo && artwork && (
          <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-md text-white p-4 rounded-lg max-w-sm z-30">
            <h3 className="font-bold text-lg mb-2">{artwork.title}</h3>
            <p className="text-sm opacity-90 mb-2">작가: {artwork.user?.nickname || 'Unknown'}</p>
            <p className="text-xs opacity-75">{artwork.description}</p>
                <button 
                  onClick={() => setShowArtistInfo(false)}
              className="absolute top-2 right-2 text-white/60 hover:text-white"
                >
              ✕
                </button>
        </div>
      )}
      
        {/* 공유 모달 */}
      {showShareModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-bold mb-4">작품 공유하기</h3>
              <div className="space-y-3">
                <button 
                  onClick={handleCopyLink}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition-colors"
                >
                  {copySuccess ? '✅ 링크 복사됨!' : '🔗 링크 복사'}
                </button>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: artwork?.title || 'LivingBrush AR 작품',
                        url: window.location.href
                      });
                    }
                  }}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded transition-colors"
                >
                  📱 공유하기
                </button>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded transition-colors"
                >
                  취소
                </button>
              </div>
                        </div>
          </div>
        )}
        

      </div>
    </div>
  );
}