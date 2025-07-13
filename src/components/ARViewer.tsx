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
  rotationSpeed = 0.002 // 🎯 예전 코드와 동일한 속도
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
      // 모바일: WebXR 지원 확인 → 지원되면 카메라 권한 UI, 미지원이면 바로 3D 뷰어
      checkWebXRSupportAndProceed(containerRef.current);
    } else {
      // 데스크톱: 바로 3D 뷰어
      initializeDesktop3D(containerRef.current);
    }

    // 정리 함수 (세션 참조 캐시)
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      // WebXR 세션 정리 (캐시된 참조 사용)
      const currentSession = webxrSessionRef.current;
      if (currentSession) {
        currentSession.end().catch(() => {
          // 세션 종료 에러 무시 (이미 종료되었을 수 있음)
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🎯 작업지시서 패턴: WebXR 지원 확인 및 분기 처리
  const checkWebXRSupportAndProceed = async (container: HTMLDivElement) => {
    try {
      console.log('📱 모바일 모드: WebXR 지원 확인 시작');
      setDebugInfo('WebXR 지원 확인 중...');
      
      // 1. WebXR API 지원 여부 체크 (작업지시서 패턴)
      if (navigator.xr && navigator.xr.isSessionSupported) {
        console.log('✅ WebXR API 지원됨');
        
        // 2. immersive-ar 지원 여부 체크
        const arSupported = await navigator.xr.isSessionSupported('immersive-ar');
        setWebxrSupported(arSupported);
        
        if (arSupported) {
          console.log('✅ WebXR immersive-ar 지원됨 → 카메라 권한 요청 UI 표시');
          setDebugInfo('WebXR AR 지원됨 - 사용자 선택 대기');
          setCameraPermission('requesting'); // 카메라 권한 요청 UI 표시
          return; // 여기서 멈춤 - 사용자가 버튼 클릭할 때까지 대기
        } else {
          console.log('⚠️ WebXR immersive-ar 미지원');
        }
      } else {
        console.log('⚠️ WebXR API 미지원');
        setWebxrSupported(false);
      }
      
      // 3. WebXR 미지원 → 바로 3D 뷰어로 폴백
      console.log('🔄 WebXR 미지원 → 바로 3D 뷰어로 진행');
      setWebxrSupported(false);
      setDebugInfo('WebXR 미지원 - 3D 뷰어로 진행');
      setStatus('fallback');
      initializeDesktop3D(container);
      
    } catch (error) {
      console.warn('❌ WebXR 체크 실패 → 3D 뷰어로 폴백:', error);
      setWebxrSupported(false);
      setStatus('fallback');
      setDebugInfo('WebXR 체크 실패 - 3D 뷰어로 진행');
      initializeDesktop3D(container);
    }
  };

  // 🎯 WebXR AR 초기화 (실제 구현 예정)
  const startWebXRARSession = async () => {
    try {
      console.log('📱 WebXR AR 세션 시작');
      setDebugInfo('WebXR AR 세션 생성 중...');
      
      // TODO: WebXR 세션 생성 및 초기화
      // const session = await navigator.xr.requestSession('immersive-ar', {
      //   requiredFeatures: ['hit-test'],
      //   optionalFeatures: ['anchors', 'dom-overlay']
      // });
      
      // 현재는 임시로 성공 처리 (실제 구현은 다음 단계)
      setStatus('ar-active');
      setDebugInfo('WebXR AR 활성화 완료 (구현 예정)');
      setCameraPermission('granted');
      onLoadComplete?.();
      
      console.log('🎉 WebXR AR 준비 완료 (실제 구현 필요)');
      
    } catch (error) {
      console.error('❌ WebXR AR 초기화 실패:', error);
      setDebugInfo(`WebXR AR 실패: ${(error as Error).message}`);
      
      // AR 실패 시 3D 뷰어로 폴백
      setStatus('fallback');
      if (containerRef.current) {
        initializeDesktop3D(containerRef.current);
      }
    }
  };

  // 🎯 데스크톱: 기본 3D 뷰어 (예전 PC버전 렌더링 방식 적용)
  const initializeDesktop3D = async (container: HTMLDivElement) => {
    try {
      console.log('🖥️ 3D 뷰어 모드 초기화 시작 (개선된 렌더링)');
      setDebugInfo('3D 뷰어 라이브러리 로딩 중...');
      
      // 컨테이너 정리
      container.innerHTML = '';
      
      // 🎯 예전 방식: Scene 생성 (조명 최소화)
      const scene = new THREE.Scene();
      // 배경색을 검은색으로 (예전 방식)
      scene.background = new THREE.Color(0x000000);
      
      // 🎯 예전 방식: Camera 설정
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      scene.add(camera); // 예전 방식: 카메라를 씬에 추가
      
      // 🎯 예전 방식: 카메라 위치 및 회전 설정
      camera.position.set(1, 1, 1);
      camera.setRotationFromEuler(new THREE.Euler(0.2, 1, -0.25));
      
      // 🎯 예전 방식: 최소한의 렌더러 설정
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // 🎯 OrbitControls 추가 (사용성 향상, 예전 설정 적용)
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      
      // 🎯 예전 방식: 확대/축소 제한 완화
      controls.minDistance = 0.1;  // 매우 가까이
      controls.maxDistance = 100;  // 매우 멀리
      controls.maxPolarAngle = Math.PI; // 완전한 회전 허용
      
      // 🎯 예전 방식: 자동 회전 설정 (천천히)
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = rotationSpeed * 5; // 0.002 * 5 = 0.01

      console.log('✅ 3D 씬 초기화 완료 (개선된 방식)');
      setDebugInfo('3D 모델 로딩 중...');

      // 🎯 예전 방식으로 GLB 모델 로딩
      await loadModelOriginalStyle(scene, camera, controls);

      // 성공 상태 설정
      if (status === 'loading') {
        setStatus('fallback'); // 3D 뷰어 모드
      }
      onLoadComplete?.();
      setDebugInfo('3D 뷰어 완료! (개선된 렌더링)');

      // 🎯 예전 방식: 단순한 렌더링 루프
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

  // 🎯 예전 PC버전 방식: 모델 로딩 (개선된 렌더링)
  const loadModelOriginalStyle = async (scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) => {
    try {
      console.log(`🔄 모델 로딩 시작 (개선된 방식):`, modelPath);
      setThreeIcosaStatus('loading');
      
      const loader = new GLTFLoader();
      let threeIcosaLoaded = false;
      
      // 🎯 예전 방식: Three-Icosa 확장자 등록
      try {
        setDebugInfo('Three-Icosa 브러시 확장 로딩 중...');
        
        // @ts-ignore - three-icosa 모듈 로딩
        const threeIcosaModule = await import('three-icosa');
        const { GLTFGoogleTiltBrushMaterialExtension } = threeIcosaModule;
        
        if (GLTFGoogleTiltBrushMaterialExtension) {
          // 🎯 예전 방식: 원본 브러시 경로 사용
          const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
          loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
          
          console.log(`✅ Three-Icosa 확장자 등록 완료 (원본 경로)`);
          setThreeIcosaStatus('success');
          threeIcosaLoaded = true;
          setDebugInfo('Three-Icosa 브러시 로드 완료!');
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
          (gltf) => {
            console.log(`🎉 모델 로딩 성공! (개선된 방식)`);
            
            // 🎯 예전 방식: model.scene을 직접 추가
            scene.add(gltf.scene);
            
            // 🎯 예전 방식: 모델 크기에 따라 카메라 타겟 조정
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // 모델 중심점으로 OrbitControls 타겟 설정
            controls.target.copy(center);
            
            // 🎯 예전 방식: 모델이 더 크게 보이도록 카메라 거리 조정
            const maxDimension = Math.max(size.x, size.y, size.z);
            const distance = maxDimension * 0.5; // 예전 코드와 동일한 비율
            
            // 🎯 예전 방식: 카메라 위치를 모델 크기에 맞게 조정 (원본 비율 유지)
            const originalDistance = Math.sqrt(1*1 + 1*1 + 1*1); // 원본 (1,1,1)의 거리
            const scale = distance / originalDistance;
            
            camera.position.set(
              1 * scale + center.x,
              1 * scale + center.y, 
              1 * scale + center.z
            );
            
            controls.update();
            
            console.log('✅ 모델이 씬에 추가됨 (개선된 방식)');
            console.log('📊 모델 중심:', center);
            console.log('📊 모델 크기:', size);
            console.log('📊 카메라 위치:', camera.position);
            setDebugInfo(`모델 로딩 완료! ${threeIcosaLoaded ? '(Tilt Brush 브러시 포함)' : '(기본 모드)'}`);
            resolve(gltf);
          },
          (progress) => {
            if (progress.total > 0) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              setDebugInfo(`모델 로딩 중... ${percent}%`);
            }
          },
          (loadError) => {
            console.error(`❌ 모델 로딩 실패:`, loadError);
            const errorMessage = loadError instanceof Error ? loadError.message : 'Unknown error';
            setDebugInfo(`모델 로딩 실패: ${errorMessage}`);
            reject(loadError);
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
        style={{ backgroundColor: status === 'ar-active' ? 'transparent' : '#000000' }} // 예전 방식: 검은 배경
      />
      
      {/* 🎯 WebXR 지원 + 모바일 → 카메라 권한 선택 UI */}
      {deviceType === 'mobile' && 
       webxrSupported && 
       cameraPermission === 'requesting' && 
       status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6 max-w-sm">
            <div className="text-6xl mb-4">📱✨</div>
            <p className="text-lg font-medium mb-2">WebXR AR 지원 기기입니다!</p>
            <p className="text-sm opacity-75 mb-4">바닥 인식 AR 기능을 사용하시겠습니까?</p>
            
            <div className="space-y-3 mb-4">
              <button
                onClick={async () => {
                  try {
                    const granted = await requestCameraPermission();
                    if (granted) {
                      await startWebXRARSession();
                    }
                  } catch {
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
      
      {/* 🎯 WebXR 미지원 + 모바일 → 3D 뷰어 로딩 */}
      {deviceType === 'mobile' && 
       !webxrSupported && 
       status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">3D 뷰어 로딩 중...</p>
            <p className="text-sm opacity-50 mt-2">AR 미지원 기기 - 3D 모드로 진행</p>
            <p className="text-xs opacity-40 mt-1">{debugInfo}</p>
          </div>
        </div>
      )}
      
      {/* 🎯 데스크톱 → 기존과 동일 */}
      {deviceType === 'desktop' && status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">3D 뷰어 로딩 중...</p>
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
            (deviceType === 'mobile') ? 
              (webxrSupported ? '모바일 3D 모드 (사용자 선택)' : '모바일 3D 모드 (AR 미지원)') : 
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
              <div className="text-xs text-green-400">🎯 개선된 렌더링 적용</div>
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
              <div>🎯 작업지시서 분기 로직 적용 | 🚀 WebXR 지원 기기만 카메라 권한 요청</div>
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
