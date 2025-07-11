'use client';

import { useCallback, useRef, useState } from 'react';

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
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const initializationRef = useRef(false);
  
  console.log('🎬 원본 스타일 ARViewer 렌더링 시작');

  const containerRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node || initializationRef.current) return;
    
    console.log('✅ Container DOM 준비 완료!');
    initializationRef.current = true;
    initializeViewer(node);
  }, [modelPath, deviceType, autoRotate, rotationSpeed]);

  const initializeViewer = async (container: HTMLDivElement) => {
    try {
      console.log('🎯 원본 스타일 3D 뷰어 초기화 시작');
      
      // 🎯 원본과 동일한 imports
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      
      console.log('✅ Three.js 로딩 완료:', THREE.REVISION);

      // 🎯 원본과 동일한 Scene 생성 (조명 없이 시작)
      const scene = new THREE.Scene();
      
      // 🎯 원본과 동일한 Camera 설정
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      scene.add(camera);
      
      // 🎯 원본과 동일한 카메라 위치 및 회전
      camera.position.set(1, 1, 1);
      camera.setRotationFromEuler(new THREE.Euler(0.2, 1, -0.25));
      
      // 🎯 원본과 동일한 Renderer 설정 (최소한의 옵션)
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(window.innerWidth, window.innerHeight);
      container.appendChild(renderer.domElement);

      console.log('✅ 원본 스타일 씬 초기화 완료');

      // 🎯 OrbitControls 추가 (원본에는 없지만 사용성을 위해)
      const controls = new OrbitControls(camera, renderer.domElement);
      
      // 원본 스타일 유지를 위해 제한 최소화
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      
      // 🎯 확대/축소 제한 완화 (원본에는 제한 없음)
      controls.minDistance = 0.1;  // 매우 가까이
      controls.maxDistance = 100;  // 매우 멀리
      controls.maxPolarAngle = Math.PI; // 완전한 회전 허용
      
      // 🎯 자동 회전 설정 (아주 천천히)
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = rotationSpeed * 5; // 더욱 천천히 (10 → 5)

      // GLB 모델 로딩 (원본 방식)
      await loadGLTFModelOriginalStyle(scene, camera, renderer, controls, THREE);

      setStatus('success');
      onLoadComplete?.();

      // 🎯 원본과 동일한 단순한 렌더링 루프
      startOriginalRenderLoop(scene, camera, renderer, controls);

      // 리사이즈 핸들러
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);

    } catch (error) {
      console.error('❌ 뷰어 초기화 실패:', error);
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      setErrorMessage(errorMsg);
      setStatus('error');
      onLoadError?.(errorMsg);
    }
  };

  // 🎯 원본 스타일 GLB 모델 로딩
  const loadGLTFModelOriginalStyle = async (
    scene: any, 
    camera: any, 
    renderer: any, 
    controls: any,
    THREE: any
  ) => {
    try {
      console.log('🔄 원본 스타일 GLB 모델 로딩 시작:', modelPath);

      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltfLoader = new GLTFLoader();

      // 🎯 원본과 동일한 three-icosa 등록
      try {
        console.log('🔄 three-icosa 확장자 로딩...');
        const threeIcosaModule = await import('three-icosa');
        const { GLTFGoogleTiltBrushMaterialExtension } = threeIcosaModule;
        
        if (GLTFGoogleTiltBrushMaterialExtension) {
          // 🎯 원본과 동일한 브러시 경로
          let assetUrl = 'https://icosa-foundation.github.io/icosa-sketch-assets/brushes/';
          gltfLoader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
          console.log('✅ 원본 스타일 three-icosa 확장자 등록 완료');
        }
      } catch (icosaError) {
        console.warn('⚠️ three-icosa 로드 실패, 기본 GLTFLoader 사용:', icosaError);
      }

      // 🎯 원본과 동일한 모델 로딩 방식
      return new Promise((resolve, reject) => {
        gltfLoader.load(
          modelPath,
          (model) => {
            console.log('🎉 원본 스타일 GLB 모델 로딩 성공!');
            
            // 🎯 원본과 동일하게 model.scene을 직접 추가
            scene.add(model.scene);
            
            // 🎯 모델 크기에 따라 카메라 타겟 조정
            const box = new THREE.Box3().setFromObject(model.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // 모델 중심점으로 OrbitControls 타겟 설정
            controls.target.copy(center);
            
            // 🎯 모델이 훨씬 더 크게 보이도록 카메라 거리 조정
            const maxDimension = Math.max(size.x, size.y, size.z);
            const distance = maxDimension * 0.5; // 1.2 → 0.8로 더 줄여서 훨씬 더 가까이 (더욱 크게)
            
            // 카메라 위치를 모델 크기에 맞게 조정 (원본 비율 유지)
            const originalDistance = Math.sqrt(1*1 + 1*1 + 1*1); // 원본 (1,1,1)의 거리
            const scale = distance / originalDistance;
            
            camera.position.set(
              1 * scale + center.x,
              1 * scale + center.y, 
              1 * scale + center.z
            );
            
            controls.update();
            
            console.log('✅ 원본 스타일 모델이 씬에 추가됨');
            console.log('📊 모델 중심:', center);
            console.log('📊 모델 크기:', size);
            console.log('📊 카메라 위치:', camera.position);
            
            resolve(model);
          },
          (progress) => {
            if (progress.total > 0) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              if (percent % 25 === 0) {
                console.log(`📊 로딩 진행률: ${percent}%`);
              }
            }
          },
          (error) => {
            console.error('❌ 원본 스타일 GLB 로딩 실패:', error);
            reject(error);
          }
        );
      });

    } catch (error) {
      console.error('❌ 원본 스타일 모델 로더 초기화 실패:', error);
      throw error;
    }
  };

  // 🎯 원본과 동일한 단순한 렌더링 루프 + OrbitControls
  const startOriginalRenderLoop = (
    scene: any, 
    camera: any, 
    renderer: any, 
    controls: any
  ) => {
    function animate() {
      requestAnimationFrame(animate);
      
      // OrbitControls 업데이트 (자동 회전 포함)
      controls.update();
      
      // 🎯 원본과 동일한 렌더링
      renderer.render(scene, camera);
    }
    
    animate();
    console.log('✅ 원본 스타일 렌더링 루프 시작');
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <div 
        ref={containerRefCallback}
        className="absolute inset-0 w-full h-full"
        style={{ backgroundColor: '#000000' }} // 원본과 동일한 검은 배경
      />
      
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">원본 스타일 뷰어 로딩 중...</p>
            <p className="text-sm opacity-50 mt-2">Three-icosa 원본 설정 적용</p>
          </div>
        </div>
      )}
      
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-red-900/80 z-10">
          <div className="text-center p-6">
            <p className="text-lg font-bold mb-2">⚠️ 오류 발생</p>
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
      
      {status === 'success' && (
        <div className="absolute top-4 left-4 bg-black/70 text-white p-2 rounded text-sm z-10">
          <div>✅ 원본 스타일 적용</div>
          <div>🔄 자동 회전: {autoRotate ? 'ON' : 'OFF'}</div>
          <div className="text-xs opacity-75 mt-1">
            마우스: 회전 | 휠: 확대/축소 | 우클릭: 팬
          </div>
        </div>
      )}
    </div>
  );
}