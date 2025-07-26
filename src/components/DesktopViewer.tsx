
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
  const [renderMode, setRenderMode] = useState<'three-icosa' | 'basic-gltf'>('three-icosa');
  
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

  // 🎯 실제 렌더링 여부 검증 (화면에 보이는지 확인)
  const validateActualRendering = (gltfScene: THREE.Object3D, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): boolean => {
    try {
      // 렌더링 전후 픽셀 체크
      const canvas = renderer.domElement;
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (!gl) return false;
      
      // 한 프레임 렌더링
      renderer.render(scene, camera);
      
      // 중앙 픽셀 샘플링 (검은 배경이 아닌지 확인)
      const pixels = new Uint8Array(4);
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      
      gl.readPixels(centerX, centerY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      
      // RGB 값이 모두 0이 아니면 뭔가 렌더링됨
      const hasContent = pixels[0] > 0 || pixels[1] > 0 || pixels[2] > 0;
      
      console.log(`🔍 실제 렌더링 검증: 중앙 픽셀 RGB(${pixels[0]}, ${pixels[1]}, ${pixels[2]}) = ${hasContent ? '렌더링됨' : '검은화면'}`);
      
      return hasContent;
      
    } catch (error) {
      console.warn('⚠️ 렌더링 검증 실패:', error);
      return false;
    }
  };

  const tryThreeIcosaBrushes = useCallback(async (gltfScene: THREE.Object3D, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): Promise<boolean> => {
    try {
      const { processAllBrushes, setupTextureErrorHandling } = await import('../utils/threeicosa');
      
      console.log('🎨 Three-Icosa 브러시 처리 시도...');
      
      // 텍스처 에러 핸들링 설정 (S3 403 에러 대응)
      setupTextureErrorHandling();
      
      // 브러시 처리 시도
      const result = await processAllBrushes(gltfScene);
      
      if (!result.success) {
        console.warn('⚠️ Three-Icosa 브러시 처리 실패');
        return false;
      }
      
      console.log(`🎨 Three-Icosa 처리 완료: ${result.processed}개 처리됨`);
      
      // 2초 후 실제 렌더링 여부 검증
      return new Promise((resolve) => {
        setTimeout(() => {
          const isActuallyRendered = validateActualRendering(gltfScene, renderer, scene, camera);
          console.log(`🎨 Three-Icosa 처리 결과: ${isActuallyRendered ? '화면에 보임' : '화면에 안 보임'}`);
          resolve(isActuallyRendered);
        }, 2000);
      });
      
    } catch (error) {
      console.warn('⚠️ Three-Icosa 처리 실패:', error);
      return false;
    }
  }, []);

  // 🔧 순수 GLB로 다시 로딩 (Three-Icosa 완전 제거)
  const fallbackToPureGLTF = useCallback(async (scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) => {
    console.log('🔧 순수 GLB 렌더링으로 재시도...');
    
    // 기존 씬 정리
    scene.clear();
    
    // 조명 다시 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(10, 10, 5);
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-10, -10, -5);
    scene.add(directionalLight2);
    
    // Three-Icosa 없이 순수 GLTFLoader로 다시 로딩
    const loader = new GLTFLoader();
    
    try {
      const gltf = await loader.loadAsync(modelPath);
      console.log('📦 순수 GLB 로딩 완료');
      
      // Three-Icosa 처리 없이 바로 씬에 추가
      scene.add(gltf.scene);
      
      // 모든 메시 활성화
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.visible = true;
          child.frustumCulled = false;
        }
      });
      
      // 카메라 재설정
      const boundingBox = new THREE.Box3().setFromObject(gltf.scene);
      const box = boundingBox.isEmpty() 
        ? new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2))
        : boundingBox;
      
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      controls.target.copy(center);
      const maxDimension = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * Math.PI / 180;
      const distance = maxDimension / (2 * Math.tan(fov / 2)) * 1.8;
      
      camera.position.set(
        center.x + distance * 0.7,
        center.y + distance * 0.5,
        center.z + distance * 0.7
      );
      
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      controls.update();
      
      setRenderMode('basic-gltf');
      setDebugInfo('순수 GLB 렌더링 성공');
      
      console.log('✅ 순수 GLB 렌더링 완료');
      
    } catch (error) {
      console.error('❌ 순수 GLB 로딩도 실패:', error);
      throw error;
    }
  }, [modelPath]);

  const loadModelForDesktop = useCallback(async (scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) => {
    try {
      // 🔥 근본 해결: Three-Icosa 익스텐션이 등록된 GLTFLoader를 먼저 얻어오기
      const { processAllBrushes } = await import('../utils/threeicosa');
      const dummyObject = new THREE.Object3D();
      const brushResult = await processAllBrushes(dummyObject);
      
      let loader: GLTFLoader;
      
      if (brushResult.success && brushResult.gltfLoader) {
        // Three-Icosa 익스텐션이 등록된 GLTFLoader 사용
        loader = brushResult.gltfLoader;
        console.log('✅ Three-Icosa 익스텐션이 등록된 GLTFLoader 사용');
        setRenderMode('three-icosa');
      } else {
        // 기본 GLTFLoader 사용
        loader = new GLTFLoader();
        console.log('⚠️ Three-Icosa 실패, 기본 GLTFLoader 사용');
        setRenderMode('basic-gltf');
      }
      
      const gltf = await loader.loadAsync(modelPath, (progress) => {
        if (progress.total > 0) {
          const percent = Math.min(Math.round((progress.loaded / progress.total) * 100), 99);
          setDebugInfo(`모델 로딩... ${percent}%`);
        }
      });
      
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
      
      console.log('💡 조명 시스템 추가됨');
      
      // 모델을 씬에 추가
      scene.add(gltf.scene);
      
      if (brushResult.success) {
        console.log(`🎨 Three-Icosa 브러시 처리 완료: ${brushResult.processed}개 처리됨`);
        setDebugInfo('Three-Icosa 브러시 렌더링 성공');
      } else {
        setDebugInfo('기본 GLTF 렌더링 모드');
      }
      
      // 바운딩 박스 계산 및 카메라 설정
      const boundingBox = new THREE.Box3().setFromObject(gltf.scene);
      
      const box = boundingBox.isEmpty() 
        ? (() => {
            console.warn('⚠️ 바운딩 박스 계산 실패, 기본값 사용');
            return new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2));
          })()
        : boundingBox;
      
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      console.log('📊 바운딩 정보:', { center, size });
      
      // 카메라 설정
      controls.target.copy(center);
      const maxDimension = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * Math.PI / 180;
      const distance = maxDimension / (2 * Math.tan(fov / 2)) * 1.8;
      
      camera.position.set(
        center.x + distance * 0.7,
        center.y + distance * 0.5,
        center.z + distance * 0.7
      );
      
      camera.lookAt(center);
      camera.near = Math.max(0.01, distance / 100);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      
      controls.minDistance = distance * 0.1;
      controls.maxDistance = distance * 10;
      controls.update();
      
      console.log('✅ 카메라 및 컨트롤 설정 완료');
      
      // 모델 가시성 설정
      let visibleMeshCount = 0;
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.visible = true;
          child.frustumCulled = false;
          visibleMeshCount++;
        }
      });
      
      console.log(`👁️ 총 ${visibleMeshCount}개 메시 활성화`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ 모델 로딩 오류:', error);
      setDebugInfo(`모델 로딩 실패: ${errorMessage}`);
      throw error;
    }
  }, [modelPath, fallbackToPureGLTF, tryThreeIcosaBrushes]);

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
      const color = backgroundDark ? 0x000000 : 0xd3c7b8;
      console.log('🎭 Three.js 씬 배경 변경:', backgroundDark ? '검은색' : '어두운 베이지');
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
        style={{ backgroundColor: backgroundDark ? '#000000' : '#d3c7b8' }}
      />
      
      {/* 렌더 모드 표시 */}
      {status === 'active' && (
        <div className="fixed top-20 left-6 bg-black/70 backdrop-blur-md text-white px-3 py-2 rounded-lg z-10 text-sm">
          {renderMode === 'three-icosa' ? '🎨 VR 브러시 렌더링' : '📦 기본 GLTF 렌더링'}
        </div>
      )}
      
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