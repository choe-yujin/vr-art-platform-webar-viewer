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
  const [cameraStatus, setCameraStatus] = useState<'requesting' | 'granted' | 'denied'>('requesting');
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  const addDebugInfo = useCallback((message: string) => {
    console.log(message);
    setDebugInfo(prev => `${prev}\n${message}`);
  }, []);

  // MindAR 라이브러리 로딩 체크 (개선된 버전)
  const waitForMindAR = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 5초 대기 (100ms * 50)
      
      const checkMindAR = () => {
        attempts++;
        addDebugInfo(`MindAR 체크 시도 ${attempts}/${maxAttempts}`);
        
        if ((window as any).MindARThree) {
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

  // 안전한 WebGL 컨텍스트 생성
  const createSafeWebGLRenderer = useCallback((): THREE.WebGLRenderer | null => {
    try {
      addDebugInfo('WebGL 렌더러 생성 시도...');
      
      const canvas = document.createElement('canvas');
      const contextOptions = {
        alpha: true,
        antialias: false, // 모바일에서 antialias 비활성화
        depth: true,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'default' as WebGLPowerPreference,
        failIfMajorPerformanceCaveat: false
      };

      // WebGL 컨텍스트 미리 테스트
      const testContext = canvas.getContext('webgl2', contextOptions) || 
                         canvas.getContext('webgl', contextOptions) || 
                         canvas.getContext('experimental-webgl', contextOptions);
      
      if (!testContext) {
        throw new Error('WebGL 컨텍스트를 생성할 수 없습니다');
      }
      
      addDebugInfo('✅ WebGL 컨텍스트 테스트 성공');
      
      // Three.js 렌더러 생성
      const renderer = new THREE.WebGLRenderer({
        canvas: undefined, // 새로운 캔버스 생성
        ...contextOptions
      });
      
      addDebugInfo('✅ Three.js WebGL 렌더러 생성 성공');
      return renderer;
      
    } catch (error) {
      addDebugInfo(`❌ WebGL 렌더러 생성 실패: ${error}`);
      setErrorMessage(`WebGL 렌더러 생성 실패: ${error}`);
      return null;
    }
  }, [addDebugInfo]);

  // 데스크톱 3D 초기화
  const initializeDesktop3D = useCallback(async () => {
    try {
      addDebugInfo('🖥️ 데스크톱 3D 뷰어 모드 시작');
      
      if (!containerRef.current) {
        throw new Error('컨테이너 DOM이 준비되지 않음');
      }

      // WebGL 렌더러 생성
      const renderer = createSafeWebGLRenderer();
      if (!renderer) {
        throw new Error('WebGL 렌더러 생성 실패');
      }

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
  }, [addDebugInfo, createSafeWebGLRenderer, autoRotate, rotationSpeed, modelPath, onLoadComplete, onLoadError]);

  // 모바일 AR 초기화
  const initializeMobileAR = useCallback(async () => {
    try {
      addDebugInfo('📱 모바일 AR 모드 초기화 시작');
      
      // 1. MindAR 라이브러리 대기
      addDebugInfo('MindAR 라이브러리 로딩 대기...');
      const mindARLoaded = await waitForMindAR();
      
      if (!mindARLoaded) {
        throw new Error('MindAR 라이브러리 로딩 실패');
      }

      // 2. 카메라 권한 요청
      addDebugInfo('카메라 권한 요청 중...');
      try {
        await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        setCameraStatus('granted');
        addDebugInfo('✅ 카메라 권한 허용됨');
      } catch (cameraError) {
        setCameraStatus('denied');
        addDebugInfo(`❌ 카메라 권한 거부됨: ${cameraError}`);
        throw new Error(`카메라 권한이 필요합니다: ${cameraError}`);
      }

      // 3. WebGL 렌더러 생성
      const renderer = createSafeWebGLRenderer();
      if (!renderer) {
        throw new Error('WebGL 렌더러 생성 실패');
      }

      // 4. MindAR 초기화
      addDebugInfo('MindAR AR 모드 초기화 중...');
      const MindARThree = (window as any).MindARThree;
      
      if (!containerRef.current) {
        throw new Error('컨테이너 DOM이 준비되지 않음');
      }

      const mindarThree = new MindARThree.MindARThree({
        container: containerRef.current,
        imageTargetSrc: '/markers/qr-marker.mind',
        uiLoading: 'no',
        uiScanning: 'no',
        uiError: 'no'
      });

      // 5. GLB 모델 로딩
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
      
      addDebugInfo('🎉 모바일 AR 초기화 완료!');
      setStatus('success');
      onLoadComplete?.();

    } catch (error) {
      addDebugInfo(`❌ 모바일 AR 초기화 실패: ${error}`);
      setErrorMessage(`AR 초기화 실패: ${error}`);
      setStatus('error');
      onLoadError?.(`AR 초기화 실패: ${error}`);
      
      // 오류 시 데스크톱 모드로 fallback
      addDebugInfo('데스크톱 3D 뷰어로 전환 시도...');
      setTimeout(() => initializeDesktop3D(), 1000);
    }
  }, [addDebugInfo, waitForMindAR, createSafeWebGLRenderer, modelPath, onLoadComplete, onLoadError, initializeDesktop3D]);

  useEffect(() => {
    if (isInitializedRef.current || !containerRef.current) return;
    isInitializedRef.current = true;

    const container = containerRef.current; // ref 값을 변수로 복사

    addDebugInfo(`=== AR 뷰어 초기화 시작 ===`);
    addDebugInfo(`디바이스 타입: ${deviceType}`);
    addDebugInfo(`모델 경로: ${modelPath}`);

    if (deviceType === 'mobile') {
      initializeMobileAR();
    } else {
      initializeDesktop3D();
    }

    return () => {
      // 클린업
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
          <span>카메라: {cameraStatus}</span>
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
          <p className="text-lg mb-2">AR 뷰어 로딩 중...</p>
          <div className="text-sm text-gray-300 max-w-xs text-center whitespace-pre-line">
            {debugInfo}
          </div>
        </div>
      )}

      {/* 에러 화면 */}
      {status === 'error' && (
        <div className="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center text-white z-20">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">3D 뷰어 오류</h2>
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

      {/* 플로팅 버튼들 */}
      {status === 'success' && (
        <div className="absolute bottom-20 right-6 flex flex-col gap-3 z-30">
          <button className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg">
            📤
          </button>
          <button className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full shadow-lg">
            💬
          </button>
          <button className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg">
            👤
          </button>
        </div>
      )}
    </div>
  );
}
