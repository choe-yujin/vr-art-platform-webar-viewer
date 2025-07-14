'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MindARThreeInstance } from '@/types/global';

interface ARViewerProps {
  modelPath: string;
  deviceType: 'mobile' | 'desktop';
  onLoadComplete?: () => void;
  onLoadError?: (error: string) => void;
  onBackPressed?: () => void;
  autoRotate?: boolean;
}

export default function ARViewer({
  modelPath,
  deviceType,
  onLoadComplete,
  onLoadError,
  onBackPressed,
}: ARViewerProps) {
  const [status, setStatus] = useState<'loading' | 'ar-active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('AR 초기화 중...');
  const [threeIcosaStatus, setThreeIcosaStatus] = useState<'loading' | 'success' | 'fallback'>('loading');

  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const cleanupRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markerFoundRef = useRef(false);

  const mindARStateRef = useRef({ isLoading: false, isLoaded: false, hasError: false });
  const threeIcosaStateRef = useRef({ isLoading: false, isLoaded: false, hasError: false });
  const mindarInstanceRef = useRef<MindARThreeInstance | null>(null);

  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));

  // MindAR 스크립트 로딩
  const ensureMindARScriptsLoaded = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (window.MindAR_THREE && window.MindAR_MindARThree) {
          resolve();
          return;
        }

        if (mindARStateRef.current.isLoading) {
          const checkLoaded = () => {
            if (mindARStateRef.current.isLoaded) resolve();
            else if (mindARStateRef.current.hasError) reject(new Error('MindAR 스크립트 로딩 실패'));
            else setTimeout(checkLoaded, 100);
          };
          checkLoaded();
          return;
        }
        
        mindARStateRef.current.isLoading = true;
        
        document.getElementById('mindar-import-map')?.remove();
        document.getElementById('mindar-module-script')?.remove();

        const importMap = document.createElement('script');
        importMap.type = 'importmap';
        importMap.id = 'mindar-import-map';
        importMap.textContent = JSON.stringify({
          "imports": {
            "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
            "mindar-image-three": "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js"
          }
        });
        document.head.appendChild(importMap);

        const moduleScript = document.createElement('script');
        moduleScript.type = 'module';
        moduleScript.id = 'mindar-module-script';
        moduleScript.textContent = `
          try {
            const THREE = await import('three');
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
            const { MindARThree } = await import('mindar-image-three');
            window.MindAR_THREE = THREE;
            window.MindAR_MindARThree = MindARThree;
            window.MindAR_GLTFLoader = GLTFLoader;
            window.dispatchEvent(new CustomEvent('mindARReady', { detail: { success: true } }));
          } catch (error) {
            window.dispatchEvent(new CustomEvent('mindARReady', { detail: { success: false, error: error.message } }));
          }
        `;

        const handleReady = (e: Event) => {
          const customEvent = e as CustomEvent;
          window.removeEventListener('mindARReady', handleReady);
          clearTimeout(timeout);
          if (customEvent.detail.success) {
            mindARStateRef.current.isLoaded = true;
            mindARStateRef.current.isLoading = false;
            resolve();
          } else {
            mindARStateRef.current.hasError = true;
            mindARStateRef.current.isLoading = false;
            reject(new Error(customEvent.detail.error));
          }
        };
        window.addEventListener('mindARReady', handleReady);
        const timeout = setTimeout(() => {
          reject(new Error('MindAR 스크립트 로딩 타임아웃'));
        }, 15000);
        document.head.appendChild(moduleScript);
      } catch (error) {
        mindARStateRef.current.hasError = true;
        mindARStateRef.current.isLoading = false;
        reject(error);
      }
    });
  }, []);

  // MindAR용 모델 로딩
  const loadModelForMindAR = useCallback(async (anchorGroup: THREE.Group): Promise<void> => {
    try {
      const THREE = window.MindAR_THREE;
      const GLTFLoader = window.MindAR_GLTFLoader;
      if (!GLTFLoader || !THREE) throw new Error('GLTFLoader를 window에서 찾을 수 없습니다.');
      
      const loader = new GLTFLoader();

      if (!threeIcosaStateRef.current.isLoading && !threeIcosaStateRef.current.isLoaded) {
        threeIcosaStateRef.current.isLoading = true;
        try {
          const { GLTFGoogleTiltBrushMaterialExtension } = await import('three-icosa');
          const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
          loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
          threeIcosaStateRef.current.isLoaded = true;
          setThreeIcosaStatus('success');
        } catch (icosaError) {
          threeIcosaStateRef.current.hasError = true;
          setThreeIcosaStatus('fallback');
          console.warn('⚠️ Three-Icosa 로드 실패:', icosaError);
        }
        threeIcosaStateRef.current.isLoading = false;
      }

      const gltf: GLTF = await loader.loadAsync(modelPath, progress => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        setDebugInfo(`모델 로딩... ${percent}%`);
      });

      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 0.5 / maxDim;
      model.scale.setScalar(scale);
      anchorGroup.add(model);

      setDebugInfo(`AR 모델 준비 완료! ${threeIcosaStateRef.current.isLoaded ? '(Tilt Brush)' : '(기본)'}`);
    } catch (error) {
      console.error('❌ MindAR 모델 로더 초기화 실패:', error);
      throw error;
    }
  }, [modelPath]);

  // MindAR 세션 초기화
  const initializeMindARSession = useCallback(async () => {
    try {
      markerFoundRef.current = false;
      await ensureMindARScriptsLoaded();
      
      const MindARThree = window.MindAR_MindARThree;
      if (!containerRef.current) throw new Error("컨테이너 없음");

      const mindarThree = new MindARThree({
        container: containerRef.current,
        imageTargetSrc: '/markers/qr-marker.mind',
      });
      mindarInstanceRef.current = mindarThree;

      const { renderer, scene, camera } = mindarThree;
      const anchor = mindarThree.addAnchor(0);

      anchor.onTargetFound = () => {
        setDebugInfo('마커 인식 성공! 모델을 표시합니다.');
        markerFoundRef.current = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
      anchor.onTargetLost = () => {
        setDebugInfo('마커를 찾고 있습니다...');
      };

      await loadModelForMindAR(anchor.group);

      await mindarThree.start();

      timeoutRef.current = setTimeout(() => {
        if (!markerFoundRef.current) {
          onLoadError?.('마커를 5초 안에 인식하지 못했습니다.');
          mindarThree.stop();
        }
      }, 5000);

      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });
    } catch (error) {
      console.error('❌ MindAR 세션 초기화 실패:', error);
      throw error;
    }
  }, [ensureMindARScriptsLoaded, loadModelForMindAR, onLoadError]);
  
  // 모바일 AR 초기화
  const initializeMobileAR = useCallback(async () => {
    try {
      await initializeMindARSession();
      setStatus('ar-active');
      setDebugInfo('MindAR AR 모드 활성화 완료!');
      onLoadComplete?.();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setErrorMessage(errorMsg);
      setStatus('error');
      setDebugInfo(`모바일 AR 실패: ${errorMsg}`);
      onLoadError?.(errorMsg);
    }
  }, [initializeMindARSession, onLoadComplete, onLoadError]);

  useEffect(() => {
    if (deviceType !== 'mobile' || !containerRef.current || initializationRef.current) {
      return;
    }
    const currentRenderId = renderIdRef.current;
    console.log(`✅ ARViewer 초기화 시작 [${currentRenderId}] - 모바일 AR 전용`);
    initializationRef.current = true;

    initializeMobileAR();

    return () => {
      console.log(`🧹 ARViewer 정리 [${currentRenderId}]`);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      mindarInstanceRef.current?.stop();
      cleanupRef.current = true;
      initializationRef.current = false;
      document.getElementById('mindar-import-map')?.remove();
      document.getElementById('mindar-module-script')?.remove();
    };
  }, [deviceType, initializeMobileAR]);

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* ✨ 뒤로가기 버튼 추가 */}
      <button
        onClick={onBackPressed}
        className="absolute top-4 left-4 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full z-20 transition-colors"
        aria-label="뒤로가기"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ backgroundColor: status === 'ar-active' ? 'transparent' : '#000000' }}
      />
      
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">AR 뷰어 로딩 중...</p>
            <p className="text-sm opacity-50 mt-2">{debugInfo}</p>
          </div>
        </div>
      )}
      
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-red-900/80 z-10">
          <div className="text-center p-6">
            <p className="text-lg font-bold mb-2">⚠️ AR 오류 발생</p>
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
      
      {status === 'ar-active' && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded text-sm z-10 pointer-events-none">
          <div className="text-center">
            <p>✅ AR 모드 활성화 - 카메라로 마커를 스캔하세요</p>
            <p className="text-xs opacity-80">
              { threeIcosaStatus === 'success' ? '🎨 Tilt Brush 브러시 로드됨' : '⚠️ 기본 재질 모드' }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}