/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';

// MindAR Three.js 타입 정의
export interface MindARThreeConfig {
  container: HTMLElement;
  imageTargetSrc: string;
}

export interface MindARThreeInstance {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  addAnchor: (targetIndex: number) => MindARThreeAnchor;
  start: () => Promise<void>;
  stop: () => void;
}

export interface MindARThreeAnchor {
  group: THREE.Group;
}

export interface MindARThreeConstructor {
  new (config: MindARThreeConfig): MindARThreeInstance;
}

// GLTFLoader Extension 타입 정의 (any 허용됨)
export interface GLTFParser {
  json: any;
  extensions: Record<string, any>;
  options: any;
}

export interface GLTFLoaderExtension {
  name: string;
  beforeRoot?: () => Promise<void> | void;
  afterRoot?: (result: any) => Promise<any> | any;
}

export interface GLTFGoogleTiltBrushMaterialExtensionConstructor {
  new (parser: GLTFParser, assetUrl: string): GLTFLoaderExtension;
}

// Window 전역 객체 타입 정의
declare global {
  interface Window {
    MindAR_THREE: typeof THREE;
    MindAR_MindARThree: MindARThreeConstructor;
  }
}

export {};
