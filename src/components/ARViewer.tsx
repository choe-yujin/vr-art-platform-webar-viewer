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
  // 상태 관리
  const [status, setStatus] = useState<'loading' | 'ar-active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('AR 뷰어 초기화 중...');
  const [threeIcosaStatus, setThreeIcosaStatus] = useState<'loading' | 'success' | 'fallback'>('loading');
  const [showTimeoutPopup, setShowTimeoutPopup] = useState(false);
  const [isScanning, setIsScanning] = useState<boolean>(true);

  // ref 관리
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
  const isInitializedRef = useRef(false);
  
  // 🔧 99% 로딩 문제 해결: 완전한 전역 정리
  const clearAllGlobalState = useCallback(() => {
    console.log('🔄 전역 상태 완전 정리');
    
    // 모든 MindAR 관련 스크립트 제거
    const scripts = document.querySelectorAll('script[id*="mindar"], script[type="importmap"]');
    scripts.forEach(script => {
      try {
        script.remove();
      } catch (e) {
        console.warn('스크립트 제거 실패:', e);
      }
    });
    
    // 전역 객체 완전 정리
    if (window.MindAR_THREE) {
      delete window.MindAR_THREE;
    }
    if (window.MindAR_MindARThree) {
      delete window.MindAR_MindARThree;
    }
    if (window.MindAR_GLTFLoader) {
      delete window.MindAR_GLTFLoader;
    }
    
    // 이벤트 리스너 정리
    const events = ['mindARReady', 'mindARError'];
    events.forEach(eventName => {
      window.removeEventListener(eventName, () => {});
    });
  }, []);

  // 🔧 99% 로딩 문제 해결: 완전히 새로운 스크립트 로딩
  const loadMindARScripts = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // 기존 상태 완전 정리
        clearAllGlobalState();
        
        // 고유 ID로 충돌 방지
        const timestamp = Date.now();
        const uniqueId = `${renderIdRef.current}-${timestamp}`;
        
        const importMap = document.createElement('script');
        importMap.type = 'importmap';
        importMap.id = `importmap-${uniqueId}`;
        importMap.textContent = JSON.stringify({
          imports: {
            three: `https://unpkg.com/three@0.160.0/build/three.module.js?v=${timestamp}`,
            'three/addons/': 'https://unpkg.com/three@0.160.0/examples/jsm/',
            'mindar-image-three': `https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js?v=${timestamp}`
          }
        });
        
        const moduleScript = document.createElement('script');
        moduleScript.type = 'module';
        moduleScript.id = `module-${uniqueId}`;
        moduleScript.textContent = `
          try {
            console.log('MindAR 스크립트 로딩 시작');
            const THREE = await import('three');
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
            const { MindARThree } = await import('mindar-image-three');
            
            window.MindAR_THREE = THREE;
            window.MindAR_MindARThree = MindARThree;
            window.MindAR_GLTFLoader = GLTFLoader;
            
            console.log('MindAR 스크립트 로딩 완료');
            window.dispatchEvent(new CustomEvent('mindARReady-${uniqueId}', { detail: { success: true } }));
          } catch (error) {
            console.error('MindAR 스크립트 로딩 실패:', error);
            window.dispatchEvent(new CustomEvent('mindARReady-${uniqueId}', { detail: { success: false, error: error.message } }));
          }
        `;
        
        const handleReady = (event: Event) => {
          const customEvent = event as CustomEvent;
          window.removeEventListener(`mindARReady-${uniqueId}`, handleReady);
          clearTimeout(timeoutId);
          
          if (customEvent.detail.success) {
            resolve();
          } else {
            reject(new Error(customEvent.detail.error || 'MindAR 로딩 실패'));
          }
        };
        
        window.addEventListener(`mindARReady-${uniqueId}`, handleReady);
        
        const timeoutId = setTimeout(() => {
          window.removeEventListener(`mindARReady-${uniqueId}`, handleReady);
          reject(new Error('MindAR 스크립트 로딩 타임아웃'));
        }, 20000);
        
        document.head.appendChild(importMap);
        setTimeout(() => {
          document.head.appendChild(moduleScript);
        }, 100);
        
      } catch (err) {
        reject(err);
      }
    });
  }, [clearAllGlobalState]);

  // 🎨 DesktopViewer와 동일한 three-icosa 브러시 로딩 (완전 동기화)
  const loadModelForMindAR = useCallback(async (anchorGroup: THREE.Group): Promise<void> => {
    const GLTFLoader = window.MindAR_GLTFLoader;
    if (!GLTFLoader) {
      throw new Error('GLTFLoader가 로드되지 않았습니다');
    }

    const loader = new GLTFLoader();
    let threeIcosaLoaded = false;

    // 🎨 DesktopViewer와 정확히 동일한 three-icosa 로딩 방식
    try {
      const { GLTFGoogleTiltBrushMaterialExtension } = await import('three-icosa');
      const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
      // 매번 새로운 로더에 확장자 등록 (DesktopViewer 방식)
      loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
      threeIcosaLoaded = true;
      setThreeIcosaStatus('success');
      console.log('✅ Three-Icosa 확장자 등록 완료 (DesktopViewer 호환)');
    } catch (icosaError) {
      console.warn('⚠️ Three-Icosa 로드 실패:', icosaError);
      setThreeIcosaStatus('fallback');
      threeIcosaLoaded = false;
    }

    return new Promise<void>((resolve, reject) => {
      setDebugInfo(`모델 로딩 중... ${threeIcosaLoaded ? '(Tilt Brush 지원)' : '(기본 모드)'}`);
      
      loader.load(
        modelPath,
        (gltf: GLTF) => {
          if (isCleaningUpRef.current) return;
          
          console.log('🎉 AR 모델 로딩 성공!', { 
            threeIcosaLoaded, 
            hasAnimations: gltf.animations?.length > 0,
            sceneChildren: gltf.scene.children.length,
            modelName: gltf.scene.name || 'Unnamed Model'
          });
          
          // 🎨 DesktopViewer와 동일한 모델 처리 방식
          const model = gltf.scene;
          
          // 브러시 확인 및 디버깅
          let brushCount = 0;
          model.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              brushCount++;
              console.log('🎨 발견된 메시:', {
                name: child.name,
                materialType: child.material.constructor.name,
                hasTexture: child.material.map ? true : false
              });
            }
          });
          
          console.log(`🎨 총 ${brushCount}개의 브러시 메시 발견됨`);
          
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          // 모델을 중심으로 이동
          model.position.sub(center);
          
          // 🔧 모델 크기 대폭 증가: 1.8배로 설정 (AR에서 더 잘 보이도록)
          const maxDimension = Math.max(size.x, size.y, size.z);
          const targetSize = 1.8; // AR 환경에 최적화된 크기
          const scale = targetSize / maxDimension;
          model.scale.setScalar(scale);
          
          // 마커 위에 적절히 배치
          model.position.set(0, 0, 0);
          const scaledHeight = size.y * scale;
          model.position.y = scaledHeight * 0.01; // 바닥에 더 가깝게
          
          // 🎨 중요: AR 앵커 그룹에 모델 추가 (DesktopViewer의 scene.add와 동일)
          anchorGroup.add(model);
          
          console.log('✅ AR 모델이 앵커에 추가됨', {
            modelScale: scale.toFixed(2),
            position: model.position,
            threeIcosaEnabled: threeIcosaLoaded,
            brushesProcessed: brushCount
          });
          
          setDebugInfo(`AR 모델 준비 완료! 크기: ${scale.toFixed(2)} ${threeIcosaLoaded ? '(Tilt Brush 브러시)' : '(기본 재질)'}`);
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
          reject(new Error(errorMsg));
        }
      );
    });
  }, [modelPath]);

  // 🔧 99% 로딩 문제 해결: 더 강력한 전역 상태 초기화
  const performCompleteReset = useCallback(() => {
    console.log('🧹 ARViewer 완전 리셋 시작');
    
    // 1. 모든 정리 작업 수행
    isCleaningUpRef.current = true;
    
    // 2. 모든 타이머 정리
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (rescanTimeoutRef.current !== null) {
      clearTimeout(rescanTimeoutRef.current);
      rescanTimeoutRef.current = null;
    }
    
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // 3. MindAR 인스턴스 완전 정리
    const mindarInstance = mindarInstanceRef.current;
    if (mindarInstance) {
      try {
        mindarInstance.stop();
        if (mindarInstance.renderer) {
          const canvas = mindarInstance.renderer.domElement;
          mindarInstance.renderer.dispose();
          mindarInstance.renderer.forceContextLoss();
          if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
        }
        
        if (mindarInstance.scene) {
          mindarInstance.scene.traverse((object: THREE.Object3D) => {
            if (object instanceof THREE.Mesh) {
              object.geometry?.dispose();
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material: THREE.Material) => material?.dispose());
            }
          });
          mindarInstance.scene.clear();
        }
      } catch (err) {
        console.warn('MindAR 정리 중 오류:', err);
      }
      mindarInstanceRef.current = null;
    }
    
    // 4. 컨테이너 정리
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    // 5. 전역 상태 정리
    clearAllGlobalState();
    
    // 6. 모든 상태 초기화
    setStatus('loading');
    setErrorMessage('');
    setDebugInfo('AR 뷰어 초기화 중...');
    setThreeIcosaStatus('loading');
    setShowTimeoutPopup(false);
    setIsScanning(true);
    
    // 7. ref 상태 초기화
    markerFoundRef.current = false;
    markerLostTimeRef.current = null;
    initializationRef.current = false;
    isInitializedRef.current = false;
    isCleaningUpRef.current = false;
    
    // 8. 새로운 렌더 ID 생성 (완전 새로운 세션)
    renderIdRef.current = Math.random().toString(36).substr(2, 9);
    
    console.log('✅ ARViewer 완전 리셋 완료');
  }, [clearAllGlobalState]);

  // MindAR 세션 초기화
  const initializeMindARSession = useCallback(async () => {
    if (isCleaningUpRef.current || isInitializedRef.current) return;
    
    console.log('🚀 MindAR 세션 초기화 시작');
    
    markerFoundRef.current = false;
    await loadMindARScripts();
    
    if (isCleaningUpRef.current) return;
    
    const MindARThree = window.MindAR_MindARThree;
    if (!containerRef.current || !MindARThree) {
      throw new Error('MindAR 초기화 준비 안됨');
    }
    
    const mindarThree = new MindARThree({
      container: containerRef.current,
      imageTargetSrc: '/markers/qr-marker.mind',
    });
    
    if (isCleaningUpRef.current) {
      mindarThree.stop();
      return;
    }
    
    mindarInstanceRef.current = mindarThree;
    isInitializedRef.current = true;
    
    const { renderer, scene, camera } = mindarThree;
    
    // 🔧 렌더러 크기 올바르게 설정 (카메라 중앙 정렬 도움)
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.objectFit = 'cover';
    
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
      
      // 🔧 팝업 표시시 스캐너 동작 중지
      rescanTimeoutRef.current = setTimeout(() => {
        if (isCleaningUpRef.current) return;
        if (markerLostTimeRef.current && Date.now() - markerLostTimeRef.current > 3000) {
          // 팝업 표시 시 스캔 동작 완전 중지
          setIsScanning(false);
          setShowTimeoutPopup(true);
          // MindAR 인스턴스의 렌더링 일시 중지
          if (mindarInstanceRef.current) {
            try {
              // 렌더링 루프 중지
              if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
              }
            } catch (err) {
              console.warn('렌더링 중지 실패:', err);
            }
          }
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
    
    console.log('✅ MindAR 세션 초기화 완료');
  }, [loadMindARScripts, loadModelForMindAR]);

  // 뒤로가기 핸들러
  const handleBackClick = useCallback(() => {
    console.log('🔙 뒤로가기 버튼 클릭');
    
    // 🔧 99% 로딩 문제 해결: 완전 리셋 사용
    performCompleteReset();
    
    if (onBackPressed) {
      onBackPressed();
    }
  }, [performCompleteReset, onBackPressed]);

  // 재시도 핸들러
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
    
    // 🔧 렌더링 루프 재시작
    if (mindarInstanceRef.current && !animationFrameRef.current) {
      const { renderer, scene, camera } = mindarInstanceRef.current;
      const animate = () => {
        if (isCleaningUpRef.current || showTimeoutPopup) return;
        animationFrameRef.current = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();
    }
    
    timeoutRef.current = setTimeout(() => {
      if (!markerFoundRef.current) {
        setShowTimeoutPopup(true);
        setIsScanning(false);
      }
    }, 5000);
    
    setDebugInfo('마커를 스캔해주세요...');
  }, [showTimeoutPopup]);

  // 초기화 함수
  const initializeMobileAR = useCallback(() => {
    if (isCleaningUpRef.current) return;
    
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
      .catch((error: unknown) => {
        if (isCleaningUpRef.current) return;
        const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
        setErrorMessage(errorMsg);
        setStatus('error');
        setDebugInfo(`모바일 AR 실패: ${errorMsg}`);
        if (onLoadError) {
          onLoadError(errorMsg);
        }
      });
      
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
      
      // 🔧 99% 로딩 문제 해결: 완전 리셋 사용
      if (cleanupInit) cleanupInit();
      performCompleteReset();
      
      // 🔧 추가: DOM에서 MindAR 관련 요소 완전 제거
      setTimeout(() => {
        const mindArElements = document.querySelectorAll(
          'canvas[style*="position: absolute"], ' +
          '[class*="mindar"], ' +
          '[id*="mindar"], ' +
          'div[style*="pointer-events: none"]'
        );
        mindArElements.forEach(el => {
          try {
            if (el && el.parentNode) {
              el.parentNode.removeChild(el);
            }
          } catch (e) {
            console.warn('MindAR DOM 요소 제거 실패:', e);
          }
        });
      }, 100);
    };
  }, [deviceType, initializeMobileAR, performCompleteReset]);

  return (
    <>
      {/* 🔧 카메라 화면 전체화면 문제 해결: 진짜 전체화면 스타일 */}
      <div 
        className="absolute inset-0"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1,
          overflow: 'hidden'
        }}
      >
        {/* 카메라 컨테이너 */}
        <div
          ref={containerRef}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: status === 'ar-active' ? 'transparent' : '#000000',
            // 🔧 카메라 영역 중앙 정렬 문제 해결
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
          }}
        />
      </div>

      {/* 🔧 뒤로가기 버튼 최상위 */}
      <button
        onClick={handleBackClick}
        style={{ 
          position: 'fixed',
          top: '24px',
          left: '24px',
          zIndex: 999999,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          padding: '16px',
          cursor: 'pointer'
        }}
        aria-label="뒤로가기"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      {/* 로딩 상태 */}
      {status === 'loading' && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 500000,
          color: 'white'
        }}>
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ 
              width: '48px',
              height: '48px',
              border: '2px solid transparent',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}></div>
            <p style={{ fontSize: '18px', fontWeight: 'bold' }}>AR 뷰어 로딩 중...</p>
            <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>{debugInfo}</p>
          </div>
        </div>
      )}
      
      {/* 에러 상태 */}
      {status === 'error' && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(139, 69, 19, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 500000,
          color: 'white'
        }}>
          <div style={{ textAlign: 'center', padding: '24px', maxWidth: '320px' }}>
            <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>⚠️ AR 오류 발생</p>
            <p style={{ fontSize: '14px', opacity: 0.75, marginBottom: '16px' }}>{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 🔧 팝업 z-index 문제 해결: 절대 최상위 */}
      {showTimeoutPopup && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '320px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {markerFoundRef.current ? '🔍' : '⏱️'}
            </div>
            <h3 style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              color: '#1a202c', 
              marginBottom: '8px' 
            }}>
              {markerFoundRef.current ? '마커를 다시 스캔해주세요' : '마커를 찾지 못했습니다'}
            </h3>
            <p style={{ color: '#718096', marginBottom: '24px' }}>어떻게 하시겠어요?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleRetryScan}
                style={{
                  width: '100%',
                  backgroundColor: '#3B82F6',
                  color: 'white',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                더 스캔하기
              </button>
              <button
                onClick={onSwitchTo3D}
                style={{
                  width: '100%',
                  backgroundColor: '#6B7280',
                  color: 'white',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                3D 뷰어로 보기
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* AR 활성화 상태 정보 */}
      {status === 'ar-active' && !showTimeoutPopup && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '16px',
          right: '16px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'center',
          zIndex: 400000,
          pointerEvents: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
            {isScanning && (
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#4ADE80',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}></div>
            )}
            <p>{debugInfo}</p>
          </div>
          <p style={{ fontSize: '12px', opacity: 0.8 }}>
            {threeIcosaStatus === 'success' ? '🎨 Tilt Brush 브러시 로드됨' : '⚠️ 기본 재질 모드'}
          </p>
        </div>
      )}
      
      {/* CSS 애니메이션 */}
      <style>
        {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* 🔧 팝업 표시시 MindAR 스캐너 가이드 숨기기 */
        ${showTimeoutPopup ? `
        .mindar-ui-overlay,
        .mindar-ui-scanning,
        [class*="mindar"][class*="ui"],
        [class*="scanning"],
        canvas + div {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        ` : ''}
        `}
      </style>
    </>
  );
}