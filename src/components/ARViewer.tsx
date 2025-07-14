/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface ARViewerProps {
  modelPath: string;
  deviceType: 'mobile' | 'desktop';
  onLoadComplete?: () => void;
  onLoadError?: (error: string) => void;
  autoRotate?: boolean;
  rotationSpeed?: number;
}

export default function ARViewer({ 
  modelPath, 
  deviceType, 
  onLoadComplete, 
  onLoadError
}: ARViewerProps) {
  // 🔧 AR 전용 상태 관리
  const [status, setStatus] = useState<'loading' | 'ar-active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('AR 초기화 중...');
  const [threeIcosaStatus, setThreeIcosaStatus] = useState<'loading' | 'success' | 'fallback'>('loading');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const cleanupRef = useRef(false);
  
  // 🔧 MindAR 글로벌 상태
  const mindARStateRef = useRef({
    isLoading: false,
    isLoaded: false,
    hasError: false
  });
  
  // 🔧 Three-Icosa 상태
  const threeIcosaStateRef = useRef({
    isLoading: false,
    isLoaded: false,
    hasError: false
  });
  
  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));

  console.log(`📱 ARViewer (AR 전용) 렌더링 [${renderIdRef.current}] - 상태: ${status}`);

  // 🔧 MindAR 스크립트 로딩
  const ensureMindARScriptsLoaded = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // 이미 로드된 경우
        if (window.MindAR_THREE && window.MindAR_MindARThree) {
          console.log('📦 MindAR 스크립트 이미 로드됨');
          setDebugInfo('MindAR 모듈 이미 준비됨!');
          resolve();
          return;
        }
        
        // 현재 로딩 중인 경우
        if (mindARStateRef.current.isLoading) {
          console.log('📦 MindAR 스크립트 로딩 중 - 대기');
          const checkLoaded = () => {
            if (mindARStateRef.current.isLoaded) {
              resolve();
            } else if (mindARStateRef.current.hasError) {
              reject(new Error('MindAR 스크립트 로딩 실패'));
            } else {
              setTimeout(checkLoaded, 100);
            }
          };
          checkLoaded();
          return;
        }
        
        mindARStateRef.current.isLoading = true;
        console.log('📦 MindAR 스크립트 로딩 시작');
        setDebugInfo('MindAR 스크립트 로딩 중...');
        
        // 기존 스크립트 정리
        const existingImportMap = document.getElementById('mindar-import-map');
        const existingModuleScript = document.getElementById('mindar-module-script');
        
        if (existingImportMap) existingImportMap.remove();
        if (existingModuleScript) existingModuleScript.remove();
        
        // Import Map 생성
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
        console.log('✅ Import Map 삽입 완료');
        
        // Module Script 생성
        const moduleScript = document.createElement('script');
        moduleScript.type = 'module';
        moduleScript.id = 'mindar-module-script';
        moduleScript.textContent = `
          try {
            console.log('📦 MindAR 모듈 import 시작...');
            
            const THREE = await import('three');
            const { MindARThree } = await import('mindar-image-three');
            
            window.MindAR_THREE = THREE;
            window.MindAR_MindARThree = MindARThree;
            
            console.log('✅ MindAR 모듈 로드 완료');
            
            window.dispatchEvent(new CustomEvent('mindARReady', {
              detail: { success: true }
            }));
            
          } catch (error) {
            console.error('❌ MindAR 모듈 로드 실패:', error);
            window.dispatchEvent(new CustomEvent('mindARReady', {
              detail: { success: false, error: error.message }
            }));
          }
        `;
        
        // 이벤트 리스너
        const handleMindARReady = (event: any) => {
          console.log('📦 MindAR 로딩 이벤트:', event.detail);
          window.removeEventListener('mindARReady', handleMindARReady);
          
          if (event.detail.success) {
            mindARStateRef.current.isLoaded = true;
            mindARStateRef.current.isLoading = false;
            setDebugInfo('MindAR 모듈 로드 성공!');
            resolve();
          } else {
            mindARStateRef.current.hasError = true;
            mindARStateRef.current.isLoading = false;
            reject(new Error(event.detail.error));
          }
        };
        
        window.addEventListener('mindARReady', handleMindARReady);
        
        // 타임아웃
        const timeout = setTimeout(() => {
          console.error('❌ MindAR 스크립트 로딩 타임아웃');
          window.removeEventListener('mindARReady', handleMindARReady);
          mindARStateRef.current.hasError = true;
          mindARStateRef.current.isLoading = false;
          reject(new Error('MindAR 스크립트 로딩 타임아웃'));
        }, 30000);
        
        // 성공 시 타임아웃 해제
        const originalResolve = resolve;
        resolve = () => {
          clearTimeout(timeout);
          originalResolve();
        };
        
        document.head.appendChild(moduleScript);
        
      } catch (error) {
        console.error('❌ MindAR 스크립트 삽입 실패:', error);
        mindARStateRef.current.hasError = true;
        mindARStateRef.current.isLoading = false;
        reject(error);
      }
    });
  }, []);

  // 🔧 MindAR용 모델 로딩
  const loadModelForMindAR = useCallback(async (anchorGroup: any, THREE: any): Promise<void> => {
    try {
      console.log('🎨 MindAR 모델 로딩 시작');
      
      const loader = new THREE.GLTFLoader();
      let threeIcosaLoaded = false;
      
      // Three-Icosa 재렌더링 방지
      if (!threeIcosaStateRef.current.isLoading && !threeIcosaStateRef.current.isLoaded) {
        threeIcosaStateRef.current.isLoading = true;
        
        try {
          const threeIcosaModule = await import('three-icosa');
          const { GLTFGoogleTiltBrushMaterialExtension } = threeIcosaModule;
          
          if (GLTFGoogleTiltBrushMaterialExtension) {
            const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
            loader.register((parser: any) => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
            
            console.log('✅ Three-Icosa 확장자 등록 완료 (AR 전용)');
            threeIcosaStateRef.current.isLoaded = true;
            threeIcosaLoaded = true;
            setThreeIcosaStatus('success');
          }
        } catch (icosaError) {
          console.warn('⚠️ Three-Icosa 로드 실패:', icosaError);
          threeIcosaStateRef.current.hasError = true;
          setThreeIcosaStatus('fallback');
        }
        
        threeIcosaStateRef.current.isLoading = false;
      } else if (threeIcosaStateRef.current.isLoaded) {
        threeIcosaLoaded = true;
        console.log('✅ Three-Icosa 이미 로드됨 (재사용)');
      }
      
      return new Promise((resolve, reject) => {
        setDebugInfo(`모델 로딩 중... ${threeIcosaLoaded ? '(Tilt Brush)' : '(기본)'}`);
        
        loader.load(
          modelPath,
          (gltf: any) => {
            console.log('🎉 MindAR 모델 로딩 성공!');
            
            anchorGroup.add(gltf.scene);
            
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = box.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);
            
            const scale = 0.1 / maxDimension;
            gltf.scene.scale.setScalar(scale);
            
            console.log('✅ 모델이 AR 앵커에 추가됨');
            setDebugInfo(`AR 모델 준비 완료! ${threeIcosaLoaded ? '(Tilt Brush)' : '(기본)'}`);
            
            resolve();
          },
          (progress: any) => {
            if (progress.total > 0) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              setDebugInfo(`모델 로딩... ${percent}%`);
            }
          },
          (loadError: any) => {
            console.error('❌ MindAR 모델 로딩 실패:', loadError);
            reject(loadError);
          }
        );
      });
      
    } catch (error) {
      console.error('❌ MindAR 모델 로더 초기화 실패:', error);
      throw error;
    }
  }, [modelPath]);

  // 🔧 MindAR 세션 초기화
  const initializeMindARSession = useCallback(async (): Promise<void> => {
    try {
      console.log('🚀 MindAR 세션 초기화 시작');
      setDebugInfo('MindAR 인스턴스 생성 중...');
      
      if (!window.MindAR_THREE || !window.MindAR_MindARThree) {
        throw new Error('MindAR 모듈이 전역 객체에 없음');
      }
      
      const THREE = window.MindAR_THREE;
      const MindARThree = window.MindAR_MindARThree;
      
      console.log('✅ MindAR 모듈 접근 성공');
      setDebugInfo('MindARThree 인스턴스 생성 중...');
      
      const mindarThree = new MindARThree({
        container: containerRef.current!,
        imageTargetSrc: 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind',
      });
      
      const { renderer, scene, camera } = mindarThree;
      console.log('✅ MindARThree 인스턴스 생성 완료');
      
      const anchor = mindarThree.addAnchor(0);
      console.log('✅ AR 앵커 생성 완료');
      
      setDebugInfo('3D 모델 로딩 중...');
      
      await loadModelForMindAR(anchor.group, THREE);
      
      console.log('🎯 MindAR 세션 시작 중...');
      setDebugInfo('AR 세션 시작 중...');
      
      try {
        await mindarThree.start();
        console.log('✅ MindAR 세션 시작 성공');
      } catch (startError) {
        console.error('❌ MindAR 세션 시작 실패:', startError);
        const errorMessage = startError instanceof Error ? startError.message : String(startError);
        throw new Error(`MindAR 세션 시작 실패: ${errorMessage}`);
      }
      
      // 렌더링 루프
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });
      
      console.log('🎉 MindAR 세션 초기화 완료');
      
    } catch (error) {
      console.error('❌ MindAR 세션 초기화 실패:', error);
      throw error;
    }
  }, [loadModelForMindAR]);

  // 🔧 모바일 AR 초기화 (AR 전용)
  const initializeMobileAR = useCallback(async () => {
    try {
      console.log('📱 모바일 AR 초기화 시작 (AR 전용)');
      setDebugInfo('MindAR 스크립트 로딩 중...');
      
      // MindAR 스크립트 로딩
      await ensureMindARScriptsLoaded();
      
      // MindAR 세션 초기화
      await initializeMindARSession();
      
      // 성공 상태 설정
      setStatus('ar-active');
      setDebugInfo('MindAR AR 모드 활성화 완료!');
      onLoadComplete?.();
      
      console.log('🎉 모바일 AR 초기화 완료 (AR 전용)');
      
    } catch (error) {
      console.error('❌ 모바일 AR 초기화 실패 (AR 전용):', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setErrorMessage(errorMsg);
      setStatus('error');
      setDebugInfo(`모바일 AR 실패: ${errorMsg}`);
      onLoadError?.(errorMsg);
    }
  }, [ensureMindARScriptsLoaded, initializeMindARSession, onLoadComplete, onLoadError]);

  useEffect(() => {
    // 🚫 데스크톱에서는 절대 실행되면 안됨
    if (deviceType !== 'mobile') {
      console.error('❌ ARViewer는 모바일 전용입니다. 데스크톱에서는 DesktopViewer를 사용하세요.');
      setStatus('error');
      setErrorMessage('ARViewer는 모바일 전용입니다');
      onLoadError?.('ARViewer는 모바일 전용입니다');
      return;
    }

    // 중복 실행 방지
    if (!containerRef.current || initializationRef.current) {
      return;
    }
    
    console.log(`✅ ARViewer 초기화 시작 [${renderIdRef.current}] - 모바일 AR 전용`);
    initializationRef.current = true;
    
    // Save current render ID to variable for cleanup
    const currentRenderId = renderIdRef.current;
    
    // 🎯 오직 AR 모드만 초기화
    initializeMobileAR();

    // 정리 함수
    return () => {
      console.log(`🧹 ARViewer 정리 [${currentRenderId}]`);
      cleanupRef.current = true;
      initializationRef.current = false;
    };
  }, [deviceType, onLoadError, initializeMobileAR]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ backgroundColor: status === 'ar-active' ? 'transparent' : '#000000' }}
      />
      
      {/* 로딩 */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">AR 뷰어 로딩 중...</p>
            <p className="text-sm opacity-50 mt-2">{debugInfo}</p>
          </div>
        </div>
      )}
      
      {/* 에러 */}
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
      
      {/* AR 성공 상태 */}
      {status === 'ar-active' && (
        <div className="absolute top-4 left-4 bg-black/70 text-white p-2 rounded text-sm z-10">
          <div>✅ MindAR 모드 (AR 전용)</div>
          <div className="text-xs">
            🎨 Three-Icosa: {
              threeIcosaStatus === 'success' ? '✅ 브러시 로드됨' :
              threeIcosaStatus === 'fallback' ? '⚠️ 기본 모드' : '로딩 중...'
            }
          </div>
          <div className="text-xs text-green-400">🎯 AR 전용 컴포넌트</div>
        </div>
      )}
      
      {/* AR 활성화 완료 안내 */}
      {status === 'ar-active' && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded text-sm z-10">
          <div className="text-center">
            <div className="text-2xl mb-2">📱</div>
            <p className="font-medium">MindAR 전용 뷰어 완료</p>
            <p className="text-xs opacity-75 mt-1">데스크톱 로직 완전 제거 + AR 전용 최적화</p>
            <p className="text-xs text-green-400 mt-1">✅ AR 전용 모드 - 카메라로 마커를 스캔하세요</p>
            <p className="text-xs opacity-50 mt-2">
              마커: 
              <a 
                href="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline text-blue-300 ml-1"
              >
                여기서 다운로드
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}