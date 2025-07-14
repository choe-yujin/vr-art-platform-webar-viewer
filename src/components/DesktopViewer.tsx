'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface DesktopViewerProps {
  modelPath: string;
  onLoadComplete?: () => void;
  onLoadError?: (error: string) => void;
  autoRotate?: boolean;
  rotationSpeed?: number;
}

export default function DesktopViewer({ 
  modelPath, 
  onLoadComplete, 
  onLoadError,
  autoRotate = true,
  rotationSpeed = 0.002
}: DesktopViewerProps) {
  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('3D 뷰어 초기화 중...');
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  
  // 🔧 배포용 상태 추가
  const [showPromoHeader, setShowPromoHeader] = useState<boolean>(true);
  const [showArtistInfo, setShowArtistInfo] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const cleanupRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // 🔧 진행률 추적 refs 수정 (547% 문제 해결)
  const mainModelLoadedRef = useRef(false);
  const progressClampedRef = useRef(false);
  const totalProgressEventsRef = useRef(0); // 🆕 전체 progress 이벤트 수 추적
  const completedProgressEventsRef = useRef(0); // 🆕 완료된 progress 이벤트 수 추적
  
  // Three-Icosa 상태 (재렌더링 방지)
  const threeIcosaStateRef = useRef({
    isLoading: false,
    isLoaded: false,
    hasError: false
  });
  
  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));

  const loadModelForDesktop = useCallback(async (scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) => {
    try {
      console.log('🔄 순수 3D 모델 로딩 시작:', modelPath);
      
      const loader = new GLTFLoader();
      let threeIcosaLoaded = false;
      
      // Three-Icosa 재렌더링 방지
      if (!threeIcosaStateRef.current.isLoading && !threeIcosaStateRef.current.isLoaded) {
        threeIcosaStateRef.current.isLoading = true;
        
        try {
          setDebugInfo('Three-Icosa 브러시 확장 로딩 중...');
          
          const threeIcosaModule = await import('three-icosa');
          const { GLTFGoogleTiltBrushMaterialExtension } = threeIcosaModule;
          
          if (GLTFGoogleTiltBrushMaterialExtension) {
            const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
            loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
            
            console.log('✅ 순수 3D용 Three-Icosa 확장자 등록 완료');
            threeIcosaStateRef.current.isLoaded = true;
            threeIcosaLoaded = true;
            setDebugInfo('Three-Icosa 브러시 로드 완료!');
          }
        } catch (icosaError) {
          console.warn('⚠️ Three-Icosa 로드 실패 (기본 모드):', icosaError);
          threeIcosaStateRef.current.hasError = true;
          setDebugInfo('기본 모드로 로딩...');
        }
        
        threeIcosaStateRef.current.isLoading = false;
      } else if (threeIcosaStateRef.current.isLoaded) {
        threeIcosaLoaded = true;
        console.log('✅ Three-Icosa 이미 로드됨 (재사용)');
      }

      return new Promise((resolve, reject) => {
        setDebugInfo(`${threeIcosaLoaded ? 'Tilt Brush' : '기본'} 모델 로딩 중...`);
        
        // 🔧 진행률 추적 초기화
        mainModelLoadedRef.current = false;
        progressClampedRef.current = false;
        totalProgressEventsRef.current = 0;
        completedProgressEventsRef.current = 0;
        
        loader.load(
          modelPath,
          (gltf) => {
            console.log('🎉 순수 3D 모델 로딩 성공!');
            
            // 🔧 메인 모델 로딩 완료 표시 (100%로 고정)
            mainModelLoadedRef.current = true;
            if (!progressClampedRef.current) {
              setLoadingProgress(100);
              progressClampedRef.current = true;
              console.log('📊 진행률을 100%로 고정 (추가 에셋 로딩 무시)');
            }
            
            scene.add(gltf.scene);
            
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            controls.target.copy(center);
            
            const maxDimension = Math.max(size.x, size.y, size.z);
            const distance = maxDimension * 0.5;
            
            const originalDistance = Math.sqrt(3);
            const scale = distance / originalDistance;
            
            camera.position.set(
              1 * scale + center.x,
              1 * scale + center.y, 
              1 * scale + center.z
            );
            
            controls.update();
            
            console.log('✅ 순수 3D 모델이 씬에 추가됨');
            setDebugInfo(`모델 로딩 완료! ${threeIcosaLoaded ? '(Tilt Brush)' : '(기본)'}`);
            
            resolve(gltf);
          },
          (progress) => {
            // 🔧 547% 문제 해결: 메인 모델만 진행률 추적
            if (progress.total > 0 && !mainModelLoadedRef.current && !progressClampedRef.current) {
              const percent = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
              setLoadingProgress(percent);
              setDebugInfo(`모델 로딩... ${percent}%`);
              
              // 🔧 메인 모델 로딩 진행률만 로그
              console.log(`📊 메인 모델 로딩: ${percent}% (${progress.loaded}/${progress.total} bytes)`);
              
              // 🔧 100% 도달 시 추가 progress 이벤트 무시 설정
              if (percent >= 100) {
                progressClampedRef.current = true;
                console.log('🔒 메인 모델 100% 완료 - 추가 progress 이벤트 무시');
              }
            } else if (progressClampedRef.current) {
              // 🔧 Three-Icosa 브러시 에셋 로딩은 진행률에 반영하지 않음
              totalProgressEventsRef.current++;
              if (progress.loaded >= progress.total) {
                completedProgressEventsRef.current++;
              }
              
              console.log(`🎨 브러시 에셋 로딩 (진행률 무시): ${completedProgressEventsRef.current}/${totalProgressEventsRef.current} 완료`);
            }
          },
          (loadError) => {
            console.error('❌ 순수 3D 모델 로딩 실패:', loadError);
            const errorMessage = loadError instanceof Error ? loadError.message : 'Unknown error';
            setDebugInfo(`모델 로딩 실패: ${errorMessage}`);
            reject(loadError);
          }
        );
      });
      
    } catch (error) {
      console.error('❌ 순수 3D 모델 로더 초기화 실패:', error);
      throw error;
    }
  }, [modelPath]);

  const initializeDesktop3D = useCallback(async () => {
    try {
      console.log('🖥️ 순수 3D 뷰어 초기화 시작');
      setDebugInfo('3D 씬 초기화 중...');
      setLoadingProgress(5);
      
      if (!containerRef.current) {
        throw new Error('Container not found');
      }
      
      containerRef.current.innerHTML = '';
      
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      scene.add(camera);
      
      camera.position.set(1, 1, 1);
      camera.setRotationFromEuler(new THREE.Euler(0.2, 1, -0.25));
      
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      
      controls.minDistance = 0.1;
      controls.maxDistance = 100;
      controls.maxPolarAngle = Math.PI;
      
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = rotationSpeed * 5;

      console.log('✅ 순수 3D 씬 초기화 완료');
      setDebugInfo('3D 모델 로딩 중...');
      setLoadingProgress(10);

      await loadModelForDesktop(scene, camera, controls);

      setStatus('active');
      setDebugInfo('순수 3D 뷰어 완료!');
      // 🔧 최종 완료 시에도 100% 유지 (547% 방지)
      if (loadingProgress <= 100) {
        setLoadingProgress(100);
      }
      onLoadComplete?.();

      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);

      console.log('🎉 순수 3D 뷰어 초기화 완료');

    } catch (error) {
      console.error('❌ 순수 3D 뷰어 초기화 실패:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setErrorMessage(errorMsg);
      setStatus('error');
      setDebugInfo(`3D 뷰어 오류: ${errorMsg}`);
      onLoadError?.(errorMsg);
    }
  }, [autoRotate, rotationSpeed, loadModelForDesktop, onLoadComplete, onLoadError, loadingProgress]);

  useEffect(() => {
    if (!containerRef.current || initializationRef.current || cleanupRef.current) {
      return;
    }
    
    console.log(`✅ DesktopViewer 초기화 시작 [${renderIdRef.current}]`);
    initializationRef.current = true;
    
    const currentRenderId = renderIdRef.current;
    
    initializeDesktop3D();

    return () => {
      console.log(`🧹 DesktopViewer 정리 [${currentRenderId}]`);
      cleanupRef.current = true;
      
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      
      initializationRef.current = false;
    };
  }, [initializeDesktop3D]);

  // 🔧 공유 링크 복사 함수
  const handleCopyLink = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      // 폴백: 텍스트 선택
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ backgroundColor: '#000000' }}
      />
      
      {/* 🔧 프로모션 헤더 (상단) */}
      {showPromoHeader && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-3 z-50 shadow-lg">
          <div className="flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">🎨</div>
              <div>
                <p className="font-bold text-lg">BAUhaus AR 앱이 8월에 공개됩니다!</p>
                <p className="text-sm opacity-90">VR로 그린 3D 작품을 AR로 감상하는 새로운 경험을 만나보세요</p>
              </div>
            </div>
            <button 
              onClick={() => setShowPromoHeader(false)}
              className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* 🔧 로딩 (547% 문제 해결된 진행률 표시) */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
          <div className="text-center max-w-sm px-6">
            {/* 🔧 진행률 100% 제한 */}
            <div className="mb-6">
              <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, loadingProgress)}%` }}
                ></div>
              </div>
              <p className="text-sm opacity-75">
                {Math.min(100, Math.round(loadingProgress))}% 완료
              </p>
            </div>
            
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">3D 뷰어 로딩 중...</p>
            <p className="text-sm opacity-50 mt-2">{debugInfo}</p>
            
            {/* 🔧 로딩 단계 표시 (547% 방지) */}
            <div className="mt-4 text-xs opacity-60">
              {loadingProgress < 10 && "🔧 3D 엔진 초기화..."}
              {loadingProgress >= 10 && loadingProgress < 90 && "📦 3D 모델 다운로드..."}
              {loadingProgress >= 90 && loadingProgress < 100 && "🎨 브러시 정보 처리..."}
              {loadingProgress >= 100 && "✅ 완료!"}
            </div>
            
            {/* 🔧 브러시 에셋 로딩 상태 표시 (진행률과 별도) */}
            {mainModelLoadedRef.current && totalProgressEventsRef.current > 0 && (
              <div className="mt-2 text-xs opacity-40">
                🎨 브러시 에셋: {completedProgressEventsRef.current}/{totalProgressEventsRef.current}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 에러 */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-red-900/80 z-10">
          <div className="text-center p-6">
            <p className="text-lg font-bold mb-2">⚠️ 오류 발생</p>
            <p className="text-sm opacity-75 mb-4">{errorMessage}</p>
            <p className="text-xs opacity-50 mb-4">디버그: {debugInfo}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-white/20 px-4 py-2 rounded hover:bg-white/30 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}
      
      {/* 🔧 작품 정보 (왼쪽 하단으로 변경) */}
      {status === 'active' && (
        <div className="absolute bottom-6 left-6 bg-black/70 backdrop-blur-md text-white p-4 rounded-xl z-10">
          <div className="text-left">
            <p className="font-bold text-lg">작품명: 폴라리스</p>
            <p className="text-sm opacity-75 mt-1">VR로 창작된 3D 아트워크</p>
          </div>
        </div>
      )}
      
      {/* 🔧 플로팅 버튼들 (오른쪽 하단) */}
      {status === 'active' && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-20">
          <button 
            onClick={() => setShowShareModal(true)}
            className="bg-white/20 backdrop-blur-md text-white px-4 py-3 rounded-xl hover:bg-white/30 transition-all duration-200 shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              <span>공유하기</span>
            </div>
          </button>
          
          <button 
            onClick={() => setShowArtistInfo(true)}
            className="bg-white/20 backdrop-blur-md text-white px-4 py-3 rounded-xl hover:bg-white/30 transition-all duration-200 shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>작가정보</span>
            </div>
          </button>
        </div>
      )}
      
      {/* 🔧 작가 정보 모달 */}
      {showArtistInfo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">호</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">호우 (Hou)</h3>
              <p className="text-gray-600 mb-4">VR 3D 아티스트</p>
              
              <div className="space-y-3">
                <a 
                  href="https://instagram.com/livingbrush_hou" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white py-2 px-4 rounded-lg hover:from-pink-600 hover:to-purple-600 transition-all"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span>@livingbrush_hou</span>
                </a>
              </div>
              
              <button 
                onClick={() => setShowArtistInfo(false)}
                className="mt-4 w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 🔧 공유하기 모달 */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="text-4xl mb-4">🔗</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">작품 공유하기</h3>
              <p className="text-gray-600 mb-4">이 링크를 복사하여 친구들과 공유해보세요</p>
              
              <div className="bg-gray-100 p-3 rounded-lg mb-4 break-all text-sm text-gray-700">
                {window.location.href}
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={handleCopyLink}
                  className={`w-full py-2 px-4 rounded-lg transition-all ${
                    copySuccess 
                      ? 'bg-green-500 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {copySuccess ? (
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>복사 완료!</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>링크 복사</span>
                    </div>
                  )}
                </button>
                
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}