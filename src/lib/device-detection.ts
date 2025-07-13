export class DeviceDetection {
  static isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      window.navigator.userAgent
    );
  }
  
  static isDesktop(): boolean {
    return !this.isMobile();
  }
  
  static hasCamera(): boolean {
    if (typeof window === 'undefined') return false;
    
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  
  static supportsWebXR(): boolean {
    if (typeof window === 'undefined') return false;
    
    return 'xr' in navigator;
  }
}
