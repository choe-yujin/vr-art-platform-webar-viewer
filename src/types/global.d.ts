// src/types/global.d.ts

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface MindARThreeConfig {
  container: HTMLElement;
  imageTargetSrc: string;
}

export interface MindARThreeAnchor {
  group: THREE.Group;
  onTargetFound?: () => void;
  onTargetLost?: () => void;
}

export interface MindARThreeInstance {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  addAnchor: (targetIndex: number) => MindARThreeAnchor;
  start: () => Promise<void>;
  stop: () => void;
}

export interface MindARThreeConstructor {
  new (config: MindARThreeConfig): MindARThreeInstance;
}

declare global {
  interface Window {
    MindAR_THREE?: typeof THREE;
    MindAR_MindARThree?: MindARThreeConstructor;
    MindAR_GLTFLoader?: typeof GLTFLoader; 
  }
}

export {};