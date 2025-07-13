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
  // WebXR 기반 AR 상태 관리
  const [status, setStatus] = useState<'loading' | 'ar-active' | 'fallback' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraPermission, setCameraPermission] = useState<'requesting' | 'granted' | 'denied'>('requesting');
  const [debugInfo, setDebugInfo] = useState<string>('시작...');
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(true);
  const [threeIcosaStatus, setThreeIcosaStatus] = useState<'loading' | 'success' | 'fallback'>('loading');
  const [webxrSupported, setWebxrSupported] = useState<boolean>(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const webxrSessionRef = useRef<XRSession | null>(null);
  
  console.log('🎬 ARViewer 렌더링 시작 - 디바이스:', deviceType);

  useEffect(() => {
    if (!containerRef.current || initializationRef.current) return;
    
    console.log('✅ Container DOM 준비 완료!');
    initializationRef.current = true;
    
    // 🎯 디바이스별 분기 (WebXR 기반)
    if (deviceType === 'mobile') {
      // 모바일: WebXR AR 시도 → 실패 시 3D 뷰어로 fallback
      initializeMobileWebXR(containerRef.current);
    } else {
      // 데스크톱: 바로 3D 뷰어
      initializeDesktop3D(containerRef.current);
    }

    // 정리 함수
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (webxrSessionRef.current) {
        webxrSessionRef.current.end();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🎯 모바일: WebXR AR 시도 → 실패 시 3D 뷰어 fallback
  const initializeMobileWebXR = async (container: HTMLDivElement) => {
    try {
      console.log('📱 모바일 모드: WebXR AR 시도 중...');
      setDebugInfo('WebXR 지원 확인 중...');
      
      // 1. WebXR 지원 여부 확인
      const webxrSupport = await checkWebXRSupport();
      setWebxrSupported(webxrSupport);
      
      if (!webxrSupport) {
        throw new Error('WebXR 미지원 - 3D 뷰어로 fallback');
      }
      
      // 2. 카메라 권한 요청
      setDebugInfo('카메라 권한 확인 중...');
      const granted = await requestCameraPermission();
      
      if (!granted) {
        throw new Error('카메라 권한 거부 - 3D 뷰어로 fallback');
      }
      
      // 3. WebXR AR 초기화
      setDebugInfo('WebXR AR 세션 시작 중...');
      await initializeWebXRAR(container);
      
    } catch (error) {
      console.warn('⚠️ 모바일 WebXR AR 실패, 3D 뷰어로 fallback:', error);
      setDebugInfo('AR 실패, 3D 모드로 전환 중...');
      
      // WebXR 실패 시 → 3D 뷰어로 fallback
      setStatus('fallback');
      
      setTimeout(() => {
        console.log('🔄 모바일 3D 뷰어 모드로 전환');
        setDebugInfo('3D 뷰어 초기화 중...');
        initializeDesktop3D(container);
      }, 1000);
    }
  };

  // 🎯 WebXR 지원 확인
  const checkWebXRSupport = async (): Promise<boolean> => {
    try {
      if (!('xr' in navigator)) {
        console.warn('❌ WebXR API 미지원');
        return false;
      }
      
      // @ts-ignore - WebXR 타입 정의
      const isSupported = await navigator.xr?.isSessionSupported('immersive-ar');
      
      if (isSupported) {
        console.log('✅ WebXR immersive-ar 지원됨');
        return true;
      } else {
        console.warn('❌ WebXR immersive-ar 미지원');
        return false;
      }
    } catch (error) {
      console.warn('❌ WebXR 지원 확인 실패:', error);
      return false;
    }
  };

  // 🎯 WebXR AR 초기화 (향후 구현)
  const initializeWebXRAR = async (container: HTMLDivElement) => {
    try {
      console.log('📱 WebXR AR 모드 초기화 시작');
      setDebugInfo('WebXR 세션 생성 중...');
      
      // TODO: WebXR 세션 생성 및 초기화
      // const session = await navigator.xr.requestSession('immersive-ar', {
      //   requiredFeatures: ['hit-test'],
      //   optionalFeatures: ['anchors', 'dom-overlay']
      // });
      
      // 현재는 임시로 성공 처리 (실제 구현은 다음 단계)
      setStatus('ar-active');
      setDebugInfo('WebXR AR 활성화 완료 (구현 예정)');
      onLoadComplete?.();
      
      console.log('🎉 WebXR AR 준비 완료 (실제 구현 필요)');
      
    } catch (error) {
      console.error('❌ WebXR AR 초기화 실패:', error);
      setDebugInfo(`WebXR AR 실패: ${(error as Error).message}`);
      throw error;
    }
  };

  // 🎯 데스크톱: 기본 3D 뷰어
  const initializeDesktop3D = async (container: HTMLDivElement) => {
    try {
      console.log('🖥️ 3D 뷰어 모드 초기화 시작');
      setDebugInfo('3D 뷰어 라이브러리 로딩 중...');
      
      // 컨테이너 정리
      container.innerHTML = '';
      
      // Scene 생성
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a1a);
      
      // 카메라 설정
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(2, 2, 2);
      
      // 조명 설정
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 5);
      scene.add(directionalLight);
      
      // WebGL 렌더러
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

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

      console.log('✅ 3D 씬 초기화 완료');
      setDebugInfo('3D 모델 로딩 중...');

      // GLB 모델 로딩
      await loadModelWithThreeIcosa(scene);

      // 성공 상태 설정
      if (status === 'loading') {
        setStatus('fallback'); // 3D 뷰어 모드
      }
      onLoadComplete?.();
      setDebugInfo('3D 뷰어 완료!');

      // 렌더링 루프
      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
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
      console.error('❌ 3D 뷰어 초기화 실패:', error);
      const errorMsg = error instanceof Error ? error.message : '3D 뷰어 초기화 실패';
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
      return true;
      
    } catch (error) {
      console.error('❌ 카메라 권한 요청 실패:', error);
      setCameraPermission('denied');
      
      return false;
    }
  };

  // 🎯 Three-Icosa 확장과 함께 모델 로딩
  const loadModelWithThreeIcosa = async (parent: THREE.Object3D) => {
    try {
      console.log(`🔄 모델 로딩 시작:`, modelPath);
      setThreeIcosaStatus('loading');
      
      const loader = new GLTFLoader();
      let threeIcosaLoaded = false;
      
      // Three-Icosa 확장자 등록 시도
      try {
        setDebugInfo('Three-Icosa 브러시 확장 로딩 중...');
        
        // @ts-ignore - three-icosa 모듈 로딩
        const threeIcosaModule = await import('three-icosa');
        const { GLTFGoogleTiltBrushMaterialExtension } = threeIcosaModule;
        
        if (GLTFGoogleTiltBrushMaterialExtension) {
          // 브러시 경로 우선순위: CDN → 로컬
          const brushPaths = [
            'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/',
            '/brushes/'
          ];
          
          let brushPathUsed = null;
          for (const brushPath of brushPaths) {
            try {
              loader.register((parser: any) => new GLTFGoogleTiltBrushMaterialExtension(parser, brushPath));
              brushPathUsed = brushPath;
              break;
            } catch (pathError) {
              console.warn(`⚠️ 브러시 경로 실패 (${brushPath}):`, pathError);
            }
          }
          
          if (brushPathUsed) {
            console.log(`✅ Three-Icosa 확장자 등록 완료 (경로: ${brushPathUsed})`);
            setThreeIcosaStatus('success');
            threeIcosaLoaded = true;
            setDebugInfo('Three-Icosa 브러시 로드 완료!');
          }
        }
      } catch (icosaError) {
        console.warn('⚠️ Three-Icosa 로드 실패 (기본 GLTFLoader로 진행):', icosaError);
        setThreeIcosaStatus('fallback');
        setDebugInfo('브러시 정보 없이 기본 모드로 로딩...');
      }

      return new Promise((resolve, reject) => {
        setDebugInfo(`${threeIcosaLoaded ? 'Tilt Brush' : '기본'} 모델 로딩 중...`);
        
        loader.load(
          modelPath,
          (gltf: any) => {
            console.log(`🎉 모델 로딩 성공!`);
            
            const model = gltf.scene;
            
            // 모델 크기 및 위치 조정
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            // 적절한 스케일 조정
            const maxDimension = Math.max(size.x, size.y, size.z);
            const targetSize = 1.0;
            const scale = targetSize / maxDimension;
            
            model.scale.setScalar(scale);
            model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
            
            parent.add(model);
            
            console.log(`✅ 모델이 씬에 추가됨 (스케일: ${scale.toFixed(3)})`);
            setDebugInfo(`모델 로딩 완료! ${threeIcosaLoaded ? '(Tilt Brush 브러시 포함)' : '(기본 모드)'}`);
            resolve(gltf);
          },
          (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setDebugInfo(`모델 로딩 중... ${percent}%`);
          },
          (error: any) => {
            console.error(`❌ 모델 로딩 실패:`, error);
            setDebugInfo(`모델 로딩 실패: ${error.message}`);
            reject(error);
          }
        );
      });
      
    } catch (error) {
      console.error(`❌ 모델 로더 초기화 실패:`, error);
      setThreeIcosaStatus('fallback');
      throw error;
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ backgroundColor: status === 'ar-active' ? 'transparent' : '#1a1a1a' }}
      />
      
      {/* 카메라 권한 요청 중 (모바일 WebXR만) */}
      {deviceType === 'mobile' && cameraPermission === 'requesting' && status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6 max-w-sm">
            <div className="text-6xl mb-4">📸</div>
            <p className="text-lg font-medium mb-2">카메라 권한이 필요합니다</p>
            <p className="text-sm opacity-75 mb-4">바닥 인식 AR 기능을 사용하려면 카메라 접근을 허용해주세요</p>
            
            <div className="space-y-3 mb-4">
              <button
                onClick={async () => {
                  try {
                    const granted = await requestCameraPermission();
                    if (granted && containerRef.current) {
                      await initializeWebXRAR(containerRef.current);
                    }
                  } catch (error) {
                    setStatus('fallback');
                    if (containerRef.current) {
                      initializeDesktop3D(containerRef.current);
                    }
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-3 rounded-lg font-medium"
              >
                📸 카메라 허용하고 AR 보기
              </button>
              
              <button
                onClick={() => {
                  setStatus('fallback');
                  if (containerRef.current) {
                    initializeDesktop3D(containerRef.current);
                  }
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
              {webxrSupported ? 'WebXR AR 뷰어 로딩 중...' : '3D 뷰어 로딩 중...'}
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
      {(status === 'ar-active' || status === 'fallback') && (
        <div className="absolute top-4 left-4 bg-black/70 text-white p-2 rounded text-sm z-10">
          <div>✅ {
            status === 'ar-active' ? 'WebXR AR 모드' : 
            (deviceType === 'mobile') ? '모바일 3D 모드 (AR fallback)' : 
            '데스크톱 3D 모드'
          } 활성화</div>
          <div className="text-xs">
            🎨 Three-Icosa: {
              threeIcosaStatus === 'success' ? '✅ 브러시 로드됨' :
              threeIcosaStatus === 'fallback' ? '⚠️ 기본 모드' : '로딩 중...'
            }
          </div>
          <div className="text-xs">
            🌐 WebXR: {webxrSupported ? '✅ 지원됨' : '❌ 미지원'}
          </div>
          {status === 'fallback' && (
            <>
              <div>🔄 자동 회전: {autoRotate ? 'ON' : 'OFF'}</div>
              <div className="text-xs opacity-75 mt-1">
                {deviceType === 'mobile' ? '터치: 회전 | 핀치: 확대/축소' : '마우스: 회전 | 휠: 확대/축소'}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* 디버그 패널 */}
      {showDebugPanel && (
        <div className="fixed top-0 left-0 right-0 bg-purple-600/90 text-white p-2 text-xs z-50">
          <div className="flex justify-between items-center">
            <div>
              <div>디버그: {debugInfo}</div>
              <div>상태: {status} | 카메라: {cameraPermission} | 디바이스: {deviceType}</div>
              <div>WebXR: {webxrSupported ? '지원' : '미지원'} | 브러시: {threeIcosaStatus}</div>
              <div>🗑️ MindAR 제거완료 | 🚀 WebXR 준비단계</div>
              {errorMessage && <div className="text-yellow-300">오류: {errorMessage}</div>}
            </div>
            <button 
              onClick={() => setShowDebugPanel(false)}
              className="bg-white/20 px-2 py-1 rounded text-xs"
            >
              닫기
            </button>
          </div>
        </div>
      )}
      
      {/* WebXR AR 가이드 (향후 구현) */}
      {status === 'ar-active' && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded text-sm z-10">
          <div className="text-center">
            <div className="text-2xl mb-2">🚀</div>
            <p className="font-medium">WebXR AR 모드 (구현 예정)</p>
            <p className="text-xs opacity-75 mt-1">바닥을 터치하여 모델을 배치할 예정입니다</p>
          </div>
        </div>
      )}
    </div>
  );
}
