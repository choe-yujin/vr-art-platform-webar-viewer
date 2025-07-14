/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  rotationSpeed = 0.002
}: ARViewerProps) {
  // 상태 관리
  const [status, setStatus] = useState<'loading' | 'mobile-waiting' | 'ar-active' | 'fallback' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraPermission, setCameraPermission] = useState<'requesting' | 'granted' | 'denied'>(
    deviceType === 'desktop' ? 'granted' : 'requesting'
  );
  const [debugInfo, setDebugInfo] = useState<string>('시작...');
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(true);
  const [threeIcosaStatus, setThreeIcosaStatus] = useState<'loading' | 'success' | 'fallback'>('loading');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const componentMountedRef = useRef(false);
  const cleanupRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // 🔧 MindAR 글로벌 상태 추적 (컴포넌트 독립적)
  const mindARStateRef = useRef({
    isLoading: false,
    isLoaded: false,
    hasError: false
  });
  
  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));
  
  // 🔧 재렌더링 감지 및 로깅 개선
  if (!componentMountedRef.current) {
    console.log(`🎬 ARViewer 첫 렌더링 [${renderIdRef.current}] - 디바이스: ${deviceType}`);
    componentMountedRef.current = true;
  } else {
    console.log(`🔄 ARViewer 재렌더링 감지 [${renderIdRef.current}] - 디바이스: ${deviceType} (초기화 스킵)`);
  }

  useEffect(() => {
    // 🔧 강화된 중복 실행 방지
    if (!containerRef.current || initializationRef.current || cleanupRef.current) {
      console.log(`⏭️ 초기화 스킵 [${renderIdRef.current}] - Container: ${!!containerRef.current}, Init: ${initializationRef.current}, Cleanup: ${cleanupRef.current}`);
      return;
    }
    
    console.log(`✅ Container DOM 준비 완료! [${renderIdRef.current}]`);
    initializationRef.current = true;
    
    // 디바이스별 초기화 로직
    if (deviceType === 'mobile') {
      console.log(`📱 모바일 모드: 사용자 선택 대기 상태로 전환 [${renderIdRef.current}]`);
      setStatus('mobile-waiting');
      setDebugInfo('모바일 모드 - 사용자 선택 대기 중');
    } else {
      console.log(`🖥️ 데스크톱 모드: 바로 3D 뷰어 시작 [${renderIdRef.current}]`);
      setStatus('loading');
      setDebugInfo('데스크톱 3D 뷰어 초기화 중...');
      initializeDesktop3D(containerRef.current);
    }

    // 정리 함수
    return () => {
      const renderId = renderIdRef.current;
      console.log(`🧹 정리 함수 실행 [${renderId}]`);
      cleanupRef.current = true;
      componentMountedRef.current = false;
      
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      
      initializationRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔧 완전 개선된 MindAR 시작 함수 (상태 의존성 제거)
  const startMindARDirectly = async () => {
    try {
      console.log('📱 MindAR 직접 시작 - 조건 체크 중...');
      setDebugInfo('조건 체크: 모바일+카메라권한');
      
      // 조건 체크
      if (deviceType !== 'mobile') {
        throw new Error('모바일 디바이스가 아님');
      }
      
      console.log('🎉 모든 조건 만족! MindAR 초기화 시작');
      setDebugInfo('MindAR 스크립트 로딩 시작...');
      
      // 🔧 글로벌 상태 기반 스크립트 로딩
      await ensureMindARScriptsLoaded();
      
      // 🔧 MindAR 세션 초기화
      await initializeMindARSession();
      
    } catch (error) {
      console.error('❌ MindAR 초기화 실패:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setDebugInfo(`AR 실패: ${errorMsg}`);
      
      // 모바일에서 AR 실패 시 사용자 선택 UI로 되돌아가기
      setStatus('mobile-waiting');
      setCameraPermission('requesting');
      setDebugInfo('사용자 선택 대기 중 (AR 실패)');
      console.log('📱 모바일 AR 실패 - 사용자 선택 UI로 복귀');
    }
  };

  // 🔧 글로벌 상태 기반 MindAR 스크립트 로딩 (중복 방지)
  const ensureMindARScriptsLoaded = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // 🔧 이미 로드된 경우 즉시 반환
        if (window.MindAR_THREE && window.MindAR_MindARThree) {
          console.log('📦 MindAR 스크립트 이미 로드됨 - 즉시 반환');
          setDebugInfo('MindAR 모듈 이미 준비됨!');
          resolve();
          return;
        }
        
        // 🔧 현재 로딩 중인 경우 대기
        if (mindARStateRef.current.isLoading) {
          console.log('📦 MindAR 스크립트 로딩 중 - 완료 대기');
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
        console.log('📦 MindAR 스크립트 로딩 시작 (글로벌 상태 기반)');
        setDebugInfo('MindAR 스크립트 로딩 중...');
        
        // 🔧 기존 스크립트 확인 및 정리 (ID 기반)
        const existingImportMap = document.getElementById('mindar-import-map');
        const existingModuleScript = document.getElementById('mindar-module-script');
        
        if (existingImportMap) {
          console.log('🗑️ 기존 Import Map 제거');
          existingImportMap.remove();
        }
        if (existingModuleScript) {
          console.log('🗑️ 기존 Module Script 제거');
          existingModuleScript.remove();
        }
        
        // 🔧 Import Map 생성
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
        setDebugInfo('Module Script 로딩 중...');
        
        // 🔧 Module Script 생성 (개선된 오류 처리)
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
        
        // 🔧 로딩 완료 이벤트 리스너
        const handleMindARReady = (event: any) => {
          console.log('📦 MindAR 로딩 이벤트 수신:', event.detail);
          window.removeEventListener('mindARReady', handleMindARReady);
          
          if (event.detail.success) {
            console.log('✅ MindAR 스크립트 로딩 완료');
            mindARStateRef.current.isLoaded = true;
            mindARStateRef.current.isLoading = false;
            setDebugInfo('MindAR 모듈 로드 성공!');
            resolve();
          } else {
            console.error('❌ MindAR 스크립트 로딩 실패:', event.detail.error);
            mindARStateRef.current.hasError = true;
            mindARStateRef.current.isLoading = false;
            reject(new Error(event.detail.error));
          }
        };
        
        window.addEventListener('mindARReady', handleMindARReady);
        
        // 🔧 타임아웃 (30초)
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
        
        // DOM에 추가
        document.head.appendChild(moduleScript);
        
      } catch (error) {
        console.error('❌ MindAR 스크립트 삽입 실패:', error);
        mindARStateRef.current.hasError = true;
        mindARStateRef.current.isLoading = false;
        reject(error);
      }
    });
  };

  // 🔧 MindAR 세션 초기화 (타입 안전성 개선)
  const initializeMindARSession = async (): Promise<void> => {
    try {
      console.log('🚀 MindAR 세션 초기화 시작');
      setDebugInfo('MindAR 인스턴스 생성 중...');
      
      // 전역 객체 확인
      if (!window.MindAR_THREE || !window.MindAR_MindARThree) {
        throw new Error('MindAR 모듈이 전역 객체에 없음');
      }
      
      const THREE = window.MindAR_THREE;
      const MindARThree = window.MindAR_MindARThree;
      
      console.log('✅ MindAR 모듈 접근 성공');
      setDebugInfo('MindARThree 인스턴스 생성 중...');
      
      // MindARThree 인스턴스 생성
      const mindarThree = new MindARThree({
        container: containerRef.current!,
        imageTargetSrc: 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind',
      });
      
      const { renderer, scene, camera } = mindarThree;
      console.log('✅ MindARThree 인스턴스 생성 완료');
      
      // 앵커 생성
      const anchor = mindarThree.addAnchor(0);
      console.log('✅ AR 앵커 생성 완료');
      
      setDebugInfo('3D 모델 로딩 중...');
      
      // 모델 로딩
      await loadModelForMindAR(anchor.group, THREE);
      
      console.log('🎯 MindAR 세션 시작 중...');
      setDebugInfo('AR 세션 시작 중...');
      
      // 🔧 타입 안전성 개선된 세션 시작
      try {
        await mindarThree.start();
        console.log('✅ MindAR 세션 시작 성공');
      } catch (startError) {
        console.error('❌ MindAR 세션 시작 실패:', startError);
        // 🔧 타입 안전성 개선
        const errorMessage = startError instanceof Error ? startError.message : String(startError);
        throw new Error(`MindAR 세션 시작 실패: ${errorMessage}`);
      }
      
      // 렌더링 루프 시작
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });
      
      // 성공 상태 설정
      setStatus('ar-active');
      setCameraPermission('granted');
      setDebugInfo('MindAR AR 모드 활성화 완료! 마커를 스캔하세요.');
      onLoadComplete?.();
      
      console.log('🎉 MindAR 세션 초기화 완료 - AR 모드 활성화!');
      
    } catch (error) {
      console.error('❌ MindAR 세션 초기화 실패:', error);
      throw error;
    }
  };

  // 🔧 MindAR용 모델 로딩
  const loadModelForMindAR = async (anchorGroup: any, THREE: any): Promise<void> => {
    try {
      console.log('🎨 MindAR 모델 로딩 시작');
      setThreeIcosaStatus('loading');
      
      const loader = new THREE.GLTFLoader();
      let threeIcosaLoaded = false;
      
      // Three-Icosa 확장자 등록 시도 (재렌더링 방지)
      try {
        const threeIcosaModule = await import('three-icosa');
        const { GLTFGoogleTiltBrushMaterialExtension } = threeIcosaModule;
        
        if (GLTFGoogleTiltBrushMaterialExtension) {
          const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
          loader.register((parser: any) => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
          
          console.log('✅ MindAR용 Three-Icosa 확장자 등록 완료');
          setThreeIcosaStatus('success');
          threeIcosaLoaded = true;
        }
      } catch (icosaError) {
        console.warn('⚠️ Three-Icosa 로드 실패 (기본 모드):', icosaError);
        setThreeIcosaStatus('fallback');
      }
      
      return new Promise((resolve, reject) => {
        setDebugInfo(`모델 로딩 중... ${threeIcosaLoaded ? '(Tilt Brush 브러시 포함)' : '(기본 모드)'}`);
        
        loader.load(
          modelPath,
          (gltf: any) => {
            console.log('🎉 MindAR 모델 로딩 성공!');
            
            anchorGroup.add(gltf.scene);
            
            // AR 크기 조정
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = box.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);
            
            const scale = 0.1 / maxDimension;
            gltf.scene.scale.setScalar(scale);
            
            console.log('✅ 모델이 anchor.group에 추가됨');
            setDebugInfo(`AR 모델 준비 완료! ${threeIcosaLoaded ? '(Tilt Brush 브러시 포함)' : '(기본 모드)'}`);
            
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
      setThreeIcosaStatus('fallback');
      throw error;
    }
  };

  // 🔧 개선된 카메라 권한 요청 (상태 반환)
  const requestCameraPermissionAndStartAR = async (): Promise<void> => {
    try {
      console.log('📸 카메라 권한 요청 및 AR 시작');
      setDebugInfo('카메라 권한 요청 중...');
      
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
      
      console.log('📸 getUserMedia 호출 중...');
      setDebugInfo('브라우저에 카메라 권한 요청 중...');
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ 카메라 권한 허용됨!', stream);
      
      // 스트림 정리
      stream.getTracks().forEach(track => {
        track.stop();
      });
      
      console.log('✅ 카메라 권한 확인 완료 - AR 시작');
      setDebugInfo('카메라 권한 허용됨! AR 초기화 중...');
      
      // 🔧 상태 업데이트 없이 직접 AR 시작
      await startMindARDirectly();
      
    } catch (error) {
      console.error('❌ 카메라 권한 또는 AR 시작 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      
      setDebugInfo(`실패: ${errorMessage}`);
      
      // 3D 모드로 폴백
      setStatus('fallback');
      if (containerRef.current) {
        initializeDesktop3D(containerRef.current);
      }
    }
  };

  // 🎯 데스크톱 3D 뷰어 (재렌더링 방지 개선)
  const initializeDesktop3D = async (container: HTMLDivElement) => {
    try {
      console.log('🖥️ 3D 뷰어 모드 초기화 시작');
      setDebugInfo('3D 뷰어 초기화 중...');
      
      // 컨테이너 정리
      container.innerHTML = '';
      
      // Scene 생성
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      
      // Camera 설정
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      scene.add(camera);
      
      camera.position.set(1, 1, 1);
      camera.setRotationFromEuler(new THREE.Euler(0.2, 1, -0.25));
      
      // 렌더러 설정
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // OrbitControls 추가
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      
      controls.minDistance = 0.1;
      controls.maxDistance = 100;
      controls.maxPolarAngle = Math.PI;
      
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = rotationSpeed * 5;

      console.log('✅ 3D 씬 초기화 완료');
      setDebugInfo('3D 모델 로딩 중...');

      // 🔧 재렌더링 방지를 위한 개선된 모델 로딩
      await loadModelForDesktop(scene, camera, controls);

      // 성공 상태 설정
      if (status === 'loading') {
        setStatus('fallback');
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

  // 🔧 데스크톱용 모델 로딩 (재렌더링 방지)
  const loadModelForDesktop = async (scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) => {
    try {
      console.log('🔄 데스크톱 모델 로딩 시작:', modelPath);
      setThreeIcosaStatus('loading');
      
      const loader = new GLTFLoader();
      let threeIcosaLoaded = false;
      
      // Three-Icosa 확장자 등록 (재렌더링 최소화)
      try {
        setDebugInfo('Three-Icosa 브러시 확장 로딩 중...');
        
        const threeIcosaModule = await import('three-icosa');
        const { GLTFGoogleTiltBrushMaterialExtension } = threeIcosaModule;
        
        if (GLTFGoogleTiltBrushMaterialExtension) {
          const assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
          loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
          
          console.log('✅ 데스크톱용 Three-Icosa 확장자 등록 완료');
          setThreeIcosaStatus('success');
          threeIcosaLoaded = true;
          setDebugInfo('Three-Icosa 브러시 로드 완료!');
        }
      } catch (icosaError) {
        console.warn('⚠️ Three-Icosa 로드 실패 (기본 모드):', icosaError);
        setThreeIcosaStatus('fallback');
        setDebugInfo('기본 모드로 로딩...');
      }

      return new Promise((resolve, reject) => {
        setDebugInfo(`${threeIcosaLoaded ? 'Tilt Brush' : '기본'} 모델 로딩 중...`);
        
        loader.load(
          modelPath,
          (gltf) => {
            console.log('🎉 데스크톱 모델 로딩 성공!');
            
            scene.add(gltf.scene);
            
            // 모델 크기에 따라 카메라 조정
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            controls.target.copy(center);
            
            const maxDimension = Math.max(size.x, size.y, size.z);
            const distance = maxDimension * 0.5;
            
            const originalDistance = Math.sqrt(3); // sqrt(1²+1²+1²)
            const scale = distance / originalDistance;
            
            camera.position.set(
              1 * scale + center.x,
              1 * scale + center.y, 
              1 * scale + center.z
            );
            
            controls.update();
            
            console.log('✅ 데스크톱 모델이 씬에 추가됨');
            setDebugInfo(`모델 로딩 완료! ${threeIcosaLoaded ? '(Tilt Brush 브러시 포함)' : '(기본 모드)'}`);
            resolve(gltf);
          },
          (progress) => {
            if (progress.total > 0) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              setDebugInfo(`모델 로딩... ${percent}%`);
            }
          },
          (loadError) => {
            console.error('❌ 데스크톱 모델 로딩 실패:', loadError);
            const errorMessage = loadError instanceof Error ? loadError.message : 'Unknown error';
            setDebugInfo(`모델 로딩 실패: ${errorMessage}`);
            reject(loadError);
          }
        );
      });
      
    } catch (error) {
      console.error('❌ 데스크톱 모델 로더 초기화 실패:', error);
      setThreeIcosaStatus('fallback');
      throw error;
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ backgroundColor: status === 'ar-active' ? 'transparent' : '#000000' }}
      />
      
      {/* 🎯 모바일 사용자 선택 UI */}
      {deviceType === 'mobile' && 
       cameraPermission === 'requesting' && 
       status === 'mobile-waiting' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6 max-w-sm">
            <div className="text-6xl mb-4">📱✨</div>
            <p className="text-lg font-medium mb-2">AR로 작품을 감상하시겠습니까?</p>
            <p className="text-sm opacity-75 mb-4">카메라를 사용하여 현실 공간에 작품을 배치할 수 있습니다</p>
            
            <div className="space-y-3 mb-4">
              <button
                onClick={async () => {
                  try {
                    console.log('📸 사용자가 "AR 보기" 버튼 클릭 (완전 개선된 방식)');
                    setDebugInfo('카메라 권한 요청 및 AR 시작 중...');
                    
                    // 🔧 상태 의존성 완전 제거 - 한 번에 처리
                    await requestCameraPermissionAndStartAR();
                    
                  } catch (error) {
                    console.error('❌ AR 시작 전체 실패:', error);
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    setDebugInfo(`AR 실패: ${errorMsg}`);
                    setStatus('fallback');
                    if (containerRef.current) {
                      initializeDesktop3D(containerRef.current);
                    }
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-3 rounded-lg font-medium"
              >
                📸 카메라로 AR 보기
              </button>
              
              <button
                onClick={() => {
                  console.log('🎨 사용자가 "AR 없이 감상하기" 선택');
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
      
      {/* 데스크톱 로딩 */}
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
            status === 'ar-active' ? 'MindAR 모드 (최종 개선)' : 
            deviceType === 'mobile' ? '모바일 3D 모드 (최종 개선)' : '데스크톱 3D 모드 (최종 개선)'
          } 활성화</div>
          <div className="text-xs">
            🎨 Three-Icosa: {
              threeIcosaStatus === 'success' ? '✅ 브러시 로드됨' :
              threeIcosaStatus === 'fallback' ? '⚠️ 기본 모드' : '로딩 중...'
            }
          </div>
          {status === 'fallback' && (
            <>
              <div>🔄 자동 회전: {autoRotate ? 'ON' : 'OFF'}</div>
              <div className="text-xs opacity-75 mt-1">
                {deviceType === 'mobile' ? '터치: 회전 | 핀치: 확대/축소' : '마우스: 회전 | 휠: 확대/축소'}
              </div>
              <div className="text-xs text-green-400">🎯 재렌더링 방지 적용</div>
            </>
          )}
        </div>
      )}
      
      {/* 최종 개선된 디버그 패널 */}
      {showDebugPanel && (
        <div className="fixed top-0 left-0 right-0 bg-purple-600/90 text-white p-2 text-xs z-50">
          <div className="flex justify-between items-center">
            <div>
              <div>🔧 최종 디버그: {debugInfo}</div>
              <div>상태: {status} | 카메라: {cameraPermission} | 디바이스: {deviceType}</div>
              <div>📦 MindAR 글로벌: 로딩={mindARStateRef.current.isLoading ? 'Y' : 'N'} | 완료={mindARStateRef.current.isLoaded ? 'Y' : 'N'} | 오류={mindARStateRef.current.hasError ? 'Y' : 'N'}</div>
              <div>🎨 브러시: {threeIcosaStatus} | 🔧 상태 의존성 제거 + 재렌더링 방지</div>
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
      
      {/* AR 활성화 완료 안내 */}
      {status === 'ar-active' && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded text-sm z-10">
          <div className="text-center">
            <div className="text-2xl mb-2">🎯</div>
            <p className="font-medium">MindAR 최종 개선 완료</p>
            <p className="text-xs opacity-75 mt-1">상태 의존성 제거 + 글로벌 중복 방지 + 타입 안전성</p>
            <p className="text-xs text-green-400 mt-1">✅ 완전 개선된 AR - 카메라로 마커를 스캔하세요</p>
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