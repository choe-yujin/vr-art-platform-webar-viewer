// src/types/global.d.ts

// Unity WebGL 관련 타입 정의
export interface UnityWebGLConfig {
  dataUrl: string;
  frameworkUrl: string;
  codeUrl: string;
}

export interface UnityWebGLInstance {
  SendMessage: (gameObjectName: string, methodName: string, parameter?: string | number | boolean) => void;
  Quit: () => void;
}

declare global {
  interface Window {
    createUnityInstance?: (canvas: HTMLCanvasElement, config: UnityWebGLConfig) => Promise<UnityWebGLInstance>;
  }
}

export {};