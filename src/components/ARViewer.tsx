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
  const [status, setStatus] = useState<'loading' | 'ar-active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('AR 초기화 중...');
  const [threeIcosaStatus, setThreeIcosaStatus] = useState<'loading' | 'success' | 'fallback'>('loading');
  const [showTimeoutPopup, setShowTimeoutPopup] = useState(false);
  const [isScanning, setIsScanning] = useState(true); // 🔧 스캔 상태 추가

  const containerRef = useRef<HTMLDivElement>(null);
  const mindarInstanceRef = useRef<MindARThreeInstance | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rescanTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 🔧 재스캔 타이머 추가
  const markerFoundRef = useRef(false);
  const markerLostTimeRef = useRef<number | null>(null); // 🔧 마커 손실 시간 추적
  const initializationRef = useRef(false);
  const cleanupRef = useRef(false);
  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));

  const SCRIPT_ID_IMPORT_MAP = 'mindar-import-map';
  const SCRIPT_ID_MODULE = 'mindar-module-script';

  // 🔧 이슈 1: MindAR 스크립트 로딩 개선 (ESLint 경고 없음, any 타입 금지)
  const ensureMindARScriptsLoaded = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // 이미 로드된 경우 즉시 반환
        if (window.MindAR_THREE && window.MindAR_MindARThree) {
          console.log('📦 MindAR 스크립트 이미 로드됨');
          setDebugInfo('MindAR 모듈 이미 준비됨!');
          resolve();
          return;
        }

        // 기존 스크립트 정리
        document.getElementById(SCRIPT_ID_IMPORT_MAP)?.remove();
        document.getElementById(SCRIPT_ID_MODULE)?.remove();

        // Import Map 생성
        const importMap = document.createElement('script');
        importMap.id = SCRIPT_ID_IMPORT_MAP;
        importMap.type = 'importmap';
        importMap.textContent = JSON.stringify({
          "imports": {
            "three": "https://unpkg.com/three@0.164.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.164.0/examples/jsm/",
            "mindar-image-three": "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js"
          }
        });
        document.head.appendChild(importMap);

        // Module Script 생성
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
            window.dispatchEvent(new CustomEvent('mindARReady', { detail: { success: true } }));
          } catch (error) {
            window.dispatchEvent(new CustomEvent('mindARReady', { 
              detail: { success: false, error: error.message } 
            }));
          }
        `;

        // 이벤트 리스너 설정 (타입 안전)
        const handleReady = (event: Event) => {
          const customEvent = event as CustomEvent<{ success: boolean; error?: string }>;
          window.removeEventListener('mindARReady', handleReady);
          clearTimeout(timeout);
          
          if (customEvent.detail.success) {
            setDebugInfo('MindAR 모듈 로드 성공!');
            resolve();
          } else {
            const errorMsg = customEvent.detail.error || '알 수 없는 오류';
            setDebugInfo(`MindAR 로딩 실패: ${errorMsg}`);
            reject(new Error(errorMsg));
          }
        };

        window.addEventListener('mindARReady', handleReady);

        // 타임아웃 설정
        const timeout = setTimeout(() => {
          console.error('❌ MindAR 스크립트 로딩 타임아웃');
          window.removeEventListener('mindARReady', handleReady);
          setDebugInfo('MindAR 로딩 타임아웃');
          reject(new Error('MindAR 스크립트 로딩 타임아웃'));
        }, 30000);

        document.head.appendChild(moduleScript);
      } catch (error) {
        console.error('❌ MindAR 스크립트 삽입 실패:', error);
        const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
        setDebugInfo(`스크립트 삽입 실패: ${errorMsg}`);
        reject(new Error(errorMsg));
      }
    });
  }, [SCRIPT_ID_IMPORT_MAP, SCRIPT_ID_MODULE]);

  // 기존 방식으로 간단하게 수정
  const loadModelForMindAR = useCallback(async (anchorGroup: THREE.Group): Promise<void> => {
    const GLTFLoader = window.MindAR_GLTFLoader;
    if (!GLTFLoader) {
      throw new Error('GLTFLoader를 window에서 찾을 수 없습니다.');
    }

    const loader = new GLTFLoader();
    let threeIcosaLoaded = false;

    // Three-Icosa 로딩 시도 (기존 방식)
    try {
      const { GLTFGoogleTiltBrushMaterialExtension } = await import('three-icosa');
      const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
      loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
      threeIcosaLoaded = true;
      setThreeIcosaStatus('success');
      console.log('✅ Three-Icosa 확장자 등록 완료');
    } catch (error) {
      console.warn('⚠️ Three-Icosa 로드 실패:', error);
      setThreeIcosaStatus('fallback');
    }

    // 🎯 모델 로딩 (Tilt Brush 지원 여부와 관계없이 동작)
    return new Promise<void>((resolve, reject) => {
      setDebugInfo(`모델 로딩 중... ${threeIcosaLoaded ? '(Tilt Brush 지원)' : '(기본 모드)'}`);
      
      loader.load(
        modelPath,
        (gltf: GLTF) => {
          console.log('🎉 모델 로딩 성공!');
          
          const model = gltf.scene;
          
          // 모델 최적화 및 배치
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          // 모델을 중심으로 이동
          model.position.sub(center);
          
          // 적절한 크기로 스케일링
          const maxDimension = Math.max(size.x, size.y, size.z);
          const targetSize = 0.3; // AR 공간에서 적절한 크기
          const scale = targetSize / maxDimension;
          model.scale.setScalar(scale);
          
          // 마커 위에 배치
          model.position.set(0, 0, 0);
          const scaledHeight = size.y * scale;
          model.position.y = scaledHeight * 0.1; // 모델 높이의 10%만큼 위로
          
          anchorGroup.add(model);
          
          console.log('✅ 모델이 AR 앵커에 추가됨');
          setDebugInfo(`AR 모델 준비 완료! ${threeIcosaLoaded ? '(Tilt Brush)' : '(기본)'}`);
          
          resolve();
        },
        (progress: ProgressEvent<EventTarget>) => {
          if (progress.total > 0) {
            const percent = Math.min(Math.round((progress.loaded / progress.total) * 100), 99);
            setDebugInfo(`모델 로딩... ${percent}%`);
          }
        },
        (loadError: unknown) => {
          console.error('❌ MindAR 모델 로딩 실패:', loadError);
          const errorMsg = loadError instanceof Error ? loadError.message : loadError instanceof ErrorEvent ? loadError.message : '모델 로딩 실패';
          setDebugInfo(`모델 로딩 실패: ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      );
    });
  }, [modelPath]);

  // 🔧 이슈 2: 마커 추적 및 팝업 관리 개선
  const initializeMindARSession = useCallback(async (): Promise<void> => {
    try {
      console.log('🚀 MindAR 세션 초기화 시작');
      setDebugInfo('MindAR 인스턴스 생성 중...');
      
      markerFoundRef.current = false;
      markerLostTimeRef.current = null;
      
      await ensureMindARScriptsLoaded();
      
      const MindARThree = window.MindAR_MindARThree;
      if (!containerRef.current || !MindARThree) {
        throw new Error('MindAR 초기화 준비 안됨');
      }

      const mindarThree = new MindARThree({
        container: containerRef.current,
        imageTargetSrc: '/markers/qr-marker.mind',
      });

      mindarInstanceRef.current = mindarThree;
      const { renderer, scene, camera } = mindarThree;
      
      // 🔧 카메라 뷰 전체 화면 사용 (이슈 5 해결)
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.objectFit = 'cover';
      
      const anchor = mindarThree.addAnchor(0);
      
      // 🔧 마커 추적 이벤트 개선
      anchor.onTargetFound = () => {
        console.log('🎯 마커 발견!');
        markerFoundRef.current = true;
        markerLostTimeRef.current = null;
        setIsScanning(false); // 스캔 중지
        
        // 타임아웃 정리
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (rescanTimeoutRef.current) {
          clearTimeout(rescanTimeoutRef.current);
          rescanTimeoutRef.current = null;
        }
        
        setDebugInfo('🎯 마커 인식 성공! 3D 모델 표시 중...');
        setShowTimeoutPopup(false);
      };
      
      anchor.onTargetLost = () => {
        console.log('❌ 마커 손실');
        markerFoundRef.current = false;
        markerLostTimeRef.current = Date.now();
        setIsScanning(true); // 스캔 재시작
        setDebugInfo('마커를 다시 스캔해주세요...');
        
        // 5초 후 재스캔 팝업 표시
        rescanTimeoutRef.current = setTimeout(() => {
          if (!markerFoundRef.current && markerLostTimeRef.current) {
            setShowTimeoutPopup(true);
            setIsScanning(false); // 팝업 표시 시 스캔 중지
          }
        }, 5000);
      };

      await loadModelForMindAR(anchor.group);

      console.log('🎯 MindAR 세션 시작 중...');
      setDebugInfo('AR 세션 시작 중...');
      
      await mindarThree.start();
      
      // 🔧 10초 후 마커 못 찾음 팝업 (초기 스캔)
      timeoutRef.current = setTimeout(() => {
        if (!markerFoundRef.current) {
          setShowTimeoutPopup(true);
          setIsScanning(false); // 팝업 표시 시 스캔 중지
        }
      }, 10000);

      // 렌더링 루프
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });

      console.log('🎉 MindAR 세션 초기화 완료');
    } catch (error) {
      console.error('❌ MindAR 세션 초기화 실패:', error);
      throw error;
    }
  }, [ensureMindARScriptsLoaded, loadModelForMindAR]);

  // 🔧 이슈 3: 뒤로가기 버튼 개선
  const handleBackClick = useCallback(() => {
    console.log('🔙 뒤로가기 버튼 클릭');
    
    // 모든 타이머 정리
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rescanTimeoutRef.current) {
      clearTimeout(rescanTimeoutRef.current);
      rescanTimeoutRef.current = null;
    }
    
    // MindAR 세션 정리
    if (mindarInstanceRef.current) {
      mindarInstanceRef.current.stop();
      mindarInstanceRef.current = null;
    }
    
    // 상태 초기화
    setStatus('loading');
    setShowTimeoutPopup(false);
    setIsScanning(true);
    markerFoundRef.current = false;
    markerLostTimeRef.current = null;
    
    // 부모 컴포넌트 콜백 호출
    if (onBackPressed) {
      onBackPressed();
    }
  }, [onBackPressed]);

  // 🔧 이슈 4: 재시도 로직 개선
  const handleRetryScan = useCallback(() => {
    console.log('🔄 재시도 버튼 클릭');
    setShowTimeoutPopup(false);
    setIsScanning(true);
    markerFoundRef.current = false;
    markerLostTimeRef.current = null;
    
    // 타이머 정리
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rescanTimeoutRef.current) {
      clearTimeout(rescanTimeoutRef.current);
      rescanTimeoutRef.current = null;
    }
    
    // MindAR 세션 재시작
    initializeMindARSession().catch((error: Error) => {
      const errorMsg = error.message;
      setErrorMessage(errorMsg);
      setStatus('error');
      if (onLoadError) {
        onLoadError(errorMsg);
      }
    });
  }, [initializeMindARSession, onLoadError]);

  // 🔧 이슈 5: 컴포넌트 생명주기 개선
  const initializeMobileAR = useCallback(async (): Promise<void> => {
    try {
      console.log('📱 모바일 AR 초기화 시작');
      setDebugInfo('MindAR 스크립트 로딩 중...');
      
      await initializeMindARSession();
      
      setStatus('ar-active');
      setDebugInfo('MindAR AR 모드 활성화 완료!');
      
      if (onLoadComplete) {
        onLoadComplete();
      }
      
      console.log('🎉 모바일 AR 초기화 완료');
    } catch (error) {
      console.error('❌ 모바일 AR 초기화 실패:', error);
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      setErrorMessage(errorMsg);
      setStatus('error');
      setDebugInfo(`모바일 AR 실패: ${errorMsg}`);
      
      if (onLoadError) {
        onLoadError(errorMsg);
      }
    }
  }, [initializeMindARSession, onLoadComplete, onLoadError]);

  useEffect(() => {
    if (deviceType !== 'mobile' || !containerRef.current || initializationRef.current) {
      return;
    }

    initializationRef.current = true;
    const currentContainer = containerRef.current;
    const currentRenderId = renderIdRef.current;
    
    console.log(`✅ ARViewer 초기화 시작 [${currentRenderId}]`);
    
    initializeMobileAR();

    return () => {
      console.log(`🧹 ARViewer 완벽 정리 시작 [${currentRenderId}]`);
      
      // 모든 타이머 정리
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (rescanTimeoutRef.current) {
        clearTimeout(rescanTimeoutRef.current);
        rescanTimeoutRef.current = null;
      }
      
      // MindAR 인스턴스 정리
      const mindarInstance = mindarInstanceRef.current;
      if (mindarInstance) {
        mindarInstance.stop();
        if (mindarInstance.renderer) {
          mindarInstance.renderer.dispose();
          mindarInstance.renderer.forceContextLoss();
        }
        mindarInstance.scene.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh) {
            object.geometry?.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material: THREE.Material) => material?.dispose());
          }
        });
      }
      mindarInstanceRef.current = null;
      
      // 스크립트 정리
      document.getElementById(SCRIPT_ID_IMPORT_MAP)?.remove();
      document.getElementById(SCRIPT_ID_MODULE)?.remove();
      
      // 전역 객체 정리
      if (window.MindAR_THREE) window.MindAR_THREE = undefined;
      if (window.MindAR_MindARThree) window.MindAR_MindARThree = undefined;
      if (window.MindAR_GLTFLoader) window.MindAR_GLTFLoader = undefined;

      // 컨테이너 정리
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }
      
      initializationRef.current = false;
      cleanupRef.current = true;
    };
  }, [deviceType, initializeMobileAR, SCRIPT_ID_IMPORT_MAP, SCRIPT_ID_MODULE]);

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* 🔧 이슈 3: 뒤로가기 버튼 개선 */}
      <button
        onClick={handleBackClick}
        className="absolute top-4 left-4 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full z-20 transition-colors"
        aria-label="뒤로가기"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* 🔧 이슈 5: 카메라 컨테이너 전체 화면 사용 */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ 
          backgroundColor: status === 'ar-active' ? 'transparent' : '#000000',
          width: '100vw',
          height: '100vh'
        }}
      />
      
      {/* 로딩 상태 */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">AR 뷰어 로딩 중...</p>
            <p className="text-sm opacity-50 mt-2">{debugInfo}</p>
          </div>
        </div>
      )}
      
      {/* 에러 상태 */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-red-900/80 z-10">
          <div className="text-center p-6">
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

      {/* 🔧 이슈 2: 팝업 z-index 최상위 설정 및 스캔 중지 */}
      {showTimeoutPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
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
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded text-sm z-10 pointer-events-none">
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