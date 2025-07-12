/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client';

import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
  onLoadError,
  autoRotate = true,
  rotationSpeed = 0.1
}: ARViewerProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraPermission, setCameraPermission] = useState<'requesting' | 'granted' | 'denied' | 'fallback'>('requesting');
  const [debugInfo, setDebugInfo] = useState<string>('시작...');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  
  console.log('🎬 ARViewer 렌더링 시작 - 디바이스:', deviceType);

  useEffect(() => {
    if (!containerRef.current || initializationRef.current) return;
    
    console.log('✅ Container DOM 준비 완료!');
    initializationRef.current = true;
    
    // Three.js를 전역에 설정 (MindAR이 접근할 수 있도록)
    (window as any).THREE = THREE;
    
    // 🎯 디바이스별 분기
    if (deviceType === 'mobile') {
      // 모바일: AR 시도 → 실패 시 3D 뷰어로 fallback
      initializeMobileWithFallback(containerRef.current);
    } else {
      // 데스크톱: 바로 3D 뷰어
      initializeDesktop3D(containerRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🎯 모바일: AR 시도 → 실패 시 3D 뷰어 fallback
  const initializeMobileWithFallback = async (container: HTMLDivElement) => {
    try {
      console.log('📱 모바일 모드: AR 시도 중...');
      setDebugInfo('카메라 권한 확인 중...');
      
      // 1. 카메라 권한 요청
      const granted = await requestCameraPermission();
      
      // 2. 권한이 허용되면 AR 초기화
      if (granted) {
        setDebugInfo('MindAR 라이브러리 확인 중...');
        await initializeMobileAR(container);
      }
      
    } catch (error) {
      console.warn('⚠️ 모바일 AR 실패, 3D 뷰어로 fallback:', error);
      setDebugInfo('AR 실패, 3D 모드로 전환 중...');
      
      // 카메라 권한 거부 또는 AR 실패 시 → 3D 뷰어로 fallback
      setCameraPermission('fallback');
      
      setTimeout(() => {
        console.log('🔄 모바일 3D 뷰어 모드로 전환');
        setDebugInfo('3D 뷰어 초기화 중...');
        initializeDesktop3D(container);
      }, 1000); // 1초 후 전환
    }
  };

  // 🎯 모바일: MindAR.js + 카메라
  const initializeMobileAR = async (container: HTMLDivElement) => {
    try {
      console.log('📱 모바일 AR 모드 초기화 시작');
      setDebugInfo('MindAR 라이브러리 로딩 대기...');
      
      // MindAR 초기화 대기
      await waitForMindAR();
      setDebugInfo('MindAR 라이브러리 로드 완료!');
      
      setDebugInfo('MindAR 컨테이너 설정 중...');
      
      // 컨테이너 정리
      container.innerHTML = '';
      container.style.position = 'relative';
      container.style.width = '100%';
      container.style.height = '100%';
      
      // MindAR 설정
      const mindarThree = new (window as any).MindARThree({
        container: container,
        imageTargetSrc: '/markers/qr-marker.mind',
        maxTrack: 1,
        filterMinCF: 0.0001,
        filterBeta: 0.001,
        warmupTolerance: 5,
        missTolerance: 5,
        uiLoading: "no",
        uiScanning: "no",
        uiError: "no"
      });
      
      const { renderer, scene, camera } = mindarThree;
      
      console.log('✅ MindAR 초기화 완료');
      setDebugInfo('3D 모델 로딩 중...');
      
      // GLB 모델 로딩 (AR용)
      await loadARModel(scene, mindarThree);
      setDebugInfo('MindAR 시작 중...');
      
      // AR 시작
      await mindarThree.start();
      console.log('🎉 모바일 AR 시작!');
      setDebugInfo('AR 활성화 완료!');
      
      setStatus('success');
      onLoadComplete?.();
      
      // 렌더링 루프
      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();
      
    } catch (error) {
      console.error('❌ 모바일 AR 초기화 실패:', error);
      setDebugInfo(`AR 초기화 실패: ${(error as Error).message}`);
      throw error;
    }
  };

  // 🎯 데스크톱: 기존 3D 뷰어
  const initializeDesktop3D = async (container: HTMLDivElement) => {
    try {
      console.log('🖥️ 데스크톱 3D 모드 초기화 시작');
      setDebugInfo('3D 뷰어 라이브러리 로딩 중...');
      
      setDebugInfo('3D 씬 생성 중...');
      
      // 컨테이너 정리
      container.innerHTML = '';
      
      // Scene 생성
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      scene.add(camera);
      
      camera.position.set(1, 1, 1);
      camera.setRotationFromEuler(new THREE.Euler(0.2, 1, -0.25));
      
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

      // OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.minDistance = 0.1;
      controls.maxDistance = 100;
      controls.maxPolarAngle = Math.PI;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = rotationSpeed;

      console.log('✅ 데스크톱 3D 씬 초기화 완료');
      setDebugInfo('3D 모델 로딩 중...');

      // GLB 모델 로딩
      await loadDesktopModel(scene, camera, controls);

      setStatus('success');
      onLoadComplete?.();
      setDebugInfo('3D 뷰어 완료!');

      // 렌더링 루프
      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // 리사이즈 핸들러
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);

    } catch (error) {
      console.error('❌ 데스크톱 3D 초기화 실패:', error);
      const errorMsg = error instanceof Error ? error.message : '데스크톱 3D 초기화 실패';
      setErrorMessage(errorMsg);
      setStatus('error');
      setDebugInfo(`3D 뷰어 오류: ${errorMsg}`);
      onLoadError?.(errorMsg);
    }
  };

  // 🎯 카메라 권한 요청
  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      console.log('📸 카메라 권한 요청 중...');
      setCameraPermission('requesting');
      
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('이 브라우저는 카메라를 지원하지 않습니다');
      }
      
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ 카메라 스트림 획득 성공:', stream);
      
      // 권한 확인 후 스트림 정리
      stream.getTracks().forEach(track => track.stop());
      
      console.log('✅ 카메라 권한 허용됨');
      setCameraPermission('granted');
      return true; // 성공 반환
      
    } catch (error) {
      console.error('❌ 카메라 권한 요청 실패:', error);
      setCameraPermission('denied');
      
      let userMessage = '카메라 기능을 사용할 수 없습니다';
      if ((error as any)?.name === 'NotAllowedError') {
        userMessage = '카메라 접근이 거부되었습니다.';
      }
      
      throw new Error(userMessage);
    }
  };

  // 🎯 MindAR 로딩 대기
  const waitForMindAR = async () => {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 100;
      
      const checkMindAR = () => {
        console.log(`MindAR 체크 시도 ${attempts + 1}/${maxAttempts}`);
        
        if ((window as any).MindARThree) {
          console.log('✅ MindAR 라이브러리 로딩 완료');
          resolve();
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkMindAR, 100);
        } else {
          console.error('❌ MindAR 라이브러리 로딩 실패');
          reject(new Error('MindAR 라이브러리 로딩 실패'));
        }
      };
      
      checkMindAR();
    });
  };

  // 🎯 AR 모델 로딩
  const loadARModel = async (scene: any, mindarThree: any) => {
    try {
      console.log('🔄 AR 모델 로딩 시작:', modelPath);
      
      const loader = new GLTFLoader();
      
      // three-icosa 확장자 등록 (AR용) - 타입 안전한 방법
      try {
        // @ts-ignore - three-icosa 모듈 로딩
        const threeIcosaModule = await import('three-icosa');
        const { GLTFGoogleTiltBrushMaterialExtension } = threeIcosaModule;
        
        if (GLTFGoogleTiltBrushMaterialExtension) {
          const brushPath = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
          loader.register((parser: any) => new GLTFGoogleTiltBrushMaterialExtension(parser, brushPath));
          console.log('✅ AR용 three-icosa 확장자 등록 완료');
        }
      } catch (icosaError) {
        console.warn('⚠️ AR용 three-icosa 로드 실패 (기본 모드로 진행):', icosaError);
      }

      return new Promise((resolve, reject) => {
        loader.load(
          modelPath,
          (gltf: any) => {
            console.log('🎉 AR 모델 로딩 성공!');
            
            const anchor = mindarThree.addAnchor(0);
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);
            const scale = 0.3 / maxDimension;
            
            model.scale.setScalar(scale);
            model.position.set(0, 0, 0);
            anchor.group.add(model);
            
            console.log('✅ AR 모델이 앵커에 추가됨');
            resolve(gltf);
          },
          undefined,
          (error: any) => {
            console.error('❌ AR 모델 로딩 실패:', error);
            reject(error);
          }
        );
      });
      
    } catch (error) {
      console.error('❌ AR 모델 로더 초기화 실패:', error);
      throw error;
    }
  };

  // 🎯 데스크톱 모델 로딩
  const loadDesktopModel = async (scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) => {
    try {
      console.log('🔄 데스크톱 모델 로딩 시작:', modelPath);

      const gltfLoader = new GLTFLoader();
      
      // three-icosa 확장자 등록 (데스크톱용) - 타입 안전한 방법
      try {
        // @ts-ignore - three-icosa 모듈 로딩
        const threeIcosaModule = await import('three-icosa');
        const { GLTFGoogleTiltBrushMaterialExtension } = threeIcosaModule;
        
        if (GLTFGoogleTiltBrushMaterialExtension) {
          const brushPath = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
          gltfLoader.register((parser: any) => new GLTFGoogleTiltBrushMaterialExtension(parser, brushPath));
          console.log('✅ 데스크톱용 three-icosa 확장자 등록 완료');
        }
      } catch (icosaError) {
        console.warn('⚠️ 데스크톱용 three-icosa 로드 실패 (기본 모드로 진행):', icosaError);
      }

      return new Promise((resolve, reject) => {
        gltfLoader.load(
          modelPath,
          (model) => {
            console.log('🎉 데스크톱 모델 로딩 성공!');
            
            scene.add(model.scene);
            
            const box = new THREE.Box3().setFromObject(model.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            controls.target.copy(center);
            
            const maxDimension = Math.max(size.x, size.y, size.z);
            const distance = maxDimension * 0.5;
            const originalDistance = Math.sqrt(1*1 + 1*1 + 1*1);
            const scale = distance / originalDistance;
            
            camera.position.set(
              1 * scale + center.x,
              1 * scale + center.y, 
              1 * scale + center.z
            );
            
            controls.update();
            
            console.log('✅ 데스크톱 모델이 씬에 추가됨');
            resolve(model);
          },
          undefined,
          (error) => {
            console.error('❌ 데스크톱 모델 로딩 실패:', error);
            reject(error);
          }
        );
      });

    } catch (error) {
      console.error('❌ 데스크톱 모델 로더 초기화 실패:', error);
      throw error;
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ backgroundColor: (deviceType === 'mobile' && cameraPermission === 'granted') ? 'transparent' : '#000000' }}
      />
      
      {/* 카메라 권한 요청 중 (모바일만) */}
      {deviceType === 'mobile' && cameraPermission === 'requesting' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6 max-w-sm">
            <div className="text-6xl mb-4">📸</div>
            <p className="text-lg font-medium mb-2">카메라 권한이 필요합니다</p>
            <p className="text-sm opacity-75 mb-4">AR 기능을 사용하려면 카메라 접근을 허용해주세요</p>
            
            <div className="space-y-3 mb-4">
              <button
                onClick={async () => {
                  try {
                    console.log('📸 카메라 권한 재요청 시도');
                    const granted = await requestCameraPermission();
                    
                    // 권한이 허용되면 AR 초기화
                    if (granted && containerRef.current) {
                      await initializeMobileAR(containerRef.current);
                    }
                  } catch (error) {
                    console.log('카메라 권한 재요청 실패:', error);
                    setCameraPermission('fallback');
                    setTimeout(() => {
                      if (containerRef.current) {
                        initializeDesktop3D(containerRef.current);
                      }
                    }, 1000);
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-3 rounded-lg font-medium"
              >
                📸 카메라 허용하고 AR 보기
              </button>
              
              <button
                onClick={() => {
                  console.log('사용자가 AR 없이 감상 선택');
                  setCameraPermission('fallback');
                  setTimeout(() => {
                    if (containerRef.current) {
                      initializeDesktop3D(containerRef.current);
                    }
                  }, 500);
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 transition-colors px-4 py-3 rounded-lg font-medium"
              >
                🎨 AR 없이 감상하기
              </button>
            </div>
            
            <div className="text-xs opacity-50">
              브라우저에서 카메라 권한 팝업이 나타나지 않으면<br/>
              주소창 옆 카메라 아이콘을 클릭하여 수동으로 허용해주세요
            </div>
          </div>
        </div>
      )}
      
      {/* 로딩 중 */}
      {status === 'loading' && cameraPermission !== 'requesting' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">
              {(deviceType === 'mobile' && cameraPermission === 'granted') ? 'AR 뷰어 로딩 중...' : '3D 뷰어 로딩 중...'}
            </p>
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
      
      {/* 성공 상태 정보 */}
      {status === 'success' && (
        <div className="absolute top-4 left-4 bg-black/70 text-white p-2 rounded text-sm z-10">
          <div>✅ {
            (deviceType === 'mobile' && cameraPermission === 'granted') ? 'AR 모드' : 
            (deviceType === 'mobile' && cameraPermission === 'fallback') ? '모바일 3D 모드' : 
            '데스크톱 3D 모드'
          } 활성화</div>
          {(deviceType === 'mobile' && cameraPermission === 'granted') ? (
            <div className="text-xs opacity-75 mt-1">
              QR 마커를 카메라로 비춰보세요
            </div>
          ) : (
            <>
              <div>🔄 자동 회전: {autoRotate ? 'ON' : 'OFF'}</div>
              <div className="text-xs opacity-75 mt-1">
                {deviceType === 'mobile' ? '터치: 회전 | 핀치: 확대/축소' : '마우스: 회전 | 휠: 확대/축소'}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* AR 가이드 (모바일 AR 모드에만) */}
      {deviceType === 'mobile' && cameraPermission === 'granted' && status === 'success' && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded text-sm z-10">
          <div className="text-center">
            <div className="text-2xl mb-2">🎯</div>
            <p className="font-medium">QR 마커를 카메라로 비춰주세요</p>
            <p className="text-xs opacity-75 mt-1">마커가 인식되면 3D 모델이 나타납니다</p>
          </div>
        </div>
      )}
    </div>
  );
}