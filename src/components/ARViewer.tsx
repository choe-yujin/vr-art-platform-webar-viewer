'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MindARThreeInstance, MindARThreeConfig } from '@/types/global';

// Window 인터페이스 확장
declare global {
  interface Window {
    MindAR_THREE?: typeof THREE;
    MindAR_MindARThree?: new (config: MindARThreeConfig) => MindARThreeInstance;
    MindAR_GLTFLoader?: typeof GLTFLoader;
  }
}

interface ARViewerProps {
  modelPath: string;
  deviceType: 'mobile' | 'desktop';
  onLoadComplete?: () => void;
  onLoadError?: (error: string) => void;
  onBackPressed?: () => void;
  onSwitchTo3D?: () => void;
}

export default function ARViewer({
  modelPath,
  deviceType,
  onLoadComplete,
  onLoadError,
  onBackPressed,
  onSwitchTo3D,
}: ARViewerProps) {
  // ✨ 상태 관리 - 완전 초기화 가능하도록 개선
  const [status, setStatus] = useState<'loading' | 'ar-active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('AR 뷰어 초기화 중...');
  const [threeIcosaStatus, setThreeIcosaStatus] = useState<'loading' | 'success' | 'fallback'>('loading');
  const [showTimeoutPopup, setShowTimeoutPopup] = useState(false);
  const [isScanning, setIsScanning] = useState<boolean>(true);

  // ✨ ref 관리 - 메모리 누수 방지
  const containerRef = useRef<HTMLDivElement>(null);
  const mindarInstanceRef = useRef<MindARThreeInstance | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rescanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markerFoundRef = useRef(false);
  const markerLostTimeRef = useRef<number | null>(null);
  const initializationRef = useRef(false);
  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));
  const animationFrameRef = useRef<number | null>(null);
  const isCleaningUpRef = useRef(false);
  
  // ✨ 이슈 1 해결: 스크립트 캐시 방지로 99% 로딩 문제 해결
  const SCRIPT_ID_IMPORT_MAP = `mindar-import-map-${renderIdRef.current}`;
  const SCRIPT_ID_MODULE = `mindar-module-script-${renderIdRef.current}`;

  // ✨ 이슈 1 해결: 완전한 상태 초기화
  const resetAllStates = useCallback(() => {
    console.log('🔄 ARViewer 상태 완전 초기화');
    
    setStatus('loading');
    setErrorMessage('');
    setDebugInfo('AR 뷰어 초기화 중...');
    setThreeIcosaStatus('loading');
    setShowTimeoutPopup(false);
    setIsScanning(true);
    
    markerFoundRef.current = false;
    markerLostTimeRef.current = null;
    initializationRef.current = false;
    isCleaningUpRef.current = false;
    
    // 새로운 render ID로 스크립트 충돌 방지
    renderIdRef.current = Math.random().toString(36).substr(2, 9);
  }, []);

  // ✨ 이슈 1 해결: 스크립트 로딩 개선 (캐시 방지)
  const ensureMindARScriptsLoaded = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            // 기존 스크립트 완전 제거
            document.querySelectorAll('[id*="mindar"]').forEach(el => el.remove());
            
            // 전역 객체 완전 정리
            if (window.MindAR_THREE) window.MindAR_THREE = undefined;
            if (window.MindAR_MindARThree) window.MindAR_MindARThree = undefined;
            if (window.MindAR_GLTFLoader) window.MindAR_GLTFLoader = undefined;

            const importMap = document.createElement('script');
            importMap.id = SCRIPT_ID_IMPORT_MAP;
            importMap.type = 'importmap';
            importMap.textContent = JSON.stringify({
              "imports": { 
                "three": `https://unpkg.com/three@0.160.0/build/three.module.js?v=${Date.now()}`, 
                "three/addons/": `https://unpkg.com/three@0.160.0/examples/jsm/`, 
                "mindar-image-three": `https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js?v=${Date.now()}` 
              }
            });
            document.head.appendChild(importMap);
            
            const moduleScript = document.createElement('script');
            moduleScript.id = SCRIPT_ID_MODULE;
            moduleScript.type = 'module';
            moduleScript.textContent = `
              try {
                const THREE_module = await import('three');
                const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
                const { MindARThree } = await import('mindar-image-three');
                window.MindAR_THREE = THREE_module;
                window.MindAR_MindARThree = MindARThree;
                window.MindAR_GLTFLoader = GLTFLoader;
                window.dispatchEvent(new CustomEvent('mindARReady', { detail: { success: true, id: '${renderIdRef.current}' } }));
              } catch (error) {
                window.dispatchEvent(new CustomEvent('mindARReady', { detail: { success: false, error: error.message, id: '${renderIdRef.current}' } }));
              }
            `;
            
            const handleReady = (e: Event) => {
              const customEvent = e as CustomEvent;
              if (customEvent.detail.id !== renderIdRef.current) return; // 다른 인스턴스 무시
              
              window.removeEventListener('mindARReady', handleReady);
              clearTimeout(timeout);
              if (customEvent.detail.success) resolve();
              else reject(new Error(customEvent.detail.error));
            };
            
            window.addEventListener('mindARReady', handleReady);
            const timeout = setTimeout(() => {
              window.removeEventListener('mindARReady', handleReady);
              reject(new Error('MindAR 스크립트 로딩 타임아웃'));
            }, 15000);
            
            document.head.appendChild(moduleScript);
          } catch (scriptError) {
            reject(scriptError);
          }
    });
  }, [SCRIPT_ID_IMPORT_MAP, SCRIPT_ID_MODULE]);

  const loadModelForMindAR = useCallback(async (anchorGroup: THREE.Group): Promise<void> => {
    const GLTFLoader = window.MindAR_GLTFLoader;
    if (!GLTFLoader) {
      throw new Error('GLTFLoader를 window에서 찾을 수 없습니다.');
    }

    const loader = new GLTFLoader();
    let threeIcosaLoaded = false;

    try {
      const { GLTFGoogleTiltBrushMaterialExtension } = await import('three-icosa');
      const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
      loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
      threeIcosaLoaded = true;
      setThreeIcosaStatus('success');
    } catch (icosaError) {
      console.warn('Three-Icosa 로드 실패:', icosaError);
      setThreeIcosaStatus('fallback');
      threeIcosaLoaded = false;
    }

    return new Promise<void>((resolve, reject) => {
      setDebugInfo(`모델 로딩 중... ${threeIcosaLoaded ? '(Tilt Brush 지원)' : '(기본 모드)'}`);
      
      loader.load(
        modelPath,
        (gltf: GLTF) => {
          if (isCleaningUpRef.current) return; // cleanup 중이면 무시
          
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          model.position.sub(center);
          
          const maxDimension = Math.max(size.x, size.y, size.z);
          const targetSize = 0.8;
          const scale = targetSize / maxDimension;
          model.scale.setScalar(scale);
          
          model.position.set(0, 0, 0);
          const scaledHeight = size.y * scale;
          model.position.y = scaledHeight * 0.05;
          
          anchorGroup.add(model);
          setDebugInfo(`AR 모델 준비 완료! ${threeIcosaLoaded ? '(Tilt Brush)' : '(기본)'}`);
          resolve();
        },
        (progress: ProgressEvent<EventTarget>) => {
          if (isCleaningUpRef.current) return;
          if (progress.total > 0) {
            const percent = Math.min(Math.round((progress.loaded / progress.total) * 100), 99);
            setDebugInfo(`모델 로딩... ${percent}%`);
          }
        },
        (loadError: unknown) => {
          if (isCleaningUpRef.current) return;
          const errorMsg = loadError instanceof Error ? loadError.message : '모델 로딩 실패';
          setDebugInfo(`모델 로딩 실패: ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      );
    });
  }, [modelPath]);

  // ✨ 이슈 1 해결: 완벽한 리소스 정리
  const performCompleteCleanup = useCallback(() => {
    const currentRenderId = renderIdRef.current;
    console.log(`🧹 ARViewer 완전한 정리 시작 [${currentRenderId}]`);
    
    isCleaningUpRef.current = true;
    
    // 모든 타이머 정리
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rescanTimeoutRef.current) {
      clearTimeout(rescanTimeoutRef.current);
      rescanTimeoutRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // MindAR 인스턴스 완전 정리
    const mindarInstance = mindarInstanceRef.current;
    if (mindarInstance) {
      try {
        mindarInstance.stop();
        if (mindarInstance.renderer) {
          mindarInstance.renderer.dispose();
          mindarInstance.renderer.forceContextLoss();
          mindarInstance.renderer.domElement.remove();
        }
        
        const scene = mindarInstance.scene;
        if (scene) {
          scene.traverse((object: THREE.Object3D) => {
            if (object instanceof THREE.Mesh) {
              object.geometry?.dispose();
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material: THREE.Material) => material?.dispose());
            }
          });
          scene.clear();
        }
      } catch (cleanupError) {
        console.warn('MindAR 정리 중 오류:', cleanupError);
      }
      mindarInstanceRef.current = null;
    }
    
    // 스크립트 정리 (현재 인스턴스만)
    document.getElementById(SCRIPT_ID_IMPORT_MAP)?.remove();
    document.getElementById(SCRIPT_ID_MODULE)?.remove();
    
    // 컨테이너 정리
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    console.log(`✅ ARViewer 완전한 정리 완료 [${currentRenderId}]`);
  }, [SCRIPT_ID_IMPORT_MAP, SCRIPT_ID_MODULE]);

  const initializeMindARSession = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    
    markerFoundRef.current = false;
    await ensureMindARScriptsLoaded();
    
    if (isCleaningUpRef.current) return;
    
    const MindARThree = window.MindAR_MindARThree;
    if (!containerRef.current || !MindARThree) throw new Error("MindAR 초기화 준비 안됨");
    
    const mindarThree = new MindARThree({
      container: containerRef.current,
      imageTargetSrc: '/markers/qr-marker.mind',
    });
    
    if (isCleaningUpRef.current) {
      mindarThree.stop();
      return;
    }
    
    mindarInstanceRef.current = mindarThree;
    const { renderer, scene, camera } = mindarThree;
    const anchor = mindarThree.addAnchor(0);
    
    anchor.onTargetFound = () => {
      if (isCleaningUpRef.current) return;
      markerFoundRef.current = true;
      setIsScanning(false);
      markerLostTimeRef.current = null;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (rescanTimeoutRef.current) {
        clearTimeout(rescanTimeoutRef.current);
        rescanTimeoutRef.current = null;
      }
      
      setDebugInfo('🎯 마커 인식 성공!');
    };
    
    anchor.onTargetLost = () => {
      if (isCleaningUpRef.current) return;
      setIsScanning(true);
      markerLostTimeRef.current = Date.now();
      setDebugInfo('마커를 다시 스캔해주세요...');
      
      rescanTimeoutRef.current = setTimeout(() => {
        if (isCleaningUpRef.current) return;
        if (markerLostTimeRef.current && Date.now() - markerLostTimeRef.current > 3000) {
          setShowTimeoutPopup(true);
        }
      }, 3000);
    };
    
    await loadModelForMindAR(anchor.group);
    
    if (isCleaningUpRef.current) return;
    
    await mindarThree.start();
    
    timeoutRef.current = setTimeout(() => {
      if (isCleaningUpRef.current) return;
      if (!markerFoundRef.current) {
        setShowTimeoutPopup(true);
      }
    }, 5000);
    
    const animate = () => {
      if (isCleaningUpRef.current) return;
      animationFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();
  }, [ensureMindARScriptsLoaded, loadModelForMindAR]);

  const handleBackClick = useCallback(() => {
    console.log('🔙 뒤로가기 버튼 클릭');
    
    performCompleteCleanup();
    resetAllStates();
    
    if (onBackPressed) {
      onBackPressed();
    }
  }, [onBackPressed, performCompleteCleanup, resetAllStates]);

  const handleRetryScan = useCallback(() => {
    console.log('🔄 재시도 버튼 클릭');
    setShowTimeoutPopup(false);
    setIsScanning(true);
    markerFoundRef.current = false;
    markerLostTimeRef.current = null;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rescanTimeoutRef.current) {
      clearTimeout(rescanTimeoutRef.current);
      rescanTimeoutRef.current = null;
    }
    
    timeoutRef.current = setTimeout(() => {
      if (!markerFoundRef.current) {
        setShowTimeoutPopup(true);
      }
    }, 5000);
    
    setDebugInfo('마커를 스캔해주세요...');
  }, []);

  const initializeMobileAR = useCallback(() => {
    try {
      console.log('📱 모바일 AR 초기화 시작');
      setDebugInfo('MindAR 스크립트 로딩 중...');
      
      initializeMindARSession()
        .then(() => {
          if (isCleaningUpRef.current) return;
          setStatus('ar-active');
          setDebugInfo('MindAR AR 모드 활성화 완료!');
          if (onLoadComplete) {
            onLoadComplete();
          }
        })
        .catch((sessionError: unknown) => {
          if (isCleaningUpRef.current) return;
          const errorMsg = sessionError instanceof Error ? sessionError.message : '알 수 없는 오류';
          setErrorMessage(errorMsg);
          setStatus('error');
          setDebugInfo(`모바일 AR 실패: ${errorMsg}`);
          if (onLoadError) {
            onLoadError(errorMsg);
          }
        });
        
    } catch (initError) {
      const errorMsg = initError instanceof Error ? initError.message : String(initError);
      setErrorMessage(errorMsg);
      setStatus('error');
      if (onLoadError) {
        onLoadError(errorMsg);
      }
    }
    
    return () => {
      // cleanup 로직
    };
  }, [initializeMindARSession, onLoadComplete, onLoadError]);

  useEffect(() => {
    if (deviceType !== 'mobile' || !containerRef.current || initializationRef.current) {
      return;
    }

    initializationRef.current = true;
    const currentRenderId = renderIdRef.current;
    
    console.log(`✅ ARViewer 초기화 시작 [${currentRenderId}]`);
    
    const cleanupInit = initializeMobileAR();

    return () => {
      console.log(`🧹 ARViewer useEffect cleanup [${currentRenderId}]`);
      
      if (cleanupInit) cleanupInit();
      performCompleteCleanup();
      
      initializationRef.current = false;
    };
  }, [deviceType, initializeMobileAR, performCompleteCleanup]);

  return (
    // ✨ 이슈 3 해결: 전체 화면 고정으로 카메라 잘림 방지
    <div className="fixed top-0 left-0 w-screen h-screen overflow-hidden" style={{ zIndex: 0 }}>
      
      {/* ✨ 이슈 3 해결: 카메라 컨테이너 완전한 전체화면 */}
      <div
        ref={containerRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ 
          backgroundColor: status === 'ar-active' ? 'transparent' : '#000000',
          width: '100vw',
          height: '100vh',
          zIndex: 1
        }}
      />
      
      {/* ✨ 이슈 2 해결: 뒤로가기 버튼 최상위 z-index */}
      <button
        onClick={handleBackClick}
        className="fixed top-6 left-6 bg-black/80 hover:bg-black/90 text-white p-4 rounded-full transition-colors shadow-lg"
        style={{ zIndex: 100000 }}
        aria-label="뒤로가기"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      {/* 로딩 상태 */}
      {status === 'loading' && (
        <div className="fixed inset-0 flex items-center justify-center text-white bg-black/80" style={{ zIndex: 50000 }}>
          <div className="text-center px-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">AR 뷰어 로딩 중...</p>
            <p className="text-sm opacity-50 mt-2">{debugInfo}</p>
          </div>
        </div>
      )}
      
      {/* 에러 상태 */}
      {status === 'error' && (
        <div className="fixed inset-0 flex items-center justify-center text-white bg-red-900/80" style={{ zIndex: 50000 }}>
          <div className="text-center p-6 max-w-sm mx-4">
            <p className="text-lg font-bold mb-2">⚠️ AR 오류 발생</p>
            <p className="text-sm opacity-75 mb-4">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-white/20 px-4 py-2 rounded hover:bg-white/30 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* ✨ 이슈 2 해결: 스캔 팝업 최상위 z-index로 스캐너보다 위에 */}
      {showTimeoutPopup && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 200000 }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center mx-4">
            <div className="text-4xl mb-4">
              {markerFoundRef.current ? '🔍' : '⏱️'}
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {markerFoundRef.current ? '마커를 다시 스캔해주세요' : '마커를 찾지 못했습니다'}
            </h3>
            <p className="text-gray-600 mb-6">어떻게 하시겠어요?</p>
            <div className="space-y-3">
              <button
                onClick={handleRetryScan}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-colors font-medium"
              >
                더 스캔하기
              </button>
              <button
                onClick={onSwitchTo3D}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg transition-colors font-medium"
              >
                3D 뷰어로 보기
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* AR 활성화 상태 정보 */}
      {status === 'ar-active' && !showTimeoutPopup && (
        <div className="fixed bottom-6 left-4 right-4 bg-black/70 text-white p-3 rounded text-sm pointer-events-none" style={{ zIndex: 40000 }}>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              {isScanning && (
                <div className="animate-pulse">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                </div>
              )}
              <p>{debugInfo}</p>
            </div>
            <p className="text-xs opacity-80">
              {threeIcosaStatus === 'success' ? '🎨 Tilt Brush 브러시 로드됨' : '⚠️ 기본 재질 모드'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}