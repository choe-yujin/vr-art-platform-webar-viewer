// WebGL 컨텍스트 생성 유틸리티
export function createSafeWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext | WebGL2RenderingContext | null {
  const contextOptions = {
    alpha: true,
    antialias: true,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'default' as WebGLPowerPreference,
    failIfMajorPerformanceCaveat: false
  };

  // WebGL2 시도
  const context = canvas.getContext('webgl2', contextOptions) as WebGL2RenderingContext | null;
  if (context) {
    console.log('✅ WebGL2 컨텍스트 생성 성공');
    return context;
  }

  // WebGL1 시도
  const webgl1Context = canvas.getContext('webgl', contextOptions) as WebGLRenderingContext | null;
  if (webgl1Context) {
    console.log('✅ WebGL1 컨텍스트 생성 성공');
    return webgl1Context;
  }

  // Experimental WebGL 시도
  const experimentalContext = canvas.getContext('experimental-webgl', contextOptions) as WebGLRenderingContext | null;
  if (experimentalContext) {
    console.log('✅ Experimental WebGL 컨텍스트 생성 성공');
    return experimentalContext;
  }

  console.error('❌ WebGL 컨텍스트 생성 실패');
  return null;
}

export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = createSafeWebGLContext(canvas);
    return context !== null;
  } catch (error) {
    console.error('WebGL 지원 확인 중 오류:', error);
    return false;
  }
}

export function getWebGLInfo(): { vendor: string; renderer: string; version: string } | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = createSafeWebGLContext(canvas);
    
    if (!gl) return null;

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    
    return {
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION)
    };
  } catch (error) {
    console.error('WebGL 정보 가져오기 실패:', error);
    return null;
  }
}
