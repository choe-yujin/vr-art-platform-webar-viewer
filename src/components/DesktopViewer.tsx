



/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ArtworkResponse } from '@/utils/api';

// 🔍 VR 익스포트 문제점 진단을 위한 브러시 원본 데이터 보존 시스템
interface OriginalBrushData {
  color: THREE.Color;
  opacity: number;
  colorSource: string;
  opacitySource: string;
  properties: {
    roughness?: number;
    metalness?: number;
    emissiveIntensity?: number;
    side?: THREE.Side;
    [key: string]: unknown;
  };
}

// 🚫 하드코딩 완전 제거 - 모든 브러시를 동등하게 처리
function getBrushDefaults(brushName: string) {
  const defaultColor = new THREE.Color(0.7, 0.7, 0.7);
  const defaultOpacity = 0.9;
  
  console.log(`🔍 브러시 기본값 적용: ${brushName} → 기본 색상/투명도 사용 (하드코딩 제거됨)`);
  
  return {
    color: defaultColor,
    opacity: defaultOpacity,
    properties: {
      roughness: 0.5,
      metalness: 0.1,
      emissiveIntensity: 0.05,
      side: THREE.FrontSide
    }
  };
}

// 🔍 색상 유니폼에서 실제 색상 추출
function extractColorFromUniform(value: unknown, uniformName: string) {
  if (!value) return { success: false, color: new THREE.Color() };
  
  try {
    if (value && typeof value === 'object' && 'isColor' in value) {
      return { success: true, color: (value as THREE.Color).clone() };
    }
    if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
      const vec = value as { x: number; y: number; z: number };
      return { success: true, color: new THREE.Color(vec.x, vec.y, vec.z) };
    }
    if (Array.isArray(value) && value.length >= 3) {
      return { success: true, color: new THREE.Color(value[0] as number, value[1] as number, value[2] as number) };
    }
    if (typeof value === 'number' && value >= 0 && value <= 1) {
      return { success: true, color: new THREE.Color(value, value, value) };
    }
  } catch (error) {
    console.warn(`⚠️ ${uniformName} 색상 추출 실패:`, error);
  }
  
  return { success: false, color: new THREE.Color() };
}

// 🔍 범용 원본 데이터 추출 함수
function extractOriginalBrushData(material: THREE.Material & { uniforms?: Record<string, { value: unknown }> }, meshName: string, brushName: string): OriginalBrushData {
  console.log(`🔍 ${brushName} 브러시 원본 데이터 추출: ${meshName}`);
  
  const colorUniforms = [
    'u_Color', 'u_color', 'u_MainColor', 'u_main_color',
    'u_BaseColor', 'u_base_color', 'u_DiffuseColor', 'u_diffuse_color',
    'u_Tint', 'u_tint', 'u_ColorTint', 'u_color_tint',
    'u_EmissionColor', 'u_emission_color', 'u_EmissiveColor', 'u_emissive_color',
    'diffuse', 'color', 'mainColor', 'baseColor', 'tint',
    'u_BrushColor', 'u_brush_color', 'u_StrokeColor', 'u_stroke_color'
  ];
  
  const brushDefaults = getBrushDefaults(brushName);
  let originalColor = brushDefaults.color;
  let foundColorSource = 'default';
  
  if (material.uniforms) {
    for (const colorUniform of colorUniforms) {
      if (material.uniforms[colorUniform]) {
        const extracted = extractColorFromUniform(material.uniforms[colorUniform].value, colorUniform);
        if (extracted.success) {
          originalColor = extracted.color;
          foundColorSource = colorUniform;
          console.log(`✅ ${brushName} 원본 색상 추출: ${originalColor.getHexString()} from ${colorUniform}`);
          break;
        }
      }
    }
  }
  
  // 투명도 추출
  const opacityUniforms = ['u_Opacity', 'u_opacity', 'u_Alpha', 'u_alpha', 'opacity', 'alpha'];
  let originalOpacity = brushDefaults.opacity;
  let opacitySource = 'default';
  
  if (material.uniforms) {
    for (const opacityUniform of opacityUniforms) {
      if (material.uniforms[opacityUniform] && material.uniforms[opacityUniform].value !== undefined) {
        const value = material.uniforms[opacityUniform].value;
        if (typeof value === 'number' && value >= 0 && value <= 1) {
          originalOpacity = value;
          opacitySource = opacityUniform;
          break;
        }
      }
    }
  }
  
  const materialWithOpacity = material as THREE.Material & { opacity?: number };
  if (materialWithOpacity.opacity !== undefined && materialWithOpacity.opacity !== 1.0) {
    originalOpacity = Math.max(originalOpacity, materialWithOpacity.opacity);
    opacitySource = 'material.opacity';
  }
  
  return {
    color: originalColor,
    opacity: originalOpacity,
    colorSource: foundColorSource,
    opacitySource: opacitySource,
    properties: brushDefaults.properties
  };
}

// 🎨 범용 원본 보존 할백 머티리얼 생성
function createPreservedFallbackMaterial(originalData: OriginalBrushData, brushName: string): THREE.MeshStandardMaterial {
  const { color, opacity, properties } = originalData;
  
  console.log(`🎨 ${brushName} 원본 보존 할백 생성: 색상=${color.getHexString()}, 투명도=${opacity}`);
  
  return new THREE.MeshStandardMaterial({
    color: color.clone(),
    transparent: opacity < 1.0 || properties.side === THREE.DoubleSide,
    opacity: Math.max(opacity, 0.2),
    roughness: properties.roughness || 0.5,
    metalness: properties.metalness || 0.1,
    side: properties.side || THREE.FrontSide,
    emissive: color.clone().multiplyScalar(properties.emissiveIntensity || 0.05),
    alphaTest: opacity < 0.8 ? 0.1 : 0,
    depthWrite: opacity > 0.8,
    name: `${brushName}_Preserved_${color.getHexString()}`
  });
}

