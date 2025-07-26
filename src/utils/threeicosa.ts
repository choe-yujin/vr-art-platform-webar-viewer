/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';

/**
 * Three-Icosa 브러시 처리 유틸리티
 * Tilt Brush VR 아트웍의 특수 브러시 효과를 Three.js에서 렌더링
 */

// Tilt Brush 브러시 타입 정의
interface BrushDescriptor {
  name: string;
  guid: string;
  material?: any;
  vertexShader?: string;
  fragmentShader?: string;
  transparent?: boolean;
  blending?: THREE.Blending;
  side?: THREE.Side;
}

// 기본 브러시 디스크립터들
const BRUSH_DESCRIPTORS: { [key: string]: BrushDescriptor } = {
  // 기본 브러시들
  'ink': {
    name: 'Ink',
    guid: '25e3e6e2-0b1b-4308-8a8a-5d5b8e8f8c9a',
    transparent: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide
  },
  'marker': {
    name: 'Marker',
    guid: 'd229d335-c334-495a-a801-660ac51a719b',
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  },
  'thick_paint': {
    name: 'ThickPaint',
    guid: 'f72ec0e7-a844-4e38-82e3-140c44772699',
    transparent: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide
  },
  'light': {
    name: 'Light',
    guid: '2d35b797-e15e-4e0c-8b8d-8e8f8c9a0b1b',
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  },
  'fire': {
    name: 'Fire',
    guid: '0e87b49c-6546-3a34-3a44-8a556d7d6c3e',
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  },
  'snow': {
    name: 'Snow',
    guid: 'd902ed8b-d0d1-476c-a8de-878a79e3a34c',
    transparent: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide
  },
  'smoke': {
    name: 'Smoke',
    guid: '70d79cca-b159-4f35-990c-f02193947fe8',
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  },
  'electricity': {
    name: 'Electricity',
    guid: 'f6e85de3-6dcc-4e7f-87fd-cee8c3d25d51',
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  },
  'hypercolor': {
    name: 'Hypercolor',
    guid: 'dea67637-cd1a-27e4-8fc1-d7e2cd3d2075',
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  },
  'splatter': {
    name: 'Splatter',
    guid: '8a60a6a2-2048-4d7e-afe6-c4c9b8c2b3f3',
    transparent: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide
  }
};

/**
 * 브러시 이름에서 적절한 머티리얼 설정을 찾아 반환
 */
function getBrushDescriptor(brushName: string): BrushDescriptor | null {
  // 정확한 이름 매칭
  if (BRUSH_DESCRIPTORS[brushName]) {
    return BRUSH_DESCRIPTORS[brushName];
  }
  
  // 부분 매칭 (대소문자 무시)
  const lowerBrushName = brushName.toLowerCase();
  for (const [key, descriptor] of Object.entries(BRUSH_DESCRIPTORS)) {
    if (key.includes(lowerBrushName) || lowerBrushName.includes(key)) {
      return descriptor;
    }
  }
  
  // GUID로 매칭 시도
  for (const descriptor of Object.values(BRUSH_DESCRIPTORS)) {
    if (descriptor.guid === brushName) {
      return descriptor;
    }
  }
  
  return null;
}

/**
 * 기본 PBR 머티리얼 생성
 */
function createBasicMaterial(color: THREE.Color = new THREE.Color(0x808080)): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.1,
    roughness: 0.7,
    transparent: false,
    side: THREE.FrontSide,
    vertexColors: true // 정점 색상 사용
  });
}

/**
 * 브러시 타입에 따른 특수 머티리얼 생성
 */
function createBrushMaterial(descriptor: BrushDescriptor, baseColor: THREE.Color): THREE.Material {
  const commonProps = {
    color: baseColor,
    vertexColors: true,
    transparent: descriptor.transparent ?? false,
    side: descriptor.side ?? THREE.FrontSide,
    blending: descriptor.blending ?? THREE.NormalBlending
  };
  
  switch (descriptor.name.toLowerCase()) {
    case 'light':
    case 'fire':
    case 'electricity':
    case 'hypercolor':
      // 발광 효과가 있는 브러시들
      return new THREE.MeshBasicMaterial({
        ...commonProps,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.8
      });
      
    case 'smoke':
    case 'snow':
      // 반투명 파티클 브러시들
      return new THREE.MeshLambertMaterial({
        ...commonProps,
        transparent: true,
        opacity: 0.6,
        blending: THREE.NormalBlending
      });
      
    case 'marker':
    case 'splatter':
      // 반투명 페인트 브러시들
      return new THREE.MeshLambertMaterial({
        ...commonProps,
        transparent: true,
        opacity: 0.7
      });
      
    case 'ink':
    case 'thick_paint':
    default:
      // 기본 불투명 브러시들
      return new THREE.MeshStandardMaterial({
        ...commonProps,
        metalness: 0.1,
        roughness: 0.8,
        transparent: false
      });
  }
}

/**
 * 메쉬의 정점 색상 설정
 */
