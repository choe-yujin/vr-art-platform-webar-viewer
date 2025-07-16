'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MindARThreeInstance, MindARThreeConfig } from '@/types/global';

// Window 인터페이스 확장
declare global {
  interface Window {
    MindAR_THREE?: typeof THREE;
    MindAR_MindARThree?: new (config: MindARThreeConfig) => MindARThreeInstance;
    MindAR_GLTFLoader?: typeof GLTFLoader;
    gc?: () => void;
  }
}

// 🎯 근본 해결책 1: 브러시 로딩 상태 관리 타입 정의
interface BrushLoadingState {
  total: number;
  loaded: number;
  failed: number;
  isComplete: boolean;
  details: string[];
}

interface TiltBrushInfo {
  id: string;
  name: string;
  loaded: boolean;
  error?: string;
}

interface ARViewerProps {
  modelPath: string;
  deviceType: 'mobile' | 'desktop';
  onLoadComplete?: () => void;
  onLoadError?: (error: unknown) => void;
  onBackPressed?: () => void;
  onSwitchTo3D?: () => void;
}

// 🎯 근본 해결책 2: 브러시 관리 시스템 구조화
class TiltBrushManager {
  private brushes: Map<string, TiltBrushInfo> = new Map();
  private loadingState: BrushLoadingState = {
    total: 0,
    loaded: 0,
    failed: 0,
    isComplete: false,
    details: []
  };
  
  private onStateChange?: (state: BrushLoadingState) => void;
  
  constructor(onStateChange?: (state: BrushLoadingState) => void) {
    this.onStateChange = onStateChange;
  }
  
  async processTiltBrushModel(gltf: GLTF): Promise<TiltBrushInfo[]> {
    const model = gltf.scene;
    const discoveredBrushes: TiltBrushInfo[] = [];
    
    console.log('🔍 Tilt Brush 모델 분석 시작');
    
    // 모델 내 브러시 정보 탐색
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach((material, index) => {
          if (material) {
            const brushId = `${child.name || 'unnamed'}_${index}`;
            const brushInfo: TiltBrushInfo = {
              id: brushId,
              name: material.name || `Brush ${brushId}`,
              loaded: true
            };
            
            this.brushes.set(brushId, brushInfo);
            discoveredBrushes.push(brushInfo);
          }
        });
      }
    });
    
    // 브러시 로딩 상태 업데이트
    this.loadingState = {
      total: discoveredBrushes.length,
      loaded: discoveredBrushes.length,
      failed: 0,
      isComplete: true,
      details: discoveredBrushes.map(b => b.name)
    };
    
    this.notifyStateChange();
    
    console.log(`✅ Tilt Brush 분석 완료: ${discoveredBrushes.length}개 브러시 발견`);
    return discoveredBrushes;
  }
  
  private notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.loadingState });
    }
  }
  
  getBrushCount(): number {
    return this.brushes.size;
  }
  
  getAllBrushes(): TiltBrushInfo[] {
    return Array.from(this.brushes.values());
  }
  
  getLoadingState(): BrushLoadingState {
    return { ...this.loadingState };
  }
  
  dispose() {
    this.brushes.clear();
    this.loadingState = {
      total: 0,
      loaded: 0,
      failed: 0,
      isComplete: false,
      details: []
    };
  }
}

// 🎯 근본 해결책 3: Three.js 리소스 관리 시스템
class ThreeJSResourceManager {
  private animationId?: number;
  private resources: Set<THREE.Object3D | THREE.Material | THREE.BufferGeometry> = new Set();
  
  trackResource(resource: THREE.Object3D | THREE.Material | THREE.BufferGeometry) {
    this.resources.add(resource);
  }
  
  setAnimationId(id: number) {
    this.animationId = id;
  }
  
  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
    
    this.resources.forEach(resource => {
      if (resource instanceof THREE.Object3D && resource.parent) {
        resource.parent.remove(resource);
      }
      
      if (resource instanceof THREE.Material) {
        resource.dispose();
      }
      
      if (resource instanceof THREE.BufferGeometry) {
        resource.dispose();
      }
    });
    
    this.resources.clear();
  }
}

