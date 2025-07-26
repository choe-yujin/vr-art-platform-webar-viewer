'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ArtworkResponse } from '@/utils/api';

interface DesktopViewerProps {
  modelPath: string;
  artwork?: ArtworkResponse | null;
  onLoadComplete?: () => void;
  onLoadError?: (error: string) => void;
  autoRotate?: boolean;
  rotationSpeed?: number;
}

export default function DesktopViewer({ 
  modelPath, 
  artwork,
  onLoadComplete, 
  onLoadError,
  autoRotate = true,
  rotationSpeed = 0.05
}: DesktopViewerProps) {
  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('3D 뷰어 초기화 중...');
  
  const [showPromoHeader, setShowPromoHeader] = useState<boolean>(true);
  const [showArtistInfo, setShowArtistInfo] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [backgroundDark, setBackgroundDark] = useState<boolean>(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onLoadErrorRef = useRef(onLoadError);
  
  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete;
    onLoadErrorRef.current = onLoadError;
  }, [onLoadComplete, onLoadError]);

  // 🔥 기본 GLTF 뷰어로 fallback 하는 함수
  const loadBasicGLTF = useCallback(async (scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) => {
    console.log('🔄 기본 GLTF 뷰어로 fallback 시도...');
    setDebugInfo('호환성 문제 감지됨, 기본 모드로 전환 중...');
    
    const basicLoader = new GLTFLoader();
    const gltf = await basicLoader.loadAsync(modelPath);
    
    // 조명 시스템 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    scene.add(gltf.scene);
    
    // 바운딩 박스 계산 및 카메라 설정
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDimension = Math.max(size.x, size.y, size.z);
    camera.position.set(
      center.x + maxDimension * 1.5,
      center.y + maxDimension * 1.5,
      center.z + maxDimension * 1.5
    );
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
    
    // 모든 메시 활성화 (원본 재질 유지)
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.visible = true;
        child.frustumCulled = false;
        // 원본 재질 그대로 유지 - 아무것도 변경하지 않음
      }
    });
    
    setDebugInfo('기본 모드로 로딩 완료! (호환성 모드)');
    console.log('✅ 기본 GLTF 뷰어로 성공적으로 로드됨');
  }, [modelPath]);

  // 🔥 실제 화면 렌더링 결과 검증 함수 (픽셀 기반 검사)
  const verifyActualRendering = useCallback((renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): boolean => {
    try {
      // 임시 렌더 타겟 생성 (512x512 해상도)
      const testSize = 512;
      const renderTarget = new THREE.WebGLRenderTarget(testSize, testSize);
      
      // 현재 렌더러 상태 저장
      const originalRenderTarget = renderer.getRenderTarget();
      
      // 테스트 렌더링
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      
      // 색상 데이터 읽기
      const pixelBuffer = new Uint8Array(testSize * testSize * 4);
      renderer.readRenderTargetPixels(renderTarget, 0, 0, testSize, testSize, pixelBuffer);
      
      // 색상 데이터 분석
      let nonBlackPixels = 0;
      let totalBrightness = 0;
      
      for (let i = 0; i < pixelBuffer.length; i += 4) {
        const r = pixelBuffer[i];
        const g = pixelBuffer[i + 1];
        const b = pixelBuffer[i + 2];
        
        // 비배경색 (0,0,0)이 아닌 픽셀 카운트
        if (r > 10 || g > 10 || b > 10) {
          nonBlackPixels++;
          totalBrightness += (r + g + b);
        }
      }
      
      const totalPixels = testSize * testSize;
      const nonBlackPercentage = (nonBlackPixels / totalPixels) * 100;
      const avgBrightness = nonBlackPixels > 0 ? totalBrightness / (nonBlackPixels * 3) : 0;
      
      console.log(`🖼️ 픽셀 기반 렌더링 검증: 비배경색 ${nonBlackPercentage.toFixed(2)}%, 평균 밝기 ${avgBrightness.toFixed(1)}/255`);
      
      // 원래 렌더 타겟 복원
      renderer.setRenderTarget(originalRenderTarget);
      renderTarget.dispose();
      
      // 판정 기준: 비배경색 픽셀이 0.5% 이상이고 평균 밝기가 20 이상
      const isActuallyRendered = nonBlackPercentage > 0.5 && avgBrightness > 20;
      
      console.log(`🎯 최종 판정: ${isActuallyRendered ? '실제 렌더링 성공' : '검은 화면 또는 빈 렌더링'}`);
      
      return isActuallyRendered;
      
    } catch (error) {
      console.error('❌ 픽셀 기반 렌더링 검증 실패:', error);
      return false;
    }
  }, []);

  const loadModelForDesktop = useCallback(async (scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) => {
    let fallbackExecuted = false;
    
    try {
      const loader = new GLTFLoader();
      let threeIcosaLoaded = false;
      
      // 🔥 안정적인 three-icosa 처리
      try {
        const { GLTFGoogleTiltBrushMaterialExtension } = await import('three-icosa');
        const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
        loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
        threeIcosaLoaded = true;
        console.log('✅ Three-Icosa 확장자 등록 성공');
      } catch (icosaError) {
        console.warn('⚠️ Three-Icosa 로드 실패:', icosaError);
        threeIcosaLoaded = false;
        
        // Three-icosa 로드 실패 시 바로 기본 뷰어로 fallback
        console.log('🔄 Three-icosa 로드 실패로 인한 기본 뷰어 fallback');
        setDebugInfo('VR 브러시 로드 실패, 기본 모드로 전환 중...');
        await loadBasicGLTF(scene, camera, controls);
        return;
      }

      // 🔥 타임아웃 설정: 15초 이내에 로딩 완료되지 않으면 에러 처리
      const loadPromise = loader.loadAsync(modelPath, (progress) => {
        if (progress.total > 0) {
          const percent = Math.min(Math.round((progress.loaded / progress.total) * 100), 99);
          setDebugInfo(`모델 로딩... ${percent}%`);
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('모델 로딩 타임아웃 (15초 초과)')), 15000);
      });

      const gltf = await Promise.race([loadPromise, timeoutPromise]) as { scene: THREE.Group };
      
      console.log('🎯 GLB 모델 로드 완료');
      
      // 조명 시스템 추가
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      
      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight1.position.set(10, 10, 5);
      scene.add(directionalLight1);
      
      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
      directionalLight2.position.set(-10, -10, -5);
      scene.add(directionalLight2);
      
      scene.add(gltf.scene);
      
      // 바운딩 박스 계산 및 카메라 설정
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      controls.target.copy(center);
      
      const maxDimension = Math.max(size.x, size.y, size.z);
      const distance = maxDimension * 0.7;
      const originalDistance = Math.sqrt(3);
      const scale = distance / originalDistance;
      
      camera.position.set(
        center.x + scale,
        center.y + scale, 
        center.z + scale
      );
      camera.lookAt(center);
      controls.update();
      
      // 모든 메시 활성화
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.visible = true;
          child.frustumCulled = false;
        }
      });
      
      // 🔥 중복 방지 fallback 검증
      const performFallback = async () => {
        if (fallbackExecuted) {
          console.log('⚠️ 이미 fallback 실행됨, 중복 방지');
          return;
        }
        fallbackExecuted = true;
        
        console.warn('🚨 Three-icosa 렌더링 실패 감지. 기본 GLTF 뷰어로 fallback...');
        setDebugInfo('렌더링 문제 감지됨, 기본 모드로 전환 중...');
        
        // 기존 씬 클리어
        while(scene.children.length > 0) {
          scene.remove(scene.children[0]);
        }
        
        // 기본 GLTF 뷰어로 로드
        try {
          await loadBasicGLTF(scene, camera, controls);
        } catch (fallbackError) {
          console.error('❌ 기본 GLTF 뷰어 fallback도 실패:', fallbackError);
          throw new Error('모든 로딩 방법이 실패했습니다.');
        }
      };
      
      // 2초 후 렌더링 검증
      setTimeout(async () => {
        if (fallbackExecuted) return;
        
        console.log('🔍 렌더링 검증 시작...');
        
        // 픽셀 기반 실제 렌더링 검증
        const pixelCheck = verifyActualRendering(rendererRef.current!, scene, camera);
        
        if (!pixelCheck) {
          await performFallback();
        } else {
          console.log('✅ 렌더링 검증 통과: 모델이 정상 렌더링 중');
          setDebugInfo(`모델 로딩 완료! ${threeIcosaLoaded ? '(VR 브러시 지원)' : '(기본 모드)'}`);
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ Three-icosa 모델 로딩 오류:', error);
      
      // 🔥 에러 발생 시 자동으로 기본 GLTF 뷰어로 fallback
      if (!fallbackExecuted) {
        try {
          console.log('🔄 에러 발생으로 인한 기본 뷰어 fallback 시도...');
          setDebugInfo('오류가 발생했습니다. 기본 모드로 복구 중...');
          
          // 기존 씬 클리어
          while(scene.children.length > 0) {
            scene.remove(scene.children[0]);
          }
          
          await loadBasicGLTF(scene, camera, controls);
        } catch (fallbackError) {
          const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
          console.error('❌ 기본 뷰어 fallback도 실패:', fallbackError);
          setDebugInfo(`모든 로딩 방법이 실패: ${errorMessage}`);
          throw fallbackError;
        }
      }
    }
  }, [modelPath, loadBasicGLTF, verifyActualRendering]);

  const initializeDesktop3D = useCallback(() => {
    let resizeHandler: (() => void) | null = null;
    try {
      console.log('🖥️ 3D 뷰어 초기화 시작');
      setDebugInfo('3D 씬 초기화 중...');
      
      if (!containerRef.current) throw new Error('Container not found');
      
      const container = containerRef.current;
      container.innerHTML = '';
      
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      sceneRef.current = scene;
      
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      scene.add(camera);
      camera.position.set(1, 1, 1);
      
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = rotationSpeed * 5;

      loadModelForDesktop(scene, camera, controls)
        .then(() => {
          setStatus('active');
          if (onLoadCompleteRef.current) onLoadCompleteRef.current();
        })
        .catch((e: unknown) => { 
          setStatus('error'); 
          const errorMsg = e instanceof Error ? e.message : String(e);
          setErrorMessage(errorMsg);
          if (onLoadErrorRef.current) onLoadErrorRef.current(errorMsg);
        });

      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      resizeHandler = () => {
        if (!rendererRef.current || !containerRef.current) return;
        camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();
        rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      };
      window.addEventListener('resize', resizeHandler);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setErrorMessage(errorMsg);
      setStatus('error');
      if (onLoadErrorRef.current) onLoadErrorRef.current(errorMsg);
    }
    
    return () => {
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
    };
  }, [autoRotate, rotationSpeed, loadModelForDesktop]);

  useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;
    
    const currentRenderId = renderIdRef.current;
    const currentContainer = containerRef.current;
    console.log(`✅ DesktopViewer 초기화 시작 [${currentRenderId}]`);
    const cleanupResize = initializeDesktop3D();

    return () => {
      console.log(`🧹 DesktopViewer 정리 [${currentRenderId}]`);
      if (cleanupResize) cleanupResize();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      const scene = sceneRef.current;
      if (scene) {
        scene.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.geometry?.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(material => material?.dispose());
          }
        });
      }
      sceneRef.current = null;

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current = null;
      }
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }
      
      initializationRef.current = false;
    };
  }, [initializeDesktop3D]);

  // 배경색 변경 효과
  useEffect(() => {
    console.log('🌌 배경색 변경 useEffect 실행, backgroundDark:', backgroundDark);
    if (sceneRef.current) {
      const color = backgroundDark ? 0x000000 : 0xECFFFF;
      console.log('🎭 Three.js 씬 배경 변경:', backgroundDark ? '검은색' : '하늘색');
      sceneRef.current.background = new THREE.Color(color);
    }
  }, [backgroundDark]);

  const toggleBackground = () => {
    setBackgroundDark(prev => !prev);
  };

  const handleCopyLink = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
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
        style={{ backgroundColor: backgroundDark ? '#000000' : '#ECFFFF' }}
      />
      
      {/* 프로모션 헤더 */}
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
      
      {/* 로딩 */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">3D 뷰어 로딩 중...</p>
            <p className="text-sm opacity-50 mt-2">{debugInfo}</p>
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
      
      {/* 작품 정보 */}
      {status === 'active' && artwork && (
        <div className="absolute bottom-6 left-4 md:left-6 bg-black/70 backdrop-blur-md text-white p-3 md:p-4 rounded-xl z-10 max-w-xs md:max-w-md">
          <div className="text-left">
            <h2 className="font-bold text-lg md:text-xl mb-1 md:mb-2">{artwork.title}</h2>
            {artwork.description && (
              <p className="text-xs md:text-sm opacity-75 mb-2 md:mb-3 leading-relaxed line-clamp-2">
                {artwork.description}
              </p>
            )}
            <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm">
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-red-400">❤️</span>
                <span>{artwork.favoriteCount?.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-blue-400">👁️</span>
                <span>{artwork.viewCount?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 배경색 토글 버튼 */}
      {status === 'active' && (
        <div className="fixed top-6 right-6 z-30">
          <button 
            onClick={toggleBackground}
            className="bg-white/20 backdrop-blur-md text-white p-3 rounded-full hover:bg-white/30 transition-all duration-200 shadow-lg"
            title={backgroundDark ? '밝은 배경으로 변경' : '검은색 배경으로 변경'}
          >
            {backgroundDark ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      )}
      
      {/* 플로팅 버튼들 */}
      {status === 'active' && (
        <div className="fixed bottom-6 right-4 md:right-6 z-20">
          <div className="flex flex-row md:flex-col gap-2 md:gap-3">
            <button 
              onClick={() => setShowShareModal(true)}
              className="bg-black/70 backdrop-blur-md text-white px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl hover:bg-black/90 transition-all duration-200 shadow-lg flex-1 md:flex-none"
            >
              <div className="flex items-center justify-center md:justify-start space-x-0 md:space-x-2">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                <span className="hidden md:inline text-sm">공유하기</span>
              </div>
            </button>
            
            <button 
              onClick={() => setShowArtistInfo(true)}
              className="bg-black/70 backdrop-blur-md text-white px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl hover:bg-black/90 transition-all duration-200 shadow-lg flex-1 md:flex-none"
            >
              <div className="flex items-center justify-center md:justify-start space-x-0 md:space-x-2">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden md:inline text-sm">작가정보</span>
              </div>
            </button>
          </div>
        </div>
      )}
      
      {/* 작가 정보 모달 */}
      {showArtistInfo && artwork && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                {artwork.user.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={artwork.user.profileImageUrl} 
                    alt={`${artwork.user.nickname}의 프로필`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallbackElement = parent.querySelector('.fallback-avatar') as HTMLElement;
                        if (fallbackElement) {
                          fallbackElement.style.display = 'flex';
                        }
                      }
                    }}
                  />
                ) : null}
                <div className={`fallback-avatar absolute inset-0 w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center ${
                  artwork.user.profileImageUrl ? 'hidden' : 'flex'
                }`}>
                  <span className="text-white text-2xl font-bold">
                    {artwork.user.nickname.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 mb-2">{artwork.user.nickname}</h3>
              <p className="text-gray-600 mb-4">VR 3D 아티스트</p>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-left">
                <h4 className="font-semibold text-gray-800 mb-2">작가 소개</h4>
                <div className="text-sm text-gray-600">
                  {artwork.user.bio ? (
                    <p className="leading-relaxed">{artwork.user.bio}</p>
                  ) : (
                    <p className="text-gray-400 italic">소개글이 없습니다.</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => setShowArtistInfo(false)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 공유하기 모달 */}
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
};