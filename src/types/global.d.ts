/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
  onTargetFound?: () => void;
  onTargetLost?: () => void;
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
    // ✨ 에러 해결: MindAR_GLTFLoader 타입 추가
    MindAR_GLTFLoader: typeof GLTFLoader; 
  }
}

export {};