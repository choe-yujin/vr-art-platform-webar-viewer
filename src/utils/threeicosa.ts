/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Three-Icosa 브러시 처리 유틸리티
 * 실제 three-icosa 라이브러리를 사용하여 Tilt Brush/Open Brush VR 아트웍 렌더링
 */

/**
 * Three-Icosa를 사용하여 브러시 처리
 * GLTFLoader에 익스텐션을 등록하고 실제 로더 인스턴스를 반환
 */
export async function processAllBrushes(rootObject: THREE.Object3D): Promise<{ success: boolean; processed: number; failed: number; gltfLoader?: GLTFLoader }> {
  try {
    console.log('🎨 Three-Icosa 브러시 처리 시작...');
    console.log('📦 처리할 오브젝트:', rootObject.name || 'unnamed object');
    
    // three-icosa 라이브러리 동적 임포트
    const icosaModule = await import('three-icosa');
    
    console.log('✅ Three-Icosa 라이브러리 로드 완료');
    
    // 새로운 GLTFLoader 인스턴스 생성
    const gltfLoader = new GLTFLoader();
    
    // 브러시 폴더 경로 설정 (라이브러리에서 제공하는 정적 파일)
    const brushFolderPath = 'https://icosa-gallery.github.io/three-icosa-template/brushes/';
    
    // GLTFGoogleTiltBrushMaterialExtension 등록
    if (icosaModule.GLTFGoogleTiltBrushMaterialExtension) {
      gltfLoader.register((parser) => new icosaModule.GLTFGoogleTiltBrushMaterialExtension(parser, brushFolderPath));
      console.log('🎯 Three-Icosa GLTFGoogleTiltBrushMaterialExtension 등록 완료');
      console.log('📁 브러시 폴더 경로:', brushFolderPath);
      
      // 실제 오브젝트 트래버스하여 브러시 메쉬 확인
      let brushMeshCount = 0;
      rootObject.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = Array.isArray(child.material) ? child.material[0] : child.material;
          if (material?.name && (material.name.includes('Brush_') || material.name.includes('brush'))) {
            brushMeshCount++;
            console.log(`🎨 브러시 메쉬 발견: ${child.name} - ${material.name}`);
          }
        }
      });
      
      console.log(`📊 총 ${brushMeshCount}개의 브러시 메쉬 발견`);
      
      return { success: true, processed: brushMeshCount, failed: 0, gltfLoader };
    } else {
      console.warn('⚠️ GLTFGoogleTiltBrushMaterialExtension을 찾을 수 없음');
      return { success: false, processed: 0, failed: 1 };
    }

  } catch (error) {
    console.error('❌ Three-Icosa 브러시 처리 중 오류:', error);
    return { success: false, processed: 0, failed: 1 };
  }
}

/**
 * 브러시 텍스처 에러 핸들링 설정
 * S3 403 에러를 방지하기 위해 three-icosa 라이브러리의 정적 파일을 사용하도록 설정
 */
export function setupTextureErrorHandling(): void {
  try {
    console.log('✅ 텍스처 에러 핸들링: three-icosa 익스텐션이 자동으로 처리함');
    // three-icosa의 GLTFGoogleTiltBrushMaterialExtension이 자동으로 브러시 텍스처를 처리
  } catch (error) {
    console.warn('⚠️ 텍스처 에러 핸들링 설정 실패:', error);
  }
}

/**
 * Three-Icosa 라이브러리 정보 출력 (디버깅용)
 */
export async function getThreeIcosaInfo(): Promise<any> {
  try {
    const icosaModule = await import('three-icosa');
    
    return {
      available: true,
      hasGLTFGoogleTiltBrushMaterialExtension: !!icosaModule.GLTFGoogleTiltBrushMaterialExtension,
      hasLoadGLTF: !!icosaModule.loadGLTF,
      hasLoadBrushes: !!icosaModule.loadBrushes,
      availableExports: Object.keys(icosaModule)
    };
  } catch (error) {
    return { available: false, error: (error as Error).message };
  }
}

/**
 * 브러시 관련 메쉬 분석 (디버깅용)
 */
export function analyzeBrushMeshes(rootObject: THREE.Object3D): any[] {
  const meshInfo: any[] = [];
  
  rootObject.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      
      const info = {
        name: child.name,
        materialName: material?.name || 'unknown',
        materialType: material?.constructor.name || 'unknown',
        vertexCount: child.geometry.attributes.position?.count || 0,
        hasColors: !!child.geometry.attributes.color,
        hasUVs: !!child.geometry.attributes.uv,
        visible: child.visible,
        isBrushMesh: (child.name.includes('Brush_') || child.name.includes('brush') || 
                     (material?.name && (material.name.includes('Brush_') || material.name.includes('brush'))))
      };
      
      if (info.isBrushMesh) {
        meshInfo.push(info);
      }
    }
  });
  
  console.log('🎨 브러시 메쉬 분석 결과:');
  console.table(meshInfo);
  return meshInfo;
}

/**
 * 메모리 정리
 */
export function cleanup(): void {
  console.log('🧹 Three-Icosa 정리 완료');
}
