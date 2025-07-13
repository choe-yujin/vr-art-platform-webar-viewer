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
  // 단순화된 상태 관리
  const [status, setStatus] = useState<'loading' | 'ar-active' | 'fallback' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraPermission, setCameraPermission] = useState<'requesting' | 'granted' | 'denied'>('requesting');
  const [debugInfo, setDebugInfo] = useState<string>('시작...');
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(true);
  const [threeIcosaStatus, setThreeIcosaStatus] = useState<'loading' | 'success' | 'fallback'>('loading');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  console.log('🎬 ARViewer 렌더링 시작 - 디바이스:', deviceType);

  useEffect(() => {
    if (!containerRef.current || initializationRef.current) return;
    
    console.log('✅ Container DOM 준비 완료!');
    initializationRef.current = true;
    
    // 🎯 단순한 디바이스별 분기
    if (deviceType === 'mobile') {
      // 모바일: 카메라 권한 요청 UI 표시 (사용자 선택 대기)
      console.log('📱 모바일 모드: 카메라 권한 선택 UI 표시');
      setDebugInfo('모바일 모드 - 사용자 선택 대기');
      setCameraPermission('requesting'); // 카메라 권한 선택 UI 표시
    } else {
      // 데스크톱: 바로 3D 뷰어
      console.log('🖥️ 데스크톱 모드: 바로 3D 뷰어 시작');
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🎯 MindAR CDN 스크립트 동적 삽입 (조건 철저히 체크 후 실행)
  const startMindAR = async () => {
    try {
      console.log('📱 MindAR 시작 - 조건 체크 중...');
      setDebugInfo('조건 체크 중: 모바일+AR선택+권한허용');
      
      // 🔍 조건 1: 모바일 디바이스 체크
      if (deviceType !== 'mobile') {
        console.log('❌ 조건 체크 실패: 모바일 디바이스가 아님');
        setDebugInfo('모바일 디바이스가 아니어서 AR 사용 불가');
        throw new Error('모바일 디바이스가 아님');
      }
      console.log('✅ 조건 1: 모바일 디바이스 확인');
      
      // 🔍 조건 2: AR 선택 (사용자가 "카메라로 AR 보기" 버튼 클릭)
      console.log('✅ 조건 2: 사용자가 AR 모드 선택함');
      setDebugInfo('조건 체크 중: 카메라 권한 확인...');
      
      // 🔍 조건 3: 카메라 권한 허용 체크
      if (cameraPermission !== 'granted') {
        console.log('❌ 조건 체크 실패: 카메라 권한이 허용되지 않음');
        setDebugInfo(`카메라 권한 상태: ${cameraPermission} - AR 사용 불가`);
        throw new Error('카메라 권한이 허용되지 않음');
      }
      console.log('✅ 조건 3: 카메라 권한 허용됨');
      
      // 🎉 모든 조건 만족! MindAR 스크립트 로딩 시작
      console.log('🎉 모든 조건 만족! 모바일+AR선택+권한허용 완료');
      setDebugInfo('조건 체크 완료! MindAR 스크립트 로딩 시작...');
      
      // 1단계: 조건부 스크립트 삽입 실행
      await loadMindARScripts();
      
      // 2단계: 실제 MindAR 초기화 및 AR 세션 시작
      await initializeMindARSession();
      
    } catch (error) {
      console.error('❌ MindAR 초기화 실패:', error);
      setDebugInfo(`실패: ${(error as Error).message}`);
      
      // 조건 불만족 또는 AR 실패 시 3D 뷰어로 폴백
      setStatus('fallback');
      if (containerRef.current) {
        initializeDesktop3D(containerRef.current);
      }
    }
  };

  // 🎯 2단계: 실제 MindAR 초기화 및 AR 세션 시작
  const initializeMindARSession = async (): Promise<void> => {
    try {
      console.log('🚀 MindAR 세션 초기화 시작');
      setDebugInfo('MindAR 인스턴스 생성 중...');
      
      // window 전역 객체에서 MindAR 모듈 가져오기 (타입 안전)
      const THREE = window.MindAR_THREE;
      const MindARThree = window.MindAR_MindARThree;
      
      if (!THREE || !MindARThree) {
        throw new Error('MindAR 모듈이 로드되지 않음');
      }
      
      console.log('✅ MindAR 모듈 접근 성공');
      setDebugInfo('MindARThree 인스턴스 생성 중...');
      
      // MindARThree 인스턴스 생성
      const mindarThree = new MindARThree({
        container: containerRef.current!,
        imageTargetSrc: '/markers/qr-marker.mind',
      });
      
      const { renderer, scene, camera } = mindarThree;
      console.log('✅ MindARThree 인스턴스 생성 완료');
      
      // 앵커 생성 (마커 0번)
      const anchor = mindarThree.addAnchor(0);
      console.log('✅ AR 앵커 생성 완료');
      
      setDebugInfo('3D 모델 로딩 중 (Three-Icosa 브러시 포함)...');
      
      // GLTFLoader에 three-icosa 확장자 등록 및 모델 로딩
      await loadModelForMindAR(anchor.group, THREE);
      
      console.log('🎯 MindAR 세션 시작 중...');
      setDebugInfo('AR 세션 시작 중 (카메라 배경 활성화)...');
      
      // MindAR 세션 시작 (카메라 배경 자동 처리)
      await mindarThree.start();
      
      // 렌더링 루프 시작 (마커 인식 시 3D 모델이 카메라 위에 오버레이)
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });
      
      // 성공 상태 설정
      setStatus('ar-active');
      setCameraPermission('granted');
      setDebugInfo('MindAR AR 모드 활성화 완료! 마커를 스캔하세요.');
      onLoadComplete?.();
      
      console.log('🎉 MindAR 세션 초기화 완룼 - AR 모드 활성화!');
      
    } catch (error) {
      console.error('❌ MindAR 세션 초기화 실패:', error);
      throw error;
    }
  };

  // 🎯 MindAR용 모델 로딩 (Three-Icosa 브러시 포함)
  const loadModelForMindAR = async (anchorGroup: any, THREE: any): Promise<void> => {
    try {
      console.log('🎨 MindAR 모델 로딩 시작 (Three-Icosa 브러시 포함)');
      setThreeIcosaStatus('loading');
      
      const loader = new THREE.GLTFLoader();
      let threeIcosaLoaded = false;
      
      // Three-Icosa 확장자 등록 시도
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
        setDebugInfo(`sample.glb 로딩 중... ${threeIcosaLoaded ? '(Tilt Brush 브러시 포함)' : '(기본 모드)'}`);
        
        loader.load(
          modelPath, // sample.glb
          (gltf: any) => {
            console.log('🎉 MindAR 모델 로딩 성공!');
            
            // anchor.group에 모델 추가
            anchorGroup.add(gltf.scene);
            
            // AR에서 적절한 모델 크기 조정
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = box.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);
            
            // AR에서는 실제 크기의 10% 정도로 축소
            const scale = 0.1 / maxDimension;
            gltf.scene.scale.setScalar(scale);
            
            console.log('✅ 모델이 anchor.group에 추가됨 (크기 조정 완료)');
            setDebugInfo(`AR 모델 준비 완료! ${threeIcosaLoaded ? '(Tilt Brush 브러시 포함)' : '(기본 모드)'}`);
            
            resolve();
          },
          (progress: any) => {
            if (progress.total > 0) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              setDebugInfo(`sample.glb 로딩... ${percent}%`);
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

  // 🎯 MindAR 공식 문서 방식: Import Map + Module Script 동적 삽입
  const loadMindARScripts = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        console.log('📦 MindAR 공식 방식: Import Map + Module Script 삽입 시작');
        setDebugInfo('Import Map 설정 중...');
        
        // 1. Import Map 동적 생성 (공식 문서 방식)
        const importMap = document.createElement('script');
        importMap.type = 'importmap';
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
        
        // 2. Module Script 동적 생성 (공식 문서 방식)
        const moduleScript = document.createElement('script');
        moduleScript.type = 'module';
        moduleScript.textContent = `
          // MindAR 모듈 import (공식 방식)
          import * as THREE from 'three';
          import { MindARThree } from 'mindar-image-three';
          
          // 전역 객체에 할당하여 React에서 접근 가능하게 함
          window.MindAR_THREE = THREE;
          window.MindAR_MindARThree = MindARThree;
          
          // 로딩 완료 이벤트 발생
          window.dispatchEvent(new CustomEvent('mindARModulesLoaded'));
          
          console.log('✅ MindAR 모듈 로드 완료 (공식 Import Map 방식)');
        `;
        
        // 3. 로딩 완료 이벤트 리스너 등록
        const handleModulesLoaded = () => {
          console.log('✅ 모든 MindAR 모듈 로딩 완료 (공식 방식)');
          setDebugInfo('MindAR 모듈 로드 성공!');
          window.removeEventListener('mindARModulesLoaded', handleModulesLoaded);
          resolve();
        };
        
        window.addEventListener('mindARModulesLoaded', handleModulesLoaded);
        
        // 4. 에러 처리
        moduleScript.onerror = () => {
          console.error('❌ Module Script 로드 실패');
          window.removeEventListener('mindARModulesLoaded', handleModulesLoaded);
          reject(new Error('Module Script 로드 실패'));
        };
        
        // 5. DOM에 Module Script 추가
        document.head.appendChild(moduleScript);
        
        console.log('📦 Import Map + Module Script 삽입 완료 - 로딩 대기 중...');
        
      } catch (error) {
        console.error('❌ Import Map 방식 스크립트 삽입 실패:', error);
        reject(error);
      }
    });
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
        style={{ backgroundColor: status === 'ar-active' ? 'transparent' : '#000000' }}
      />
      
      {/* 🎯 모바일 → 카메라 권한 선택 UI (단순화) */}
      {deviceType === 'mobile' && 
       cameraPermission === 'requesting' && 
       status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/90 z-20">
          <div className="text-center p-6 max-w-sm">
            <div className="text-6xl mb-4">📱✨</div>
            <p className="text-lg font-medium mb-2">AR로 작품을 감상하시겠습니까?</p>
            <p className="text-sm opacity-75 mb-4">카메라를 사용하여 현실 공간에 작품을 배치할 수 있습니다</p>
            
            <div className="space-y-3 mb-4">
              <button
                onClick={async () => {
                  try {
                    const granted = await requestCameraPermission();
                    if (granted) {
                      await startMindAR();
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
                📸 카메라로 AR 보기
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
            status === 'ar-active' ? 'MindAR 모드' : 
            deviceType === 'mobile' ? '모바일 3D 모드' : '데스크톱 3D 모드'
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
              <div>🗑️ WebXR 제거 완료 | 🎯 MindAR 준비 중 | 브러시: {threeIcosaStatus}</div>
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
      
      {/* 공식 Import Map 방식 로딩 완료 안내 */}
      {status === 'ar-active' && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded text-sm z-10">
          <div className="text-center">
            <div className="text-2xl mb-2">📦</div>
            <p className="font-medium">MindAR 공식 Import Map 로딩 완료</p>
            <p className="text-xs opacity-75 mt-1">window.MindAR_THREE, window.MindAR_MindARThree 사용 준비됨</p>
            <p className="text-xs text-green-400 mt-1">✅ 공식 방식 완료 - 다음: AR 초기화</p>
          </div>
        </div>
      )}
    </div>
  );
}
