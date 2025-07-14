/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
// 🔧 Three.js만 직접 import (MindAR은 CDN으로 동적 로딩)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface ARViewerProps {
  modelPath: string;
  deviceType: 'mobile' | 'desktop';
  onLoadComplete?: () => void;
  onLoadError?: (error: string) => void;
  autoRotate?: boolean;
  rotationSpeed?: number;
  onBackPressed?: () => void;
}

export default function ARViewer({ 
  modelPath, 
  deviceType, 
  onLoadComplete, 
  onLoadError,
  onBackPressed
}: ARViewerProps) {
  // 🔧 AR 전용 상태 관리
  const [status, setStatus] = useState<'loading' | 'ar-active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('AR 초기화 중...');
  const [threeIcosaStatus, setThreeIcosaStatus] = useState<'loading' | 'success' | 'fallback'>('loading');
  const [markerDetected, setMarkerDetected] = useState<boolean>(false);
  const [showTimeoutPopup, setShowTimeoutPopup] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const cleanupRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markerFoundRef = useRef(false);
  const mindARInstanceRef = useRef<any>(null);
  const processedModelRef = useRef<THREE.Group | null>(null); // 🆕 처리된 모델 저장
  
  // 🔧 MindAR CDN 로딩 상태
  const mindARStateRef = useRef({
    isLoading: false,
    isLoaded: false,
    hasError: false
  });
  
  // 🔧 Three-Icosa 상태 (DesktopViewer와 동일한 구조)
  const threeIcosaStateRef = useRef({
    isLoading: false,
    isLoaded: false,
    hasError: false
  });
  
  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));

  console.log(`📱 ARViewer (CDN 방식) 렌더링 [${renderIdRef.current}] - 상태: ${status}`);

  // 🔧 MindAR 정리 함수
  const cleanupMindAR = useCallback(() => {
    try {
      if (mindARInstanceRef.current) {
        console.log('🧹 MindAR 인스턴스 정리 중...');
        mindARInstanceRef.current.stop();
        mindARInstanceRef.current = null;
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      
      console.log('✅ MindAR 정리 완료');
    } catch (error) {
      console.warn('⚠️ MindAR 정리 중 오류:', error);
    }
  }, []);

  // 🔧 CDN에서 MindAR 스크립트 동적 로딩
  const loadMindARFromCDN = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // 이미 로드된 경우
        if ((window as any).MindARThree) {
          console.log('📦 MindAR CDN 스크립트 이미 로드됨');
          resolve();
          return;
        }
        
        // 현재 로딩 중인 경우
        if (mindARStateRef.current.isLoading) {
          console.log('📦 MindAR CDN 스크립트 로딩 중 - 대기');
          const checkLoaded = () => {
            if (mindARStateRef.current.isLoaded) {
              resolve();
            } else if (mindARStateRef.current.hasError) {
              reject(new Error('MindAR CDN 스크립트 로딩 실패'));
            } else {
              setTimeout(checkLoaded, 100);
            }
          };
          checkLoaded();
          return;
        }
        
        mindARStateRef.current.isLoading = true;
        console.log('📦 MindAR CDN 스크립트 로딩 시작');
        setDebugInfo('MindAR CDN 스크립트 로딩 중...');
        
        // 🔧 공식 CDN 방식으로 스크립트 로딩
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js';
        script.async = true;
        
        // 타임아웃 설정
        const timeout = setTimeout(() => {
          console.error('❌ MindAR CDN 스크립트 로딩 타임아웃');
          mindARStateRef.current.hasError = true;
          mindARStateRef.current.isLoading = false;
          reject(new Error('MindAR CDN 스크립트 로딩 타임아웃'));
        }, 15000);
        
        script.onload = () => {
          clearTimeout(timeout);
          console.log('✅ MindAR CDN 스크립트 로드 완료');
          mindARStateRef.current.isLoaded = true;
          mindARStateRef.current.isLoading = false;
          setDebugInfo('MindAR CDN 로드 성공!');
          resolve();
        };
        
        script.onerror = () => {
          clearTimeout(timeout);
          console.error('❌ MindAR CDN 스크립트 로드 실패');
          mindARStateRef.current.hasError = true;
          mindARStateRef.current.isLoading = false;
          reject(new Error('MindAR CDN 스크립트 로드 실패'));
        };
        
        document.head.appendChild(script);
        
      } catch (error) {
        console.error('❌ MindAR CDN 스크립트 삽입 실패:', error);
        mindARStateRef.current.hasError = true;
        mindARStateRef.current.isLoading = false;
        reject(error);
      }
    });
  }, []);

  // 🔧 DesktopViewer와 동일한 방식으로 모델 전처리
  const preprocessModelWithBrushes = useCallback(async (): Promise<THREE.Group> => {
    try {
      console.log('🎨 모델 전처리 시작 (Three-Icosa 적용)');
      setLoadingProgress(20);

      const loader = new GLTFLoader();
      let threeIcosaLoaded = false;
      
      // 🔧 DesktopViewer와 완전히 동일한 Three-Icosa 로딩 로직
      if (!threeIcosaStateRef.current.isLoading && !threeIcosaStateRef.current.isLoaded) {
        threeIcosaStateRef.current.isLoading = true;
        
        try {
          setDebugInfo('Three-Icosa 브러시 확장 로딩 중...');
          setLoadingProgress(30);
          
          const threeIcosaModule = await import('three-icosa');
          const { GLTFGoogleTiltBrushMaterialExtension } = threeIcosaModule;
          
          if (GLTFGoogleTiltBrushMaterialExtension) {
            const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
            loader.register((parser: any) => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
            
            console.log('✅ AR용 Three-Icosa 확장자 등록 완료');
            threeIcosaStateRef.current.isLoaded = true;
            threeIcosaLoaded = true;
            setThreeIcosaStatus('success');
            setDebugInfo('Three-Icosa 브러시 로드 완료!');
          }
        } catch (icosaError) {
          console.warn('⚠️ Three-Icosa 로드 실패 (기본 모드):', icosaError);
          threeIcosaStateRef.current.hasError = true;
          setThreeIcosaStatus('fallback');
          setDebugInfo('기본 모드로 로딩...');
        }
        
        threeIcosaStateRef.current.isLoading = false;
      } else if (threeIcosaStateRef.current.isLoaded) {
        threeIcosaLoaded = true;
        console.log('✅ Three-Icosa 이미 로드됨 (재사용)');
      }
      
      setLoadingProgress(40);
      
      return new Promise((resolve, reject) => {
        setDebugInfo(`${threeIcosaLoaded ? 'Tilt Brush' : '기본'} 모델 로딩 중...`);
        
        loader.load(
          modelPath,
          (gltf: any) => {
            console.log('🎉 모델 전처리 완료! (브러시 정보 포함)');
            setLoadingProgress(60);
            
            // 🔧 DesktopViewer와 동일한 모델 처리 로직
            const model = gltf.scene.clone(); // 복제하여 독립적인 인스턴스 생성
            
            // 바운딩 박스 계산
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);
            
            // 🔧 AR에 적합한 스케일링 (기존 개선사항 적용)
            const scale = 0.5 / maxDimension; // 기존 0.1에서 0.5로 증가 (5배 더 크게)
            
            model.scale.setScalar(scale);
            
            // 🔧 중앙 정렬 (기존 개선사항 적용)
            model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
            
            console.log('✅ 모델 전처리 및 스케일링 완료');
            console.log(`📏 모델 크기: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
            console.log(`📐 적용된 스케일: ${scale.toFixed(3)}`);
            
            setDebugInfo(`모델 전처리 완료! ${threeIcosaLoaded ? '(Tilt Brush)' : '(기본)'}`);
            setLoadingProgress(70);
            
            // 그룹으로 래핑
            const modelGroup = new THREE.Group();
            modelGroup.add(model);
            
            resolve(modelGroup);
          },
          (progress: any) => {
            if (progress.total > 0) {
              const percent = Math.min(30, Math.round((progress.loaded / progress.total) * 30));
              setLoadingProgress(40 + percent); // 40% ~ 70% 범위
              setDebugInfo(`모델 로딩... ${Math.round((progress.loaded / progress.total) * 100)}%`);
            }
          },
          (loadError: any) => {
            console.error('❌ 모델 전처리 실패:', loadError);
            reject(loadError);
          }
        );
      });
      
    } catch (error) {
      console.error('❌ 모델 전처리 초기화 실패:', error);
      throw error;
    }
  }, [modelPath]);

  // 🔧 MindAR 세션 초기화 (CDN 방식)
  const initializeMindARSession = useCallback(async (): Promise<void> => {
    try {
      markerFoundRef.current = false;
      setMarkerDetected(false);
      console.log('🚀 MindAR 세션 초기화 시작 (CDN 방식)');
      setDebugInfo('MindAR 인스턴스 생성 중...');
      setLoadingProgress(75);
      
      // 🔧 CDN으로 로드된 MindAR 사용
      const MindARThree = (window as any).MindARThree;
      if (!MindARThree) {
        throw new Error('MindAR CDN 로딩이 완료되지 않음');
      }
      
      console.log('✅ MindAR CDN 모듈 접근 성공');
      setDebugInfo('MindARThree 인스턴스 생성 중...');
      
      const mindarThree = new MindARThree({
        container: containerRef.current!,
        imageTargetSrc: '/markers/qr-marker.mind',
      });
      
      // 인스턴스 저장
      mindARInstanceRef.current = mindarThree;
      
      const { renderer, scene, camera } = mindarThree;
      console.log('✅ MindARThree 인스턴스 생성 완료');
      
      const anchor = mindarThree.addAnchor(0);
      console.log('✅ AR 앵커 생성 완료');
      
      // 🔧 전처리된 모델을 앵커에 추가
      if (processedModelRef.current) {
        anchor.group.add(processedModelRef.current);
        console.log('✅ 전처리된 모델이 AR 앵커에 추가됨');
      } else {
        console.warn('⚠️ 전처리된 모델이 없음');
      }
      
      // 🎯 마커 인식 이벤트 핸들러
      anchor.onTargetFound = () => {
        console.log('🎯 마커 인식 성공!');
        setDebugInfo('마커 인식 성공! 3D 모델을 표시합니다.');
        setMarkerDetected(true);
        markerFoundRef.current = true;
        
        if (timeoutRef.current) {
          console.log('⏰ 마커 인식 타임아웃을 제거합니다.');
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        if (showTimeoutPopup) {
          setShowTimeoutPopup(false);
        }
      };

      anchor.onTargetLost = () => {
        console.log('💨 마커를 잃었습니다. 다시 스캔해주세요.');
        setDebugInfo('마커를 찾고 있습니다...');
        setMarkerDetected(false);
        markerFoundRef.current = false;
      };
      
      console.log('🎯 MindAR 세션 시작 중...');
      setDebugInfo('AR 세션 시작 중...');
      setLoadingProgress(85);
      
      try {
        await mindarThree.start();
        console.log('✅ MindAR 세션 시작 성공');
        setLoadingProgress(95);

        // 🔧 카메라 전체화면 CSS 적용 (기존 개선사항)
        const applyFullscreenCSS = () => {
          if (containerRef.current) {
            const canvas = containerRef.current.querySelector('canvas');
            if (canvas) {
              canvas.style.width = '100vw !important';
              canvas.style.height = '100vh !important';
              canvas.style.position = 'fixed !important';
              canvas.style.top = '0';
              canvas.style.left = '0';
              canvas.style.zIndex = '1';
              console.log('📱 카메라 전체화면 CSS 적용 완료');
            }
          }
        };
        
        setTimeout(applyFullscreenCSS, 500);

        // ⏰ 5초 마커 인식 타임아웃 (기존 개선사항)
        timeoutRef.current = setTimeout(() => {
          if (!markerFoundRef.current) {
            console.warn('⏰ 5초 동안 마커를 인식하지 못했습니다 - 팝업 표시');
            setShowTimeoutPopup(true);
            setDebugInfo('마커 인식 시간 초과 - 팝업이 표시됩니다.');
          }
        }, 5000);

        setLoadingProgress(100);

      } catch (startError) {
        console.error('❌ MindAR 세션 시작 실패:', startError);
        const errorMessage = startError instanceof Error ? startError.message : String(startError);
        throw new Error(`MindAR 세션 시작 실패: ${errorMessage}`);
      }
      
      // 🔧 MindAR 자체 렌더링 루프 사용
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });
      
      console.log('🎉 MindAR 세션 초기화 완료 (CDN 방식)');
      
    } catch (error) {
      console.error('❌ MindAR 세션 초기화 실패:', error);
      throw error;
    }
  }, [showTimeoutPopup]);

  // 🔧 모바일 AR 초기화 (3단계 프로세스)
  const initializeMobileAR = useCallback(async () => {
    try {
      console.log('📱 모바일 AR 초기화 시작 (CDN 방식)');
      setDebugInfo('1단계: MindAR CDN 로딩...');
      setLoadingProgress(5);
      
      // 🔧 1단계: CDN에서 MindAR 로딩
      await loadMindARFromCDN();
      setLoadingProgress(15);
      
      // 🔧 2단계: 모델 전처리 (Three-Icosa 적용)
      setDebugInfo('2단계: 모델 전처리 중...');
      const processedModel = await preprocessModelWithBrushes();
      processedModelRef.current = processedModel;
      setLoadingProgress(75);
      
      // 🔧 3단계: MindAR 세션 초기화
      setDebugInfo('3단계: AR 세션 초기화...');
      await initializeMindARSession();
      
      // 성공 상태 설정
      setStatus('ar-active');
      setDebugInfo('MindAR AR 모드 활성화 완료!');
      onLoadComplete?.();
      
      console.log('🎉 모바일 AR 초기화 완료 (CDN 방식)');
      
    } catch (error) {
      console.error('❌ 모바일 AR 초기화 실패:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setErrorMessage(errorMsg);
      setStatus('error');
      setDebugInfo(`모바일 AR 실패: ${errorMsg}`);
      onLoadError?.(errorMsg);
    }
  }, [loadMindARFromCDN, preprocessModelWithBrushes, initializeMindARSession, onLoadComplete, onLoadError]);

  // 뒤로가기 핸들러
  const handleBackPress = useCallback(() => {
    console.log('🔙 뒤로가기 버튼 클릭');
    cleanupMindAR();
    onBackPressed?.();
  }, [cleanupMindAR, onBackPressed]);

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
    
    console.log(`✅ ARViewer 초기화 시작 [${renderIdRef.current}] - CDN 방식`);
    initializationRef.current = true;
    
    const currentRenderId = renderIdRef.current;
    
    // 🎯 CDN 방식으로 AR 초기화
    initializeMobileAR();

    // 정리 함수
    return () => {
      console.log(`🧹 ARViewer 정리 [${currentRenderId}]`);
      cleanupMindAR();
      cleanupRef.current = true;
      initializationRef.current = false;
    };
  }, [deviceType, onLoadError, initializeMobileAR, cleanupMindAR]);

  return (
    <div className="fixed inset-0 w-full h-full">
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ 
          backgroundColor: status === 'ar-active' ? 'transparent' : '#000000',
          width: '100vw',
          height: '100vh'
        }}
      />
      
      {/* 뒤로가기 버튼 */}
      {status === 'ar-active' && (
        <button
          onClick={handleBackPress}
          className="absolute top-4 left-4 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full z-20 transition-colors shadow-lg"
          aria-label="뒤로가기"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      
      {/* 🔧 개선된 로딩 화면 */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
          <div className="text-center max-w-sm px-6">
            {/* 진행률 표시 */}
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
            <p className="text-lg font-medium mb-2">AR 뷰어 로딩 중...</p>
            <p className="text-sm opacity-50">{debugInfo}</p>
            
            {/* 로딩 단계 표시 */}
            <div className="mt-4 text-xs opacity-60">
              {loadingProgress < 15 && "📦 MindAR CDN 로딩..."}
              {loadingProgress >= 15 && loadingProgress < 75 && "🎨 3D 모델 + 브러시 처리..."}
              {loadingProgress >= 75 && loadingProgress < 100 && "📱 AR 세션 초기화..."}
              {loadingProgress >= 100 && "✅ 완료!"}
            </div>
          </div>
        </div>
      )}
      
      {/* 에러 */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-red-900/80 z-10">
          <div className="text-center p-6">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-lg font-bold mb-2">AR 뷰어 오류</p>
            <p className="text-sm opacity-75 mb-4">{errorMessage}</p>
            <p className="text-xs opacity-50 mb-6">디버그: {debugInfo}</p>
            <div className="space-y-2">
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-white/20 px-4 py-3 rounded-lg hover:bg-white/30 transition-colors font-medium"
              >
                🔄 다시 시도
              </button>
              {onBackPressed && (
                <button 
                  onClick={handleBackPress}
                  className="w-full bg-gray-600/80 px-4 py-2 rounded-lg hover:bg-gray-700/80 transition-colors"
                >
                  🔙 뒤로가기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 5초 타임아웃 팝업 (기존 개선사항) */}
      {showTimeoutPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="text-4xl mb-4">⏰</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">스캔되지 못했습니다</h3>
              <p className="text-gray-600 mb-4">
                5초 동안 마커가 인식되지 않았습니다.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                3D 모드로 보시겠습니까?
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    cleanupMindAR();
                    onBackPressed?.();
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-colors font-medium"
                >
                  🎨 3D 모드로 보기
                </button>
                
                <button 
                  onClick={() => {
                    setShowTimeoutPopup(false);
                    setMarkerDetected(false);
                    markerFoundRef.current = false;
                    timeoutRef.current = setTimeout(() => {
                      if (!markerFoundRef.current) {
                        setShowTimeoutPopup(true);
                      }
                    }, 5000);
                  }}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  더 스캔하기
                </button>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">마커 파일: /markers/qr-marker.mind</p>
                <p className="text-xs text-gray-400">
                  💡 충분한 조명과 안정된 카메라로 스캔해보세요
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* AR 상태 표시 */}
      {status === 'ar-active' && (
        <div className="absolute top-4 right-4 bg-black/70 text-white p-2 rounded text-sm z-10">
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${markerDetected ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <span className="text-xs">
                {markerDetected ? '🎯 마커 인식됨' : '👀 마커 찾는 중'}
              </span>
            </div>
          </div>
          <div className="text-xs opacity-75 mt-1">
            ✅ MindAR 모드 (CDN)
          </div>
          {threeIcosaStatus === 'success' && (
            <div className="text-xs opacity-75">
              🎨 Tilt Brush 활성화
            </div>
          )}
        </div>
      )}
      
      {/* 마커 스캔 안내 (AR 활성화 후 마커 미감지 시) */}
      {status === 'ar-active' && !markerDetected && !showTimeoutPopup && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/80 text-white p-4 rounded-xl max-w-sm mx-4 z-10">
          <div className="text-center">
            <div className="text-2xl mb-2">📱</div>
            <p className="text-sm font-medium mb-2">QR 마커를 스캔하세요</p>
            <p className="text-xs opacity-75">
              화면에 마커를 맞춰주세요
            </p>
            <div className="mt-3 flex justify-center">
              <div className="animate-pulse">
                <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 마커 인식 성공 메시지 */}
      {status === 'ar-active' && markerDetected && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-green-600/90 text-white p-4 rounded-xl max-w-sm mx-4 z-10">
          <div className="text-center">
            <div className="text-2xl mb-2">🎉</div>
            <p className="text-sm font-medium mb-1">마커 인식 성공!</p>
            <p className="text-xs opacity-90">
              3D 모델이 표시됩니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}