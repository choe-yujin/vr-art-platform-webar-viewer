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

// 컴포넌트가 받을 props 정의
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

  const containerRef = useRef<HTMLDivElement>(null);
  const mindarInstanceRef = useRef<MindARThreeInstance | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationRef = useRef(false);

  const SCRIPT_ID_IMPORT_MAP = 'mindar-import-map';
  const SCRIPT_ID_MODULE = 'mindar-module-script';

  // 스크립트 로딩 함수
  const ensureMindARScriptsLoaded = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (window.MindAR_THREE && window.MindAR_MindARThree) {
          return resolve();
        }
        document.getElementById(SCRIPT_ID_IMPORT_MAP)?.remove();
        document.getElementById(SCRIPT_ID_MODULE)?.remove();
        const importMap = document.createElement('script');
        importMap.id = SCRIPT_ID_IMPORT_MAP;
        importMap.type = 'importmap';
        importMap.textContent = JSON.stringify({
          "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js", "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/", "mindar-image-three": "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js" }
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
            window.dispatchEvent(new CustomEvent('mindARReady', { detail: { success: true } }));
          } catch (error) {
            window.dispatchEvent(new CustomEvent('mindARReady', { detail: { success: false, error: error.message } }));
          }
        `;
        const handleReady = (e: Event) => {
          const customEvent = e as CustomEvent;
          window.removeEventListener('mindARReady', handleReady);
          clearTimeout(timeout);
          if (customEvent.detail.success) resolve();
          else reject(new Error(customEvent.detail.error));
        };
        window.addEventListener('mindARReady', handleReady);
        const timeout = setTimeout(() => reject(new Error('MindAR 스크립트 로딩 타임아웃')), 15000);
        document.head.appendChild(moduleScript);
    });
  }, [SCRIPT_ID_IMPORT_MAP, SCRIPT_ID_MODULE]);

  // 모델 로딩 함수
  const loadModelForMindAR = useCallback(async (anchorGroup: THREE.Group): Promise<void> => {
    const GLTFLoader = window.MindAR_GLTFLoader;
    if (!GLTFLoader) throw new Error('GLTFLoader를 window에서 찾을 수 없습니다.');
    const loader = new GLTFLoader();
    try {
        const { GLTFGoogleTiltBrushMaterialExtension } = await import('three-icosa');
        const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
        loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
        setThreeIcosaStatus('success');
    } catch (e) {
        setThreeIcosaStatus('fallback');
        console.warn("three-icosa 확장 로드 실패:", e);
    }
    const gltf: GLTF = await loader.loadAsync(modelPath, progress => {
        if (progress.total > 0) {
            let percent = Math.round((progress.loaded / progress.total) * 100);
            percent = Math.min(percent, 99);
            setDebugInfo(`모델 로딩... ${percent}%`);
        }
    });
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.0 / maxDim;
    model.scale.setScalar(scale);
    model.position.y += (size.y * scale) / 2;
    anchorGroup.add(model);
  }, [modelPath]);

  // AR 세션 초기화 함수
  const initializeMindARSession = useCallback(async () => {
    let markerFound = false;
    await ensureMindARScriptsLoaded();
    const MindARThree = window.MindAR_MindARThree;
    if (!containerRef.current || !MindARThree) throw new Error("MindAR 초기화 준비 안됨");
    const mindarThree = new MindARThree({
      container: containerRef.current,
      imageTargetSrc: '/markers/qr-marker.mind',
    });
    mindarInstanceRef.current = mindarThree;
    const { renderer, scene, camera } = mindarThree;
    const anchor = mindarThree.addAnchor(0);
    anchor.onTargetFound = () => {
      markerFound = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setDebugInfo('🎯 마커 인식 성공!');
    };
    anchor.onTargetLost = () => setDebugInfo('마커를 다시 스캔해주세요...');
    await loadModelForMindAR(anchor.group);
    await mindarThree.start();
    timeoutRef.current = setTimeout(() => {
      if (!markerFound) {
        mindarInstanceRef.current?.stop();
        setShowTimeoutPopup(true);
      }
    }, 5000);
    renderer.setAnimationLoop(() => renderer.render(scene, camera));
  }, [ensureMindARScriptsLoaded, loadModelForMindAR]);

  // 스캔 재시도 함수
  const handleRetryScan = useCallback(() => {
    setShowTimeoutPopup(false);
    setDebugInfo('AR 스캔 재시도...');
    initializeMindARSession().catch(error => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setErrorMessage(errorMsg);
      setStatus('error');
      onLoadError?.(errorMsg);
    });
  }, [initializeMindARSession, onLoadError]);
  
  // 메인 초기화 함수
  const initializeMobileAR = useCallback(async () => {
    try {
      await initializeMindARSession();
      setStatus('ar-active');
      onLoadComplete?.();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setErrorMessage(errorMsg);
      setStatus('error');
      onLoadError?.(errorMsg);
    }
  }, [initializeMindARSession, onLoadComplete, onLoadError]);

  // 컴포넌트 생명주기 관리
  useEffect(() => {
    if (deviceType !== 'mobile' || !containerRef.current || initializationRef.current) {
      return;
    }
    initializationRef.current = true;
    const currentContainer = containerRef.current;
    
    initializeMobileAR();

    return () => {
      console.log(`🧹 ARViewer 완벽 정리 시작`);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const mindarInstance = mindarInstanceRef.current;
      if (mindarInstance) {
        mindarInstance.stop();
        if (mindarInstance.renderer) {
          mindarInstance.renderer.dispose();
          mindarInstance.renderer.forceContextLoss();
        }
        mindarInstance.scene.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.geometry?.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(material => material?.dispose());
          }
        });
      }
      mindarInstanceRef.current = null;
      document.getElementById(SCRIPT_ID_IMPORT_MAP)?.remove();
      document.getElementById(SCRIPT_ID_MODULE)?.remove();
      
      if (window.MindAR_THREE) window.MindAR_THREE = undefined;
      if (window.MindAR_MindARThree) window.MindAR_MindARThree = undefined;
      if (window.MindAR_GLTFLoader) window.MindAR_GLTFLoader = undefined;

      if (currentContainer) {
        currentContainer.innerHTML = '';
      }
      initializationRef.current = false;
    };
  }, [deviceType, initializeMobileAR, SCRIPT_ID_IMPORT_MAP, SCRIPT_ID_MODULE]);

  return (
    <div className="absolute inset-0 w-full h-full">
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
            <button
              onClick={() => window.location.reload()}
              className="bg-white/20 px-4 py-2 rounded hover:bg-white/30 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {showTimeoutPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-4xl mb-4">⏱️</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">마커를 찾지 못했습니다</h3>
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
      
      {status === 'ar-active' && !showTimeoutPopup && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded text-sm z-10 pointer-events-none">
          <div className="text-center">
            <p>{debugInfo}</p>
            <p className="text-xs opacity-80">
              { threeIcosaStatus === 'success' ? '🎨 Tilt Brush 브러시 로드됨' : '⚠️ 기본 재질 모드' }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}