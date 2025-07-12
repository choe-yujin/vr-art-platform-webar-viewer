/* eslint-disable @typescript-eslint/no-explicit-any */
// three-icosa 타입 선언
declare module 'three-icosa' {
  import { GLTF, GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
  
  export class GLTFGoogleTiltBrushMaterialExtension {
    constructor(parser: GLTFParser, brushPath?: string);
    name: string;
    loadMaterial(materialIndex: number): Promise<any>;
  }
  
  export function loadGLTF(url: string): Promise<GLTF>;
  export function loadBrushes(brushPath: string): Promise<void>;
  
  // 기타 three-icosa 관련 타입들
  export interface TiltBrushMaterial {
    name: string;
    shader: string;
    properties: any;
  }
}