// 🔍 유니폼이 비어있는지 확인
function isUniformEmpty(value: unknown): boolean {
  if (!value) return true;
  if (Array.isArray(value)) return value.every(v => v === 0);
  if (typeof value === 'object' && value !== null && 'x' in value) {
    const vec = value as { x: number; y: number; z: number; w?: number };
    return vec.x === 0 && vec.y === 0 && vec.z === 0 && (vec.w === undefined || vec.w === 0);
  }
  return value === 0;
}

// 🔍 VR 익스포트 문제점 완전 진단 시스템
function diagnoseVRExportIssues(gltfScene: THREE.Object3D, modelPath: string) {
  console.log('🔍 === VR 익스포트 문제점 진단 시작 ===');
  console.log('작품 경로:', modelPath);
  
  interface DiagnosisData {
    작품정보: { 경로: string; 진단시각: string };
    전체통계: { 총메시수: number; 브러시메시수: number; 성공메시수: number; 실패메시수: number };
    브러시별상세: Record<string, {
      메시목록: string[];
      성공개수: number;
      실패개수: number;
      문제점: string[];
      유니폼분석: Record<string, Record<string, unknown>>;
      셰이더상태: Record<string, Record<string, unknown>>;
      지오메트리정보: Record<string, Record<string, unknown>>;
    }>;
    문제점목록: string[];
    VR수정가이드: string[];
  }
  
  const diagnosis: DiagnosisData = {
    작품정보: { 경로: modelPath, 진단시각: new Date().toISOString() },
    전체통계: { 총메시수: 0, 브러시메시수: 0, 성공메시수: 0, 실패메시수: 0 },
    브러시별상세: {},
    문제점목록: [],
    VR수정가이드: []
  };
  
  // 🔍 1단계: 모든 메시 탐색 및 브러시 분류
  gltfScene.traverse((child) => {
    diagnosis.전체통계.총메시수++;
    
    if (child instanceof THREE.Mesh && child.name.startsWith('brush_')) {
      diagnosis.전체통계.브러시메시수++;
      
      const brushName = child.name.split('_')[1] || 'Unknown';
      
      if (!diagnosis.브러시별상세[brushName]) {
        diagnosis.브러시별상세[brushName] = {
          메시목록: [],
          성공개수: 0,
          실패개수: 0,
          문제점: [],
          유니폼분석: {},
          셰이더상태: {},
          지오메트리정보: {}
        };
      }
      
      const brushData = diagnosis.브러시별상세[brushName];
      brushData.메시목록.push(child.name);
      
      // 🔍 지오메트리 분석
      brushData.지오메트리정보[child.name] = {
        타입: child.geometry.type,
        버텍스수: child.geometry.attributes.position?.count || 0,
        인덱스수: child.geometry.index?.count || 0,
        바운딩박스: child.geometry.boundingBox ? '있음' : '없음'
      };
      
      // 🔍 머티리얼 심층 분석
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach((material, index) => {
          const materialKey = `${child.name}[${index}]`;
          const materialWithUniforms = material as THREE.Material & { 
            uniforms?: Record<string, { value: unknown }>;
            vertexShader?: string;
            fragmentShader?: string;
            transparent?: boolean;
            blending?: THREE.Blending;
            depthTest?: boolean;
            depthWrite?: boolean;
            program?: unknown;
          };
          
          if (materialWithUniforms.type === 'RawShaderMaterial') {
            // 🔍 셰이더 머티리얼 완전 분석
            const shaderAnalysis = {
              타입: materialWithUniforms.type,
              유니폼개수: materialWithUniforms.uniforms ? Object.keys(materialWithUniforms.uniforms).length : 0,
              버텍스셰이더길이: materialWithUniforms.vertexShader ? materialWithUniforms.vertexShader.length : 0,
              프래그먼트셰이더길이: materialWithUniforms.fragmentShader ? materialWithUniforms.fragmentShader.length : 0,
              투명도: materialWithUniforms.transparent,
              혼합모드: materialWithUniforms.blending,
              깊이테스트: materialWithUniforms.depthTest,
              깊이쓰기: materialWithUniforms.depthWrite
            };
            
            brushData.셰이더상태[materialKey] = shaderAnalysis;
            
            // 🔍 유니폼 완전 분석
            if (materialWithUniforms.uniforms) {
              const uniformAnalysis: Record<string, unknown> = {};
              Object.entries(materialWithUniforms.uniforms).forEach(([name, uniform]) => {
                uniformAnalysis[name] = {
                  타입: typeof uniform.value,
                  값존재: uniform.value !== undefined && uniform.value !== null,
                  배열여부: Array.isArray(uniform.value),
                  객체여부: typeof uniform.value === 'object' && uniform.value !== null
                };
              });
              brushData.유니폼분석[materialKey] = uniformAnalysis;
              
              // 🚨 필수 유니폼 누락 검사
              const 필수유니폼들 = [
                'u_ambient_light_color', 'u_SceneLight_0_color', 'u_SceneLight_1_color',
                'u_Color', 'u_color', 'u_MainColor', 'u_BaseColor'
              ];
              
              const 누락된유니폼들 = 필수유니폼들.filter(name => !materialWithUniforms.uniforms![name]);
              
              if (누락된유니폼들.length > 0) {
                const 문제 = `${brushName} ${materialKey}: 필수 유니폼 누락 [${누락된유니폼들.join(', ')}]`;
                brushData.문제점.push(문제);
                diagnosis.문제점목록.push(문제);
              }
              
              // 🚨 빈 유니폼 값 검사
              Object.entries(materialWithUniforms.uniforms).forEach(([name, uniform]) => {
                if (isUniformEmpty(uniform.value)) {
                  const 문제 = `${brushName} ${materialKey}: 유니폼 '${name}' 값이 비어있음`;
                  brushData.문제점.push(문제);
                  diagnosis.문제점목록.push(문제);
                }
              });
            } else {
              const 문제 = `${brushName} ${materialKey}: 유니폼 객체 자체가 없음`;
              brushData.문제점.push(문제);
              diagnosis.문제점목록.push(문제);
            }
            
            // 셰이더 컴파일 상태 확인 (비동기)
            setTimeout(() => {
              if (materialWithUniforms.program) {
                brushData.성공개수++;
                diagnosis.전체통계.성공메시수++;
                console.log(`✅ ${brushName} 셰이더 컴파일 성공: ${materialKey}`);
              } else {
                brushData.실패개수++;
                diagnosis.전체통계.실패메시수++;
                const 문제 = `${brushName} ${materialKey}: 셰이더 컴파일 실패`;
                brushData.문제점.push(문제);
                diagnosis.문제점목록.push(문제);
                console.error(`❌ ${brushName} 셰이더 컴파일 실패: ${materialKey}`);
              }
            }, 300);
            
          } else {
            // 비-셰이더 머티리얼 (할백된 상태)
            brushData.성공개수++;
            diagnosis.전체통계.성공메시수++;
            
            brushData.셰이더상태[materialKey] = {
              타입: materialWithUniforms.type,
              할백상태: true,
              원본셰이더: '손실됨'
            };
          }
        });
      } else {
        const 문제 = `${brushName} ${child.name}: 머티리얼이 없음`;
        brushData.문제점.push(문제);
        diagnosis.문제점목록.push(문제);
      }
    }
  });
  
  // 🔍 2단계: VR 수정 가이드 생성
  setTimeout(() => {
    if (diagnosis.문제점목록.length > 0) {
      diagnosis.VR수정가이드.push('🚨 VR Unity GLB 익스포트 수정 필요 사항:');
      
      const 유니폼누락문제 = diagnosis.문제점목록.filter(p => p.includes('유니폼 누락'));
      if (유니폼누락문제.length > 0) {
        diagnosis.VR수정가이드.push('1. 브러시 셰이더에 필수 조명 유니폼 추가 확인');
        diagnosis.VR수정가이드.push('   - u_ambient_light_color, u_SceneLight_0_color 등');
      }
      
      const 빈값문제 = diagnosis.문제점목록.filter(p => p.includes('값이 비어있음'));
      if (빈값문제.length > 0) {
        diagnosis.VR수정가이드.push('2. 브러시 머티리얼 속성값 초기화 확인');
        diagnosis.VR수정가이드.push('   - 색상, 투명도 등 기본값 설정');
      }
      
      const 컴파일실패문제 = diagnosis.문제점목록.filter(p => p.includes('컴파일 실패'));
      if (컴파일실패문제.length > 0) {
        diagnosis.VR수정가이드.push('3. Three-Icosa 호환 셰이더 코드 확인');
        diagnosis.VR수정가이드.push('   - GLSL 버전 호환성, 예약어 사용 등');
      }
      
    } else {
      diagnosis.VR수정가이드.push('✅ VR 익스포트 품질: 문제 없음');
    }
    
    // 🔍 3단계: 최종 진단 리포트 출력
    console.log('\n📊 === VR 익스포트 진단 완료 ===');
    console.log('전체 통계:', diagnosis.전체통계);
    console.log('브러시별 상세:', diagnosis.브러시별상세);
    console.log('\n🚨 발견된 문제점들:');
    diagnosis.문제점목록.forEach((문제, index) => {
      console.log(`${index + 1}. ${문제}`);
    });
    console.log('\n💡 VR Unity 수정 가이드:');
    diagnosis.VR수정가이드.forEach(가이드 => {
      console.log(가이드);
    });
    
    // 글로벌 변수로 진단 결과 저장
    (window as any).vrExportDiagnosis = diagnosis;
    console.log('\n💾 진단 결과가 window.vrExportDiagnosis에 저장됨');
    
  }, 600);
}

