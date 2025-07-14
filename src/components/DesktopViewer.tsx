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
  
  const [showPromoHeader, setShowPromoHeader] = useState<boolean>(true);
  const [showArtistInfo, setShowArtistInfo] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const initializationRef = useRef(false);

  // ✨ 재진입 문제를 해결하기 위해 stateful한 로직을 모두 제거하고, 함수 내에서 처리합니다.
  const loadModelForDesktop = useCallback(async (scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) => {
    try {
      const loader = new GLTFLoader();
      
      try {
        const { GLTFGoogleTiltBrushMaterialExtension } = await import('three-icosa');
        const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
        loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
        console.log('✅ Three-Icosa 확장자 등록 완료');
      } catch (icosaError) {
        console.warn('⚠️ Three-Icosa 로드 실패:', icosaError);
      }

      const gltf = await loader.loadAsync(modelPath, (progress) => {
        if (progress.total > 0) {
          let percent = Math.round((progress.loaded / progress.total) * 100);
          percent = Math.min(percent, 99);
          setDebugInfo(`모델 로딩... ${percent}%`);
        }
      });
      
      scene.add(gltf.scene);
      
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      controls.target.copy(center);
      
      const maxDimension = Math.max(size.x, size.y, size.z);
      // ✨ 모델이 멀어보이는 문제 해결: 카메라 거리 배율을 1.2로 조정 (값을 줄이면 더 가까워짐)
      const distance = maxDimension * 1.2;
      
      camera.position.set(center.x, center.y, center.z + distance);
      camera.lookAt(center);
      
      camera.near = distance / 100;
      camera.far = distance * 100;
      camera.updateProjectionMatrix();

      controls.update();
      setDebugInfo('모델 로딩 완료!');
      
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errMessage.includes('Failed to fetch')) {
        setDebugInfo('모델 로딩 실패: 네트워크 오류. 새로고침 해주세요.');
      } else {
        setDebugInfo(`모델 로딩 실패: ${errMessage}`);
      }
      throw error;
    }
  }, [modelPath]);

  const initializeDesktop3D = useCallback(() => {
    let resizeObserver: ResizeObserver | null = null;
    const currentContainer = containerRef.current;
    
    if (!currentContainer) {
      setErrorMessage('컨테이너를 찾을 수 없습니다.');
      setStatus('error');
      return () => {};
    }

    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      sceneRef.current = scene;
      
      const camera = new THREE.PerspectiveCamera(75, currentContainer.clientWidth / currentContainer.clientHeight, 0.1, 10000);
      scene.add(camera);
      
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      renderer.setSize(currentContainer.clientWidth, currentContainer.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      currentContainer.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = rotationSpeed * 5;

      loadModelForDesktop(scene, camera, controls)
        .then(() => {
          setStatus('active');
          onLoadComplete?.();
        })
        .catch((error: unknown) => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          setErrorMessage(errorMsg);
          setStatus('error');
          onLoadError?.(errorMsg);
        });

      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      resizeObserver = new ResizeObserver(entries => {
        if (!entries || entries.length === 0 || !rendererRef.current) return;
        const { width, height } = entries[0].contentRect;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      });
      resizeObserver.observe(currentContainer);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setErrorMessage(errorMsg);
      setStatus('error');
      onLoadError?.(errorMsg);
    }
    
    return () => {
      if (resizeObserver && currentContainer) {
          resizeObserver.unobserve(currentContainer);
      }
    };
  }, [autoRotate, rotationSpeed, loadModelForDesktop, onLoadComplete, onLoadError]);

  useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;
    
    const cleanupResize = initializeDesktop3D();
    
    return () => {
      if (cleanupResize) cleanupResize();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      initializationRef.current = false;
    };
  }, [initializeDesktop3D]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" style={{ backgroundColor: '#000000' }} />
        
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium">3D 뷰어 로딩 중...</p>
              <p className="text-sm opacity-50 mt-2">{debugInfo}</p>
            </div>
          </div>
        )}

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

        {status === 'active' && (
            <>
            <div className="absolute bottom-6 left-6 bg-black/70 backdrop-blur-md text-white p-4 rounded-xl z-10">
                <div className="text-left">
                <p className="font-bold text-lg">작품명: 폴라리스</p>
                <p className="text-sm opacity-75 mt-1">VR로 창작된 3D 아트워크</p>
                </div>
            </div>
            
            <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-20">
                <button 
                onClick={() => setShowShareModal(true)}
                className="bg-white/20 backdrop-blur-md text-white px-4 py-3 rounded-xl hover:bg-white/30 transition-all duration-200 shadow-lg"
                >
                <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>
                    <span>공유하기</span>
                </div>
                </button>
                
                <button 
                onClick={() => setShowArtistInfo(true)}
                className="bg-white/20 backdrop-blur-md text-white px-4 py-3 rounded-xl hover:bg-white/30 transition-all duration-200 shadow-lg"
                >
                <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span>작가정보</span>
                </div>
                </button>
            </div>
            </>
        )}

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
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    <span>@livingbrush_hou</span>
                    </a>
                </div>
                <button onClick={() => setShowArtistInfo(false)} className="mt-4 w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors">닫기</button>
                </div>
            </div>
            </div>
        )}
        
        {showShareModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                <div className="text-center">
                <div className="text-4xl mb-4">🔗</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">작품 공유하기</h3>
                <p className="text-gray-600 mb-4">이 링크를 복사하여 친구들과 공유해보세요</p>
                <div className="bg-gray-100 p-3 rounded-lg mb-4 break-all text-sm text-gray-700">
                    {typeof window !== 'undefined' ? window.location.href : ''}
                </div>
                <div className="space-y-3">
                    <button onClick={handleCopyLink} className={`w-full py-2 px-4 rounded-lg transition-all ${ copySuccess ? 'bg-green-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white' }`}>
                    {copySuccess ? '복사 완료!' : '링크 복사'}
                    </button>
                    <button onClick={() => setShowShareModal(false)} className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors">
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