function setupVertexColors(mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  
  if (!geometry.attributes.color && geometry.attributes.position) {
    const positionCount = geometry.attributes.position.count;
    const colors = new Float32Array(positionCount * 3);
    
    // 기본 흰색으로 설정
    for (let i = 0; i < positionCount; i++) {
      colors[i * 3] = 1.0;     // R
      colors[i * 3 + 1] = 1.0; // G
      colors[i * 3 + 2] = 1.0; // B
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
}

/**
 * 단일 메쉬에 브러시 효과 적용
 */
function processBrushMesh(mesh: THREE.Mesh): boolean {
  try {
    const meshName = mesh.name || '';
    const materialName = Array.isArray(mesh.material) 
      ? mesh.material[0]?.name || ''
      : mesh.material?.name || '';
    
    // 브러시 정보 추출 시도
    let brushName = '';
    
    // 1. 메쉬 이름에서 브러시 정보 찾기
    const nameMatch = meshName.match(/brush_(\w+)/i);
    if (nameMatch) {
      brushName = nameMatch[1];
    }
    
    // 2. 머티리얼 이름에서 브러시 정보 찾기
    if (!brushName) {
      const matMatch = materialName.match(/(\w+)_brush/i) || materialName.match(/brush_(\w+)/i);
      if (matMatch) {
        brushName = matMatch[1];
      }
    }
    
    // 3. GUID 패턴 찾기
    if (!brushName) {
      const guidMatch = (meshName + materialName).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (guidMatch) {
        brushName = guidMatch[0];
      }
    }
    
    // 브러시 디스크립터 찾기
    const descriptor = brushName ? getBrushDescriptor(brushName) : null;
    
    // 현재 머티리얼 색상 추출
    let baseColor = new THREE.Color(0x808080);
    const currentMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (currentMaterial && 'color' in currentMaterial) {
      baseColor = (currentMaterial as any).color.clone();
    }
    
    // 정점 색상 설정
    setupVertexColors(mesh);
    
    // 새 머티리얼 적용
    if (descriptor) {
      console.log(`🎨 브러시 "${descriptor.name}" 적용: ${meshName}`);
      mesh.material = createBrushMaterial(descriptor, baseColor);
    } else {
      console.log(`📦 기본 머티리얼 적용: ${meshName}`);
      mesh.material = createBasicMaterial(baseColor);
    }
    
    // 메쉬 설정 최적화
    mesh.frustumCulled = false;
    mesh.visible = true;
    
    // 기하학 업데이트
    if (mesh.geometry.boundingBox === null) {
      mesh.geometry.computeBoundingBox();
    }
    if (mesh.geometry.boundingSphere === null) {
      mesh.geometry.computeBoundingSphere();
    }
    
    return true;
    
  } catch (error) {
    console.warn('⚠️ 브러시 메쉬 처리 실패:', mesh.name, error);
    return false;
  }
}

/**
 * 씬의 모든 브러시를 처리
 */
export function processAllBrushes(rootObject: THREE.Object3D): { processed: number; failed: number } {
  let processed = 0;
  let failed = 0;
  
  console.log('🎨 Three-Icosa 브러시 처리 시작...');
  
  rootObject.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      try {
        const success = processBrushMesh(child);
        if (success) {
          processed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.warn('⚠️ 메쉬 처리 중 오류:', child.name, error);
        failed++;
      }
    }
  });
  
  console.log(`✅ 브러시 처리 완료: ${processed}개 성공, ${failed}개 실패`);
  
  return { processed, failed };
}

/**
 * 특정 브러시 타입만 처리
 */
export function processSpecificBrush(rootObject: THREE.Object3D, targetBrushName: string): number {
  let processed = 0;
  
  rootObject.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const meshName = child.name || '';
      const materialName = Array.isArray(child.material) 
        ? child.material[0]?.name || ''
        : child.material?.name || '';
      
      // 타겟 브러시인지 확인
      const hasTargetBrush = meshName.toLowerCase().includes(targetBrushName.toLowerCase()) ||
                           materialName.toLowerCase().includes(targetBrushName.toLowerCase());
      
      if (hasTargetBrush) {
        try {
          processBrushMesh(child);
          processed++;
        } catch (error) {
          console.warn(`⚠️ ${targetBrushName} 브러시 처리 실패:`, child.name, error);
        }
      }
    }
  });
  
  console.log(`✅ ${targetBrushName} 브러시 ${processed}개 처리 완료`);
  return processed;
}

/**
 * 브러시 정보 분석 (디버깅용)
 */
export function analyzeBrushes(rootObject: THREE.Object3D): any[] {
  const brushInfo: any[] = [];
  
  rootObject.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const info = {
        name: child.name,
        materialName: Array.isArray(child.material) 
          ? child.material.map(m => m.name).join(', ')
          : child.material?.name || 'unknown',
        vertexCount: child.geometry.attributes.position?.count || 0,
        hasColors: !!child.geometry.attributes.color,
        hasUVs: !!child.geometry.attributes.uv,
        visible: child.visible
      };
      brushInfo.push(info);
    }
  });
  
  console.table(brushInfo);
  return brushInfo;
}

/**
 * 머티리얼 정리 (메모리 누수 방지)
 */
export function disposeBrushMaterials(rootObject: THREE.Object3D): void {
  rootObject.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (Array.isArray(child.material)) {
        child.material.forEach(material => material.dispose());
      } else {
        child.material?.dispose();
      }
    }
  });
  
  console.log('🧹 브러시 머티리얼 정리 완료');
}