// 🎯 기존 범용 브러시 처리 시스템 (간소화)
function processAllBrushes(gltfScene: THREE.Object3D, modelPath: string) {
  console.log('🎨 범용 브러시 처리 시스템 시작');
  
  let totalProcessed = 0;
  let successfulCompiles = 0;
  let fallbackApplied = 0;
  
  gltfScene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name.startsWith('brush_')) {
      const brushName = child.name.split('_')[1] || 'Unknown';
      totalProcessed++;
      
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach((material, index) => {
          const materialWithUniforms = material as THREE.Material & { 
            uniforms?: Record<string, { value: unknown }>;
            needsUpdate?: boolean;
            program?: unknown;
          };
          
          if (materialWithUniforms.type === 'RawShaderMaterial' && materialWithUniforms.uniforms) {
            const originalData = extractOriginalBrushData(materialWithUniforms, `${child.name}[${index}]`, brushName);
            
            // 기본 유니폼 보강 (필요한 경우만)
            const lightUniforms = {
              u_ambient_light_color: [0.4, 0.4, 0.4, 1.0],
              u_SceneLight_0_color: [1.0, 1.0, 1.0, 1.0],
              u_SceneLight_1_color: [0.6, 0.6, 0.6, 1.0]
            };
            
            Object.entries(lightUniforms).forEach(([name, defaultValue]) => {
              if (!materialWithUniforms.uniforms![name] || isUniformEmpty(materialWithUniforms.uniforms![name].value)) {
                materialWithUniforms.uniforms![name] = { value: new THREE.Vector4(...defaultValue) };
                console.log(`🆕 ${brushName} ${name} 보강됨`);
              }
            });
            
            materialWithUniforms.needsUpdate = true;
            
            // 셰이더 컴파일 검증 및 할백
            setTimeout(() => {
              if (!materialWithUniforms.program) {
                console.log(`🔄 ${brushName} 셰이더 실패 - 원본 보존 할백 적용`);
                
                const preservedMaterial = createPreservedFallbackMaterial(originalData, brushName);
                
                if (Array.isArray(child.material)) {
                  child.material[index] = preservedMaterial;
                } else {
                  child.material = preservedMaterial;
                }
                
                fallbackApplied++;
                console.log(`✨ ${brushName} 원본 보존 할백 완료: ${originalData.color.getHexString()}`);
              } else {
                successfulCompiles++;
                console.log(`🟢 ${brushName} 셰이더 컴파일 성공`);
              }
            }, 200);
          }
        });
      }
    }
  });
  
  setTimeout(() => {
    console.log(`📊 범용 브러시 처리 완료:`, {
      전체처리: totalProcessed,
      셰이더성공: successfulCompiles,
      할백적용: fallbackApplied,
      성공률: `${Math.round((successfulCompiles / totalProcessed) * 100)}%`
    });
  }, 500);
  
  // 🔍 VR 익스포트 진단 실행
  diagnoseVRExportIssues(gltfScene, modelPath);
}

interface DesktopViewerProps {
  modelPath: string;
  artwork?: ArtworkResponse | null;
  onLoadComplete?: () => void;
  onLoadError?: (error: string) => void;
  autoRotate?: boolean;
  rotationSpeed?: number;
}

export default function DesktopViewer({ 
  modelPath, 
  artwork,
  onLoadComplete, 
  onLoadError,
  autoRotate = true,
  rotationSpeed = 0.05
}: DesktopViewerProps) {
  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('3D 뷰어 초기화 중...');
  
  const [showPromoHeader, setShowPromoHeader] = useState<boolean>(true);
  const [showArtistInfo, setShowArtistInfo] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [backgroundDark, setBackgroundDark] = useState<boolean>(true); // 배경색 상태 (true: 검은색, false: 흰색)
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onLoadErrorRef = useRef(onLoadError);
  
  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));

  // 콜백 함수들을 ref로 업데이트
  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete;
    onLoadErrorRef.current = onLoadError;
  }, [onLoadComplete, onLoadError]);

  const loadModelForDesktop = useCallback(async (scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) => {
    try {
      const loader = new GLTFLoader();
      let threeIcosaLoaded = false;
      
      // 🔧 Three-Icosa 확장자 등록 (개선된 에러 처리)
      try {
        const { GLTFGoogleTiltBrushMaterialExtension } = await import('three-icosa');
        const assetUrl = 'https://raw.githubusercontent.com/icosa-foundation/three-icosa/main/brushes/';
        loader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, assetUrl));
        threeIcosaLoaded = true;
        console.log('✅ Three-Icosa 확장자 등록 성공 - 전체 브러시 라이브러리 사용');
      } catch (icosaError) {
        console.warn('⚠️ Three-Icosa 로드 실패:', icosaError);
        console.warn('📋 기본 GLB 로더만 사용합니다.');
        threeIcosaLoaded = false;
      }

      const gltf = await loader.loadAsync(modelPath, (progress) => {
        if (progress.total > 0) {
          const percent = Math.min(Math.round((progress.loaded / progress.total) * 100), 99);
          setDebugInfo(`모델 로딩... ${percent}%`);
        }
      });
      
      // 🔧 모델 구조 상세 분석
      console.log('🎯 GLB 모델 분석 시작');
      console.log('📦 GLTF Scene:', gltf.scene);
      console.log('👥 Children 수:', gltf.scene.children.length);
      
      // 모든 Mesh 요소 찾기 및 분석
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child);
          console.log('🔍 Mesh 발견:', {
            name: child.name,
            position: child.position,
            scale: child.scale,
            visible: child.visible,
            geometryType: child.geometry.type,
            materialType: child.material ? (Array.isArray(child.material) ? child.material.map(m => m.type) : child.material.type) : 'none'
          });
        }
      });
      
      console.log(`📊 총 ${meshes.length}개의 Mesh 발견`);
      console.log(`🌨️ Three-Icosa 사용: ${threeIcosaLoaded ? 'YES' : 'NO'} - ${threeIcosaLoaded ? '브러시 머티리얼 사용' : '기본 GLB 로더 사용'}`);
      
      // === 📊 작품 브러시 분석 시작 ===
      console.log('=== 📊 작품 브러시 분석 시작 ===');
      console.log('현재 작품 경로:', modelPath);
      
      const brushAnalysis = {
        총메시수: 0,
        브러시별통계: {} as Record<string, {
          개수: number;
          메시목록: string[];
          머티리얼타입: string[];
          렌더링상태: boolean[];
        }>,
        전체브러시목록: [] as Array<{
          메시이름: string;
          브러시: string;
          머티리얼: string;
          표시상태: boolean;
        }>
      };
      
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          brushAnalysis.총메시수++;
          
          // 브러시 이름 추출 (brush_BRUSHNAME_g0_b0 패턴에서)
          let brushName = 'unknown';
          if (child.name.startsWith('brush_')) {
            const parts = child.name.split('_');
            if (parts.length >= 2) {
              brushName = parts[1];
            }
          }
          
          // 브러시별 통계
          if (!brushAnalysis.브러시별통계[brushName]) {
            brushAnalysis.브러시별통계[brushName] = {
             개수: 0,
             메시목록: [],
             머티리얼타입: [],
             렌더링상태: []
           };
         }
         
         const brushData = brushAnalysis.브러시별통계[brushName];
         brushData.개수++;
         brushData.메시목록.push(child.name);
         brushData.렌더링상태.push(child.visible);
         
         const materialType = child.material ? (Array.isArray(child.material) ? child.material.map(m => m.type).join('+') : child.material.type) : 'none';
         if (!brushData.머티리얼타입.includes(materialType)) {
           brushData.머티리얼타입.push(materialType);
         }
         
         // 상세 정보 로깅
         console.log(`🎨 ${child.name}:`, {
           브러시: brushName,
           머티리얼: materialType,
           버텍스: child.geometry?.attributes?.position?.count || 0,
           표시: child.visible,
           투명도: child.material ? (Array.isArray(child.material) ? child.material[0]?.opacity : (child.material as any)?.opacity) : undefined,
           위치: {
             x: parseFloat(child.position.x.toFixed(2)),
             y: parseFloat(child.position.y.toFixed(2)), 
             z: parseFloat(child.position.z.toFixed(2))
           },
           유니폼수: (child.material as any)?.uniforms ? Object.keys((child.material as any).uniforms).length : 0
         });
         
         brushAnalysis.전체브러시목록.push({
           메시이름: child.name,
           브러시: brushName,
           머티리얼: materialType,
           표시상태: child.visible
         });
       }
     });
     
     console.log('📈 브러시 사용 통계:', brushAnalysis.브러시별통계);
     console.log('🎯 Three-icosa 활성화:', threeIcosaLoaded ? 'YES' : 'NO');
     console.log('📋 전체 브러시 목록:', brushAnalysis.전체브러시목록);
     console.log('=== 📊 브러시 분석 완료 ===');
     
     // 🔧 강화된 조명 시스템 추가 (항상 추가)
     // 기존 조명 제거
     const existingLights = scene.children.filter(child => 
       child instanceof THREE.Light || 
       child instanceof THREE.AmbientLight || 
       child instanceof THREE.DirectionalLight
     );
     existingLights.forEach(light => scene.remove(light));
     
     // 새로운 조명 시스템
     const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 주변광
     scene.add(ambientLight);
     
     const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
     directionalLight1.position.set(10, 10, 5);
     scene.add(directionalLight1);
     
     const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
     directionalLight2.position.set(-10, -10, -5);
     scene.add(directionalLight2);
     
     console.log('💡 강화된 조명 시스템 추가됨');
     
     // 🔧 모델을 씬에 추가
     scene.add(gltf.scene);
     
     // 🎨 범용 브러시 원본 데이터 보존 시스템 적용
     processAllBrushes(gltf.scene, modelPath);
     
     // 🔧 향상된 바운딩 박스 계산
     let box = new THREE.Box3().setFromObject(gltf.scene);
     
     // 바운딩 박스가 유효하지 않은 경우 개별 Mesh로 계산
     if (box.isEmpty() || !isFinite(box.min.x) || !isFinite(box.min.y) || !isFinite(box.min.z) || 
         !isFinite(box.max.x) || !isFinite(box.max.y) || !isFinite(box.max.z)) {
       console.warn('⚠️ 전체 바운딩 박스 계산 실패, 개별 Mesh로 재계산');
       box = new THREE.Box3();
       meshes.forEach(mesh => {
         const meshBox = new THREE.Box3().setFromObject(mesh);
         if (!meshBox.isEmpty()) {
           box.union(meshBox);
         }
       });
     }
     
     // 여전히 비어있다면 기본값 사용
     if (box.isEmpty()) {
       console.warn('⚠️ 모든 바운딩 박스 계산 실패, 기본값 사용');
       box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2));
     }
     
     const center = box.getCenter(new THREE.Vector3());
     const size = box.getSize(new THREE.Vector3());
     
     console.log('📊 최종 바운딩 정보:', {
       center: center,
       size: size,
       isEmpty: box.isEmpty()
     });
     
     // 🔧 카메라 설정 최적화 - 온라인 GLTF 뷰어 방식
     controls.target.copy(center);
     
     const maxDimension = Math.max(size.x, size.y, size.z);
     
     // 🎯 온라인 뷰어 방식의 카메라 거리 계산
     const fov = camera.fov * Math.PI / 180; // FOV를 라디안으로 변환
     const distance = maxDimension / (2 * Math.tan(fov / 2)) * 1.8; // 1.8은 여유공간
     
     console.log(`📷 온라인 뷰어 방식 카메라 설정: maxDim=${maxDimension}, distance=${distance}, fov=${camera.fov}°`);
     
     // 카메라를 모델 앞쪽 대각선에 배치 (온라인 뷰어 기본 위치)
     camera.position.set(
       center.x + distance * 0.7,  // x축으로 약간 옆에서
       center.y + distance * 0.5,  // y축으로 약간 위에서
       center.z + distance * 0.7   // z축으로 앞쪽에서
     );
     
     camera.lookAt(center);
     
     // 🔧 카메라 near/far 최적화 (온라인 뷰어 방식)
     camera.near = Math.max(0.01, distance / 100);
     camera.far = distance * 100;
     camera.updateProjectionMatrix();
     
     // 🔧 OrbitControls 설정 최적화
     controls.minDistance = distance * 0.1;
     controls.maxDistance = distance * 10;
     controls.update();
     
     console.log('✅ 카메라 및 컨트롤 설정 완료');
     
     // 🔧 모델 가시성 기본 설정
     let visibleMeshCount = 0;
     
     gltf.scene.traverse((child) => {
       if (child instanceof THREE.Mesh) {
         child.visible = true;
         child.frustumCulled = false;
         visibleMeshCount++;
         
         if (child.material) {
           const materials = Array.isArray(child.material) ? child.material : [child.material];
           materials.forEach(material => {
             if (material instanceof THREE.MeshStandardMaterial || 
                 material instanceof THREE.MeshBasicMaterial) {
               material.transparent = material.transparent || false;
               material.opacity = Math.max(material.opacity || 1, 0.1);
               material.visible = true;
             }
           });
         }
       }
     });
     
     console.log(`👁️ 총 ${visibleMeshCount}개 메시 활성화`);
     
     // 🔧 최종 렌더링 확인
     setTimeout(() => {
       let renderingMeshes = 0;
       scene.traverse((child) => {
         if (child instanceof THREE.Mesh && child.visible) {
           renderingMeshes++;
         }
       });
       console.log(`🎬 최종 렌더링 상태: ${renderingMeshes}개 메시가 렌더링 대상`);
       
       if (renderingMeshes === 0) {
         console.error(`🚨 렌더링 중인 메시가 없습니다!`);
       }
     }, 500);
     
     setDebugInfo(`모델 로딩 완료! Meshes: ${meshes.length}, ${threeIcosaLoaded ? '(Tilt Brush)' : ''}`);
     
   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
     console.error('❌ 모델 로딩 상세 오류:', error);
     setDebugInfo(`모델 로딩 실패: ${errorMessage}`);
     throw error;
   }
 }, [modelPath]);

 const initializeDesktop3D = useCallback(() => {
   let resizeHandler: (() => void) | null = null;
   try {
     console.log('🖥️ 순수 3D 뷰어 초기화 시작');
     setDebugInfo('3D 씬 초기화 중...');
     
     if (!containerRef.current) throw new Error('Container not found');
     
     const container = containerRef.current;
     container.innerHTML = '';
     
     const scene = new THREE.Scene();
     scene.background = new THREE.Color(0x000000); // 기본은 검은색으로 고정
     sceneRef.current = scene;
     
     const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
     scene.add(camera);
     
     camera.position.set(1, 1, 1);
     
     const renderer = new THREE.WebGLRenderer({ antialias: true });
     renderer.setSize(window.innerWidth, window.innerHeight);
     renderer.setPixelRatio(window.devicePixelRatio);
     container.appendChild(renderer.domElement);
     rendererRef.current = renderer;

     const controls = new OrbitControls(camera, renderer.domElement);
     controls.enableDamping = true;
     controls.dampingFactor = 0.05;
     controls.autoRotate = autoRotate;
     controls.autoRotateSpeed = rotationSpeed * 5;

     loadModelForDesktop(scene, camera, controls)
       .then(() => {
         setStatus('active');
         if (onLoadCompleteRef.current) onLoadCompleteRef.current();
       })
       .catch((e: unknown) => { 
         setStatus('error'); 
         const errorMsg = e instanceof Error ? e.message : String(e);
         setErrorMessage(errorMsg);
         if (onLoadErrorRef.current) onLoadErrorRef.current(errorMsg);
       });

     const animate = () => {
       animationFrameRef.current = requestAnimationFrame(animate);
       controls.update();
       renderer.render(scene, camera);
     };
     animate();

     resizeHandler = () => {
       if (!rendererRef.current || !containerRef.current) return;
       camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
       camera.updateProjectionMatrix();
       rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
     };
     window.addEventListener('resize', resizeHandler);

   } catch (error) {
     const errorMsg = error instanceof Error ? error.message : String(error);
     setErrorMessage(errorMsg);
     setStatus('error');
     if (onLoadErrorRef.current) onLoadErrorRef.current(errorMsg);
   }
   
   return () => {
     if (resizeHandler) {
       window.removeEventListener('resize', resizeHandler);
     }
   };
 }, [autoRotate, rotationSpeed, loadModelForDesktop]); // 최소한의 의존성만 유지

 useEffect(() => {
   if (initializationRef.current) return;
   initializationRef.current = true;
   
   const currentRenderId = renderIdRef.current;
   const currentContainer = containerRef.current;
   console.log(`✅ DesktopViewer 초기화 시작 [${currentRenderId}]`);
   const cleanupResize = initializeDesktop3D();

   return () => {
     console.log(`🧹 DesktopViewer 정리 [${currentRenderId}]`);
     if (cleanupResize) cleanupResize();

     if (animationFrameRef.current) {
       cancelAnimationFrame(animationFrameRef.current);
       animationFrameRef.current = null;
     }
     
     const scene = sceneRef.current;
     if (scene) {
       scene.traverse(object => {
         if (object instanceof THREE.Mesh) {
           object.geometry?.dispose();
           const materials = Array.isArray(object.material) ? object.material : [object.material];
           materials.forEach(material => material?.dispose());
         }
       });
     }
     sceneRef.current = null;

     if (rendererRef.current) {
       rendererRef.current.dispose();
       rendererRef.current.forceContextLoss();
       rendererRef.current = null;
     }
     if (currentContainer) {
       currentContainer.innerHTML = '';
     }
     
     initializationRef.current = false;
   };
 }, [initializeDesktop3D]);

 // 배경색 변경 효과
 useEffect(() => {
   console.log('🌌 배경색 변경 useEffect 실행, backgroundDark:', backgroundDark);
   if (sceneRef.current) {
     const color = backgroundDark ? 0x000000 : 0xd3c7b8; // 검은색 또는 어두운 베이지 (dark beige)
     console.log('🎭 Three.js 씬 배경 변경:', backgroundDark ? '검은색 (0x000000)' : '어두운 베이지 (0xd3c7b8)');
     sceneRef.current.background = new THREE.Color(color);
   } else {
     console.log('⚠️ sceneRef.current가 null입니다!');
   }
 }, [backgroundDark]);

 // 토글 함수
 const toggleBackground = () => {
   console.log('🎨 배경색 토글 버튼 클릭됨!');
   console.log('현재 backgroundDark:', backgroundDark);
   setBackgroundDark(prev => {
     console.log('backgroundDark 변경:', prev, '->', !prev);
     return !prev;
   });
 };

 // 🔧 공유 링크 복사 함수
 const handleCopyLink = async () => {
   try {
     const currentUrl = window.location.href;
     await navigator.clipboard.writeText(currentUrl);
     setCopySuccess(true);
     setTimeout(() => setCopySuccess(false), 2000);
   } catch (error) {
     console.error('클립보드 복사 실패:', error);
     // 폴백: 텍스트 선택
     const textArea = document.createElement('textarea');
     textArea.value = window.location.href;
     document.body.appendChild(textArea);
     textArea.select();
     document.execCommand('copy');
     document.body.removeChild(textArea);
     setCopySuccess(true);
     setTimeout(() => setCopySuccess(false), 2000);
   }
 };

 return (
   <div className="absolute inset-0 w-full h-full">
     <div 
       ref={containerRef}
       className="absolute inset-0 w-full h-full"
       style={{ backgroundColor: backgroundDark ? '#000000' : '#d3c7b8' }}
     />
     
     {/* 🔧 프로모션 헤더 (상단) */}
     {showPromoHeader && (
       <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-3 z-50 shadow-lg">
         <div className="flex justify-between items-center max-w-7xl mx-auto">
           <div className="flex items-center space-x-3">
             <div className="text-2xl">🎨</div>
             <div>
               <p className="font-bold text-lg">BAUhaus AR 앱이 8월에 공개됩니다!</p>
               <p className="text-sm opacity-90">VR로 그린 3D 작품을 AR로 감상하는 새로운 경험을 만나보세요</p>
             </div>
           </div>
           <button 
             onClick={() => setShowPromoHeader(false)}
             className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
           >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
         </div>
       </div>
     )}
     
     {/* 로딩 */}
     {status === 'loading' && (
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
     
     {/* 🔧 작품 정보 (왼쪽 하단으로 변경, 실제 데이터 사용) */}
     {status === 'active' && artwork && (
       <div className="absolute bottom-6 left-4 md:left-6 bg-black/70 backdrop-blur-md text-white p-3 md:p-4 rounded-xl z-10 max-w-xs md:max-w-md">
         <div className="text-left">
           <h2 className="font-bold text-lg md:text-xl mb-1 md:mb-2">{artwork.title}</h2>
           {artwork.description && (
             <p className="text-xs md:text-sm opacity-75 mb-2 md:mb-3 leading-relaxed line-clamp-2">
               {artwork.description}
             </p>
           )}
           <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm">
             <div className="flex items-center gap-1 md:gap-2">
               <span className="text-red-400">❤️</span>
               <span>{artwork.favoriteCount?.toLocaleString() || 0}</span>
             </div>
             <div className="flex items-center gap-1 md:gap-2">
               <span className="text-blue-400">👁️</span>
               <span>{artwork.viewCount?.toLocaleString() || 0}</span>
             </div>
           </div>
         </div>
       </div>
     )}
     
     {/* 🔧 배경색 토글 버튼 (오른쪽 상단) */}
     {status === 'active' && (
       <div className="fixed top-6 right-6 z-30">
         <button 
           onClick={() => {
             console.log('🔵 버튼 onClick 호출됨!');
             toggleBackground();
           }}
           className="bg-white/20 backdrop-blur-md text-white p-3 rounded-full hover:bg-white/30 transition-all duration-200 shadow-lg"
           title={backgroundDark ? '밝은 배경으로 변경' : '검은색 배경으로 변경'}
         >
           {backgroundDark ? (
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
             </svg>
           ) : (
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
             </svg>
           )}
         </button>
       </div>
     )}
     
     {/* 🔧 플로팅 버튼들 (오른쪽 하단) - 모바일에서 세로 배치, 데스크톱에서 세로 배치 */}
     {status === 'active' && (
       <div className="fixed bottom-6 right-4 md:right-6 z-20">
         {/* 모바일: 두 버튼을 가로로 배치, 데스크톱: 세로로 배치 */}
         <div className="flex flex-row md:flex-col gap-2 md:gap-3">
           <button 
             onClick={() => setShowShareModal(true)}
             className="bg-black/70 backdrop-blur-md text-white px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl hover:bg-black/90 transition-all duration-200 shadow-lg flex-1 md:flex-none"
           >
             <div className="flex items-center justify-center md:justify-start space-x-0 md:space-x-2">
               <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
               </svg>
               <span className="hidden md:inline text-sm">공유하기</span>
             </div>
           </button>
           
           <button 
             onClick={() => setShowArtistInfo(true)}
             className="bg-black/70 backdrop-blur-md text-white px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl hover:bg-black/90 transition-all duration-200 shadow-lg flex-1 md:flex-none"
           >
             <div className="flex items-center justify-center md:justify-start space-x-0 md:space-x-2">
               <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
               </svg>
               <span className="hidden md:inline text-sm">작가정보</span>
             </div>
           </button>
         </div>
       </div>
     )}
     
     {/* 🔧 작가 정보 모달 (실제 데이터 사용) */}
     {showArtistInfo && artwork && (
       <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
         <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
           <div className="text-center">
             {/* 🎯 프로필 이미지: 실제 S3 이미지 로딩 및 폴백 처리 */}
             <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
               {artwork.user.profileImageUrl ? (
                 // eslint-disable-next-line @next/next/no-img-element
                 <img 
                   src={artwork.user.profileImageUrl} 
                   alt={`${artwork.user.nickname}의 프로필`}
                   className="w-full h-full object-cover"
                   onError={(e) => {
                     // 🎯 S3 이미지 로드 실패 시 기본 아바타로 폴백
                     console.log('프로필 이미지 로드 실패, 기본 아바타로 폴백:', artwork.user.profileImageUrl);
                     const target = e.target as HTMLImageElement;
                     target.style.display = 'none';
                     const parent = target.parentElement;
                     if (parent) {
                       const fallbackElement = parent.querySelector('.fallback-avatar') as HTMLElement;
                       if (fallbackElement) {
                         fallbackElement.style.display = 'flex';
                       }
                     }
                   }}
                   onLoad={() => {
                     console.log('프로필 이미지 로드 성공:', artwork.user.profileImageUrl);
                   }}
                 />
               ) : null}
               <div className={`fallback-avatar absolute inset-0 w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center ${
                 artwork.user.profileImageUrl ? 'hidden' : 'flex'
               }`}>
                 <span className="text-white text-2xl font-bold">
                   {artwork.user.nickname.charAt(0).toUpperCase()}
                 </span>
               </div>
             </div>
             
             <h3 className="text-xl font-bold text-gray-800 mb-2">{artwork.user.nickname}</h3>
             <p className="text-gray-600 mb-4">VR 3D 아티스트</p>
             
             <div className="bg-gray-50 rounded-lg p-3 mb-4 text-left">
               <h4 className="font-semibold text-gray-800 mb-2">작가 소개</h4>
               <div className="text-sm text-gray-600">
                 {/* 🎯 실제 작가 bio 데이터 사용 */}
                 {artwork.user.bio ? (
                   <p className="leading-relaxed">{artwork.user.bio}</p>
                 ) : (
                   <p className="text-gray-400 italic">소개글이 없습니다.</p>
                 )}
               </div>
             </div>
             
             <div className="space-y-3">
               <button 
                 onClick={() => setShowArtistInfo(false)}
                 className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors"
               >
                 닫기
               </button>
             </div>
           </div>
         </div>
       </div>
     )}
     
     {/* 🔧 공유하기 모달 */}
     {showShareModal && (
       <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
         <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
           <div className="text-center">
             <div className="text-4xl mb-4">🔗</div>
             <h3 className="text-xl font-bold text-gray-800 mb-2">작품 공유하기</h3>
             <p className="text-gray-600 mb-4">이 링크를 복사하여 친구들과 공유해보세요</p>
             
             <div className="bg-gray-100 p-3 rounded-lg mb-4 break-all text-sm text-gray-700">
               {window.location.href}
             </div>
             
             <div className="space-y-3">
               <button 
                 onClick={handleCopyLink}
                 className={`w-full py-2 px-4 rounded-lg transition-all ${
                   copySuccess 
                     ? 'bg-green-500 text-white' 
                     : 'bg-blue-500 hover:bg-blue-600 text-white'
                 }`}
               >
                 {copySuccess ? (
                   <div className="flex items-center justify-center space-x-2">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                     </svg>
                     <span>복사 완료!</span>
                   </div>
                 ) : (
                   <div className="flex items-center justify-center space-x-2">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                     </svg>
                     <span>링크 복사</span>
                   </div>
                 )}
               </button>
               
               <button 
                 onClick={() => setShowShareModal(false)}
                 className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
               >
                 닫기
               </button>
             </div>
           </div>
           </div>
       </div>
     )}
   </div>
 );
}