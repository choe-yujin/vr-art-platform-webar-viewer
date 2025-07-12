'use client';

import { useEffect, useState } from 'react';
import DebugARViewer from '../../components/DebugARViewer';

export default function DebugPage() {
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('desktop');

  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setDeviceType(isMobile ? 'mobile' : 'desktop');
  }, []);

  return (
    <DebugARViewer 
      modelPath="/sample.glb"
      deviceType={deviceType}
    />
  );
}