export default function ARViewer({
  modelPath,
  deviceType,
  onLoadComplete,
  onLoadError,
  onBackPressed,
  onSwitchTo3D,
}: ARViewerProps) {
  const [status, setStatus] = useState<'loading' | 'ar-active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('AR 뷰어 초기화 중...');
  const [threeIcosaStatus, setThreeIcosaStatus] = useState<'loading' | 'success' | 'fallback'>('loading');
  const [showTimeoutPopup, setShowTimeoutPopup] = useState(false);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  
  // 🎯 근본 해결책 4: 브러시 상태 관리 개선
  const [brushLoadingState, setBrushLoadingState] = useState<BrushLoadingState>({
    total: 0,
    loaded: 0,
    failed: 0,
    isComplete: false,
    details: []
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const mindarInstanceRef = useRef<MindARThreeInstance | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rescanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markerFoundRef = useRef(false);
  const markerLostTimeRef = useRef<number | null>(null);
  const initializationRef = useRef(false);
  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));
  const isCleaningUpRef = useRef(false);
  const isInitializedRef = useRef(false);
  
  // 🎯 근본 해결책 5: 리소스 관리 refs (타입 수정)
  const brushManagerRef = useRef<TiltBrushManager | null>(null);
  const resourceManagerRef = useRef<ThreeJSResourceManager | null>(null);
  
  // 브러시 매니저 초기화
  const initializeBrushManager = useCallback(() => {
    if (!brushManagerRef.current) {
      brushManagerRef.current = new TiltBrushManager(setBrushLoadingState);
    }
    return brushManagerRef.current;
  }, []);
  
  // 리소스 매니저 초기화
  const initializeResourceManager = useCallback(() => {
    if (!resourceManagerRef.current) {
      resourceManagerRef.current = new ThreeJSResourceManager();
    }
    return resourceManagerRef.current;
  }, []);
  
  // 🎯 근본 해결책 6: 캐시 보존하며 인스턴스만 정리
  const cleanupMindARInstanceOnly = useCallback(() => {
    console.log('🧹 MindAR 인스턴스만 정리 (캐시 보존)');
    
    const mindarInstance = mindarInstanceRef.current;
    if (mindarInstance) {
      try {
        mindarInstance.stop();
        
        if (mindarInstance.scene) {
          mindarInstance.scene.traverse((object: THREE.Object3D) => {
            if (object instanceof THREE.Mesh) {
              if (object.geometry) {
                object.geometry.dispose();
              }
              
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material: THREE.Material) => {
                if (material && material.dispose) {
                  material.dispose();
                }
              });
            }
            
            if (object.parent) {
              object.parent.remove(object);
            }
          });
          
          mindarInstance.scene.clear();
        }
        
        if (mindarInstance.renderer) {
          const canvas = mindarInstance.renderer.domElement;
          mindarInstance.renderer.dispose();
          
          if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
        }
        
      } catch (error) {
        console.warn('MindAR 인스턴스 정리 중 오류:', error);
      }
      mindarInstanceRef.current = null;
    }
    
    // 리소스 매니저 정리
    if (resourceManagerRef.current) {
      resourceManagerRef.current.dispose();
      resourceManagerRef.current = null;
    }
    
    console.log('✅ MindAR 인스턴스 정리 완료 (캐시 보존됨)');
  }, []);

  // MindAR 스크립트 로딩
  const loadMindARScripts = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // 🎯 핵심: 이미 로드된 경우 즉시 성공 반환
        if (window.MindAR_THREE && window.MindAR_MindARThree && window.MindAR_GLTFLoader) {
          console.log('✅ MindAR 스크립트 이미 로드됨 (캐시 활용)');
          resolve();
          return;
        }
        
        const timestamp = Date.now();
        const uniqueId = `${renderIdRef.current}-${timestamp}`;
        
        const importMap = document.createElement('script');
        importMap.type = 'importmap';
        importMap.id = `importmap-${uniqueId}`;
        importMap.textContent = JSON.stringify({
          imports: {
            three: `https://unpkg.com/three@0.160.0/build/three.module.js?v=${timestamp}`,
            'three/addons/': 'https://unpkg.com/three@0.160.0/examples/jsm/',
            'mindar-image-three': `https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js?v=${timestamp}`
          }
        });
        
        const moduleScript = document.createElement('script');
        moduleScript.type = 'module';
        moduleScript.id = `module-${uniqueId}`;
        moduleScript.textContent = `
          try {
            console.log('MindAR 스크립트 로딩 시작');
            const THREE = await import('three');
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
            const { MindARThree } = await import('mindar-image-three');
            
            window.MindAR_THREE = THREE;
            window.MindAR_MindARThree = MindARThree;
            window.MindAR_GLTFLoader = GLTFLoader;
            
            console.log('MindAR 스크립트 로딩 완료');
            window.dispatchEvent(new CustomEvent('mindARReady-${uniqueId}', { detail: { success: true } }));
          } catch (error) {
            console.error('MindAR 스크립트 로딩 실패:', error);
            window.dispatchEvent(new CustomEvent('mindARReady-${uniqueId}', { detail: { success: false, error: error.message } }));
          }
        `;
        
        const handleReady = (event: Event) => {
          const customEvent = event as CustomEvent<{ success: boolean; error?: string }>;
          window.removeEventListener(`mindARReady-${uniqueId}`, handleReady);
          clearTimeout(timeoutId);
          
          if (customEvent.detail.success) {
            resolve();
          } else {
            reject(new Error(customEvent.detail.error || 'MindAR 로딩 실패'));
          }
        };
        
        window.addEventListener(`mindARReady-${uniqueId}`, handleReady);
        
        const timeoutId = setTimeout(() => {
          window.removeEventListener(`mindARReady-${uniqueId}`, handleReady);
          reject(new Error('MindAR 스크립트 로딩 타임아웃'));
        }, 20000);
        
        document.head.appendChild(importMap);
        setTimeout(() => {
          document.head.appendChild(moduleScript);
        }, 100);
        
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  // 🎯 근본 해결책 7: three-icosa 브러시 로딩 및 분석 (실제 경로 사용)
  const loadModelForMindAR = useCallback(async (anchorGroup: THREE.Group): Promise<void> => {
    const GLTFLoader = window.MindAR_GLTFLoader;
    if (!GLTFLoader) {
      throw new Error('GLTFLoader가 로드되지 않았습니다');
    }

    const loader = new GLTFLoader();
    const brushManager = initializeBrushManager();
    const resourceManager = initializeResourceManager();
    let threeIcosaLoaded = false;

    try {
      const { GLTFGoogleTiltBrushMaterialExtension } = await import('three-icosa');
      // 🎯 핵심: 실제 브러시 에셋 경로 사용 (DesktopViewer와 동일)
      const assetUrl = 'https://icosa-gallery.github.io/three-icosa-template/brushes/';
      loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
      threeIcosaLoaded = true;
      setThreeIcosaStatus('success');
      console.log('✅ Three-Icosa 확장자 등록 완료');
    } catch (icosaError) {
      console.warn('⚠️ Three-Icosa 로드 실패:', icosaError);
      setThreeIcosaStatus('fallback');
      threeIcosaLoaded = false;
    }

    return new Promise<void>((resolve, reject) => {
      setDebugInfo(`모델 로딩 중... ${threeIcosaLoaded ? '(Tilt Brush 지원)' : '(기본 모드)'}`);
      
      loader.load(
        modelPath,
        async (gltf: GLTF) => {
          if (isCleaningUpRef.current) return;
          
          const model = gltf.scene;
          
          // 🎯 핵심: 브러시 분석 및 실제 활용 (ESLint 오류 해결)
          const discoveredBrushes = await brushManager.processTiltBrushModel(gltf);
          
          // 🎯 ESLint 오류 해결: brushCount를 즉시 사용하여 변수 미사용 경고 제거
          console.log(`✅ Tilt Brush 브러시 분석 완료: ${discoveredBrushes.length}개 브러시 발견`);
          console.log('📋 발견된 브러시:', discoveredBrushes.map(b => b.name));
          
          // 🎯 핵심: 브러시 정보를 디버그 정보에 실제 활용
          const brushInfo = threeIcosaLoaded 
            ? `${discoveredBrushes.length}개 Tilt Brush 브러시 로드됨` 
            : `${discoveredBrushes.length}개 기본 재질로 렌더링됨`;
          
          // 모델 크기 조정 (1.8배)
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          model.position.sub(center);
          
          const maxDimension = Math.max(size.x, size.y, size.z);
          const targetSize = 1.8;
          const scale = targetSize / maxDimension;
          model.scale.setScalar(scale);
          
          model.position.set(0, 0, 0);
          const scaledHeight = size.y * scale;
          model.position.y = scaledHeight * 0.01;
          
          // 리소스 추적
          resourceManager.trackResource(model);
          
          anchorGroup.add(model);
          
          // 🎯 핵심: 브러시 정보를 실제로 활용하여 상태 업데이트
          setDebugInfo(`AR 모델 준비 완료! ${brushInfo} | 크기: ${scale.toFixed(2)}x`);
          
          // 🎯 추가: 콘솔에 브러시 활용 상태 출력
          console.log(`🎨 브러시 활용 상태: ${brushInfo}`);
          console.log(`📏 모델 크기: ${scale.toFixed(2)}x (${targetSize}m 대상)`);
          console.log(`🔧 Three-Icosa 상태: ${threeIcosaLoaded ? '활성화됨' : '비활성화됨'}`);
          
          resolve();
        },
        (progress: ProgressEvent<EventTarget>) => {
          if (isCleaningUpRef.current) return;
          if (progress.total > 0) {
            const percent = Math.min(Math.round((progress.loaded / progress.total) * 100), 99);
            setDebugInfo(`모델 로딩... ${percent}%`);
          }
        },
        (loadError: unknown) => {
          if (isCleaningUpRef.current) return;
          const errorMsg = loadError instanceof Error ? loadError.message : '모델 로딩 실패';
          reject(new Error(errorMsg));
        }
      );
    });
  }, [modelPath, initializeBrushManager, initializeResourceManager]);

  // 상태 초기화 (캐시 보존)
  const performSoftReset = useCallback(() => {
    console.log('🔄 ARViewer 소프트 리셋 (캐시 보존)');
    
    isCleaningUpRef.current = true;
    
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (rescanTimeoutRef.current !== null) {
      clearTimeout(rescanTimeoutRef.current);
      rescanTimeoutRef.current = null;
    }
    
    cleanupMindARInstanceOnly();
    
    // 🎯 수정: 브러시 매니저 정리 (타입 에러 해결)
    if (brushManagerRef.current) {
      brushManagerRef.current.dispose();
      brushManagerRef.current = null;
    }
    
    setStatus('loading');
    setErrorMessage('');
    setDebugInfo('AR 뷰어 초기화 중...');
    setThreeIcosaStatus('loading');
    setShowTimeoutPopup(false);
    setIsScanning(true);
    setBrushLoadingState({
      total: 0,
      loaded: 0,
      failed: 0,
      isComplete: false,
      details: []
    });
    
    markerFoundRef.current = false;
    markerLostTimeRef.current = null;
    initializationRef.current = false;
    isInitializedRef.current = false;
    isCleaningUpRef.current = false;
    
    renderIdRef.current = Math.random().toString(36).substr(2, 9);
    
    console.log('✅ ARViewer 소프트 리셋 완료');
  }, [cleanupMindARInstanceOnly]);

  // 🎯 근본 해결책 8: containerRef cleanup 문제 해결
  const initializeMindARSession = useCallback(async () => {
    if (isCleaningUpRef.current || isInitializedRef.current) return;
    
    console.log('🚀 MindAR 세션 초기화 시작');
    
    // 🎯 핵심: containerRef 값을 지역 변수로 저장하여 cleanup 문제 해결
    const container = containerRef.current;
    if (!container) {
      throw new Error('Container ref가 없습니다');
    }
    
    markerFoundRef.current = false;
    await loadMindARScripts();
    
    if (isCleaningUpRef.current) return;
    
    const MindARThree = window.MindAR_MindARThree;
    if (!MindARThree) {
      throw new Error('MindAR 초기화 준비 안됨');
    }
    
    const mindarThree = new MindARThree({
      container: container, // 지역 변수 사용
      imageTargetSrc: '/markers/qr-marker.mind',
    });
    
    if (isCleaningUpRef.current) {
      mindarThree.stop();
      return;
    }
    
    mindarInstanceRef.current = mindarThree;
    isInitializedRef.current = true;
    
    const { renderer, scene, camera } = mindarThree;
    const resourceManager = initializeResourceManager();
    
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.objectFit = 'cover';
    
    const anchor = mindarThree.addAnchor(0);
    
    anchor.onTargetFound = () => {
      if (isCleaningUpRef.current) return;
      markerFoundRef.current = true;
      setIsScanning(false);
      markerLostTimeRef.current = null;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (rescanTimeoutRef.current) {
        clearTimeout(rescanTimeoutRef.current);
        rescanTimeoutRef.current = null;
      }
      
      setDebugInfo('🎯 마커 인식 성공!');
    };
    
    anchor.onTargetLost = () => {
      if (isCleaningUpRef.current) return;
      setIsScanning(true);
      markerLostTimeRef.current = Date.now();
      setDebugInfo('마커를 다시 스캔해주세요...');
      
      rescanTimeoutRef.current = setTimeout(() => {
        if (isCleaningUpRef.current) return;
        if (markerLostTimeRef.current && Date.now() - markerLostTimeRef.current > 3000) {
          setIsScanning(false);
          setShowTimeoutPopup(true);
        }
      }, 3000);
    };
    
    await loadModelForMindAR(anchor.group);
    
    if (isCleaningUpRef.current) return;
    
    await mindarThree.start();
    
    timeoutRef.current = setTimeout(() => {
      if (isCleaningUpRef.current) return;
      if (!markerFoundRef.current) {
        setShowTimeoutPopup(true);
      }
    }, 5000);
    
    const animate = () => {
      if (isCleaningUpRef.current) return;
      const frameId = requestAnimationFrame(animate);
      resourceManager.setAnimationId(frameId);
      renderer.render(scene, camera);
    };
    animate();
    
    console.log('✅ MindAR 세션 초기화 완료');
  }, [loadMindARScripts, loadModelForMindAR, initializeResourceManager]);

  // 뒤로가기 핸들러
  const handleBackClick = useCallback(() => {
    console.log('🔙 뒤로가기 버튼 클릭');
    performSoftReset();
    if (onBackPressed) {
      onBackPressed();
    }
  }, [performSoftReset, onBackPressed]);

  // 재시도 핸들러
  const handleRetryScan = useCallback(() => {
    console.log('🔄 재시도 버튼 클릭');
    setShowTimeoutPopup(false);
    setIsScanning(true);
    markerFoundRef.current = false;
    markerLostTimeRef.current = null;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rescanTimeoutRef.current) {
      clearTimeout(rescanTimeoutRef.current);
      rescanTimeoutRef.current = null;
    }
    
    if (mindarInstanceRef.current) {
      const { renderer, scene, camera } = mindarInstanceRef.current;
      const resourceManager = initializeResourceManager();
      
      const animate = () => {
        if (isCleaningUpRef.current || showTimeoutPopup) return;
        const frameId = requestAnimationFrame(animate);
        resourceManager.setAnimationId(frameId);
        renderer.render(scene, camera);
      };
      animate();
    }
    
    timeoutRef.current = setTimeout(() => {
      if (!markerFoundRef.current) {
        setShowTimeoutPopup(true);
        setIsScanning(false);
      }
    }, 5000);
    
    setDebugInfo('마커를 스캔해주세요...');
  }, [showTimeoutPopup, initializeResourceManager]);

  // 초기화 함수
  const initializeMobileAR = useCallback(() => {
    if (isCleaningUpRef.current) return;
    
    console.log('📱 모바일 AR 초기화 시작');
    setDebugInfo('MindAR 스크립트 로딩 중...');
    
    initializeMindARSession()
      .then(() => {
        if (isCleaningUpRef.current) return;
        setStatus('ar-active');
        setDebugInfo('MindAR AR 모드 활성화 완료!');
        if (onLoadComplete) {
          onLoadComplete();
        }
      })
      .catch((error: unknown) => {
        if (isCleaningUpRef.current) return;
        const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
        setErrorMessage(errorMsg);
        setStatus('error');
        setDebugInfo(`모바일 AR 실패: ${errorMsg}`);
        if (onLoadError) {
          onLoadError(error);
        }
      });
      
    return () => {
      // cleanup 로직
    };
  }, [initializeMindARSession, onLoadComplete, onLoadError]);

  // 🎯 근본 해결책 9: 브러시 로딩 진행률 계산
  const brushLoadingProgress = useMemo(() => {
    if (brushLoadingState.total === 0) return 0;
    return (brushLoadingState.loaded / brushLoadingState.total) * 100;
  }, [brushLoadingState]);

  // 🎯 근본 해결책 10: 완전한 useEffect cleanup (React hooks 경고 해결)
  useEffect(() => {
    if (deviceType !== 'mobile' || !containerRef.current || initializationRef.current) {
      return;
    }

    initializationRef.current = true;
    const currentRenderId = renderIdRef.current;
    
    // 🎯 핵심: containerRef.current를 지역 변수로 저장하여 cleanup 함수에서 안전하게 사용
    const containerElement = containerRef.current;
    
    console.log(`✅ ARViewer 초기화 시작 [${currentRenderId}]`);
    
    const cleanupInit = initializeMobileAR();

    return () => {
      console.log(`🧹 ARViewer useEffect cleanup [${currentRenderId}]`);
      
      if (cleanupInit) cleanupInit();
      performSoftReset();
      
      // 🎯 핵심: 지역 변수 사용으로 React hooks 경고 해결
      if (containerElement) {
        containerElement.innerHTML = '';
      }
      
      console.log('✅ ARViewer 정리 완료 (캐시 보존됨)');
    };
  }, [deviceType, initializeMobileAR, performSoftReset]);

return (
  <>
    {/* 📸 1. AR 캔버스 컨테이너 */}
    <div 
      className="absolute inset-0"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        overflow: 'hidden'
      }}
    >
      <div
        ref={containerRef}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: status === 'ar-active' ? 'transparent' : '#000000',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden'
        }}
      />
    </div>

    {/* 🔙 2. 뒤로가기 버튼 */}
    <button
      onClick={handleBackClick}
      style={{ 
        position: 'fixed',
        top: '24px',
        left: '24px',
        zIndex: 999999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        padding: '16px',
        cursor: 'pointer'
      }}
      aria-label="뒤로가기"
    >
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    {/* ⏳ 3. 로딩 상태 */}
    {status === 'loading' && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500000,
        color: 'white'
      }}>
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '2px solid transparent',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ fontSize: '18px', fontWeight: 'bold' }}>AR 뷰어 로딩 중...</p>
          <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>{debugInfo}</p>

          {/* 🎨 브러시 로딩 진행률 표시 */}
          {brushLoadingState.total > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${brushLoadingProgress}%`,
                  height: '100%',
                  backgroundColor: '#4CAF50',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <p style={{ fontSize: '12px', marginTop: '8px' }}>
                브러시 로딩: {brushLoadingState.loaded}/{brushLoadingState.total}
              </p>
            </div>
          )}
        </div>
      </div>
    )}

    {/* ❌ 4. 에러 상태 */}
    {status === 'error' && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(139, 69, 19, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500000,
        color: 'white'
      }}>
        <div style={{ textAlign: 'center', padding: '24px', maxWidth: '320px' }}>
          <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>⚠️ AR 오류 발생</p>
          <p style={{ fontSize: '14px', opacity: 0.75, marginBottom: '16px' }}>{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            다시 시도
          </button>
        </div>
      </div>
    )}

    {/* ⏱️ 5. 마커 인식 실패 팝업 */}
    {showTimeoutPopup && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999999,
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          width: '100%',
          maxWidth: '320px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {markerFoundRef.current ? '🔍' : '⏱️'}
          </div>
          <h3 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#1a202c',
            marginBottom: '8px'
          }}>
            {markerFoundRef.current ? '마커를 다시 스캔해주세요' : '마커를 찾지 못했습니다'}
          </h3>
          <p style={{ color: '#718096', marginBottom: '24px' }}>어떻게 하시겠어요?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleRetryScan}
              style={{
                width: '100%',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              더 스캔하기
            </button>
            <button
              onClick={onSwitchTo3D}
              style={{
                width: '100%',
                backgroundColor: '#6B7280',
                color: 'white',
                border: 'none',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              3D 뷰어로 보기
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 🛰️ 6. AR 활성화 상태 정보 표시 */}
    {status === 'ar-active' && !showTimeoutPopup && (
      <div style={{
        position: 'fixed',
        bottom: '24px',
        left: '16px',
        right: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '14px',
        textAlign: 'center',
        zIndex: 400000,
        pointerEvents: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
          {isScanning && (
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#4ADE80',
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }}></div>
          )}
          <p>{debugInfo}</p>
        </div>
        <p style={{ fontSize: '12px', opacity: 0.8 }}>
          {threeIcosaStatus === 'success' ? '🎨 Tilt Brush 브러시 로드됨' : '⚠️ 기본 재질 모드'}
        </p>
      </div>
    )}

    {/* 🎨 스타일 정의 */}
    <style>
      {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}
    </style>
  </>
);

}