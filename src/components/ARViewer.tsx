/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
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
  rotationSpeed = 2
}: ARViewerProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  const addDebugInfo = useCallback((message: string) => {
    console.log(message);
    setDebugInfo(prev => `${prev}\n${message}`);
  }, []);

  // MindAR 라이브러리 로딩 체크 (올바른 방법)
  const waitForMindAR = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkMindAR = () => {
        attempts++;
        addDebugInfo(`MindAR 체크 시도 ${attempts}/${maxAttempts}`);
        
        // 올바른 MindAR 글로벌 객체 체크
        if (typeof (window as any).MINDAR !== 'undefined' && 
            (window as any).MINDAR.IMAGE && 
            (window as any).MINDAR.IMAGE.MindARThree) {
          addDebugInfo('✅ MindAR 라이브러리 로드 완료');
          resolve(true);
          return;
        }
        
        if (attempts >= maxAttempts) {
          addDebugInfo('❌ MindAR 라이브러리 로딩 타임아웃');
          resolve(false);
          return;
        }
        
        setTimeout(checkMindAR, 100);
      };
      
      checkMindAR();
    });
  }, [addDebugInfo]);

  // 데스크톱 3D 초기화 (카메라 요청 없음)
  const initializeDesktop3D = useCallback(async () => {
    try {
      addDebugInfo('🖥️ 데스크톱 3D 뷰어 모드 시작');
      
      if (!containerRef.current) {
        throw new Error('컨테이너 DOM이 준비되지 않음');
      }

      // Three.js 렌더러 생성 (카메라 사용 안함)
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000);
      containerRef.current.appendChild(renderer.domElement);

      // 씬 설정
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 0, 5);

      // 조명 설정
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      // 컨트롤 설정
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = rotationSpeed;

      // GLB 모델 로딩
      addDebugInfo('GLB 모델 로딩 중...');
      const loader = new GLTFLoader();
      
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(modelPath, resolve, undefined, reject);
      });

      scene.add(gltf.scene);

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

      addDebugInfo('🎉 데스크톱 3D 뷰어 초기화 완료!');
      setStatus('success');
      onLoadComplete?.();

    } catch (error) {
      addDebugInfo(`❌ 데스크톱 3D 뷰어 초기화 실패: ${error}`);
      setErrorMessage(`3D 뷰어 오류: ${error}`);
      setStatus('error');
      onLoadError?.(`3D 뷰어 오류: ${error}`);
    }
  }, [addDebugInfo, autoRotate, rotationSpeed, modelPath, onLoadComplete, onLoadError]);

  // 모바일 AR 초기화 (MindAR 사용)
  const initializeMobileAR = useCallback(async () => {
    try {
      addDebugInfo('📱 모바일 AR 모드 초기화 시작');
      
      // 1. MindAR 라이브러리 대기
      addDebugInfo('MindAR 라이브러리 로딩 대기...');
      const mindARLoaded = await waitForMindAR();
      
      if (!mindARLoaded) {
        throw new Error('MindAR 라이브러리 로딩 실패');
      }

      // 2. MindAR 초기화 (올바른 방법)
      addDebugInfo('MindAR AR 모드 초기화 중...');
      
      if (!containerRef.current) {
        throw new Error('컨테이너 DOM이 준비되지 않음');
      }

      const mindarThree = new (window as any).MINDAR.IMAGE.MindARThree({
        container: containerRef.current,
        imageTargetSrc: '/markers/qr-marker.mind'
      });

      const { renderer, scene, camera } = mindarThree;
      
      // 3. GLB 모델 로딩
      addDebugInfo('GLB 모델 로딩 중...');
      const loader = new GLTFLoader();
      
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          modelPath,
          resolve,
          (progress) => addDebugInfo(`모델 로딩 진행률: ${Math.round((progress.loaded / progress.total) * 100)}%`),
          reject
        );
      });

      const model = gltf.scene;
      model.scale.setScalar(0.5);
      
      const anchor = mindarThree.addAnchor(0);
      anchor.group.add(model);

      addDebugInfo('AR 시스템 시작 중...');
      await mindarThree.start();
      
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });
      
      addDebugInfo('🎉 모바일 AR 초기화 완료!');
      setStatus('success');
      onLoadComplete?.();

    } catch (error) {
      addDebugInfo(`❌ 모바일 AR 초기화 실패: ${error}`);
      setErrorMessage(`AR 초기화 실패: ${error}`);
      setStatus('error');
      onLoadError?.(`AR 초기화 실패: ${error}`);
    }
  }, [addDebugInfo, waitForMindAR, modelPath, onLoadComplete, onLoadError]);

  useEffect(() => {
    if (isInitializedRef.current || !containerRef.current) return;
    isInitializedRef.current = true;

    const container = containerRef.current;

    addDebugInfo(`=== AR 뷰어 초기화 시작 ===`);
    addDebugInfo(`디바이스 타입: ${deviceType}`);
    addDebugInfo(`모델 경로: ${modelPath}`);

    if (deviceType === 'mobile') {
      initializeMobileAR();
    } else {
      initializeDesktop3D();
    }

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [deviceType, modelPath, initializeMobileAR, initializeDesktop3D, addDebugInfo]);

  return (
    <div className="relative w-full h-screen bg-black">
      {/* 메인 AR/3D 컨테이너 */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 1 }}
      />
      
      {/* 디버그 패널 (상단) */}
      <div className="absolute top-0 left-0 right-0 bg-red-900 bg-opacity-80 text-white p-2 text-xs z-10">
        <div className="flex items-center gap-2">
          <span>디버그:</span>
          <span className={`px-2 py-1 rounded ${
            status === 'loading' ? 'bg-yellow-600' :
            status === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {status === 'loading' ? 'loading' :
             status === 'success' ? 'success' : 'error'}
          </span>
          <span>디바이스: {deviceType}</span>
        </div>
        {errorMessage && (
          <div className="mt-1 text-red-200">
            오류: {errorMessage}
          </div>
        )}
      </div>

      {/* 로딩 화면 */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center text-white z-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-lg mb-2">
            {deviceType === 'mobile' ? 'AR 뷰어 로딩 중...' : '3D 뷰어 로딩 중...'}
          </p>
          <div className="text-sm text-gray-300 max-w-xs text-center whitespace-pre-line">
            {debugInfo}
          </div>
        </div>
      )}

      {/* 에러 화면 */}
      {status === 'error' && (
        <div className="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center text-white z-20">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">뷰어 오류</h2>
          <p className="text-gray-300 mb-4 text-center max-w-sm">
            {errorMessage}
          </p>
          <div className="text-xs text-gray-400 max-w-xs text-center whitespace-pre-line max-h-40 overflow-y-auto">
            {debugInfo}
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
