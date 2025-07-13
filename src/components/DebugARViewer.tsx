/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface DebugARViewerProps {
  modelPath: string;
  deviceType: 'mobile' | 'desktop';
}

export default function DebugARViewer({ modelPath, deviceType }: DebugARViewerProps) {
  const [logs, setLogs] = useState<string[]>(['🎬 디버깅 시작...']);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev.slice(-10), logMessage]); // 최근 10개만 유지
  }, []);

  const initializeMobileDebug = useCallback(async () => {
    try {
      addLog('📱 모바일 모드 시작');
      
      // 카메라 권한 체크 (미래 WebXR 대비)
      addLog('카메라 API 확인 중...');
      if (!navigator?.mediaDevices?.getUserMedia) {
        addLog('⚠️ 카메라 API를 지원하지 않습니다 (WebXR에 필요할 수 있음)');
      } else {
        addLog('✅ 카메라 API 지원 확인됨');
      }
      
      // WebGL 지원 체크
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        throw new Error('WebGL을 지원하지 않습니다.');
      }
      addLog('✅ WebGL 지원 확인됨');
      
      // GLB 모델 파일 체크
      addLog('GLB 모델 파일 확인 중...');
      const modelResponse = await fetch(modelPath);
      if (!modelResponse.ok) {
        throw new Error(`GLB 모델 로드 실패: ${modelResponse.statusText}`);
      }
      addLog('✅ GLB 모델 파일 확인됨');
      
      // three-icosa 라이브러리 체크
      try {
        await import('three-icosa');
        addLog('✅ three-icosa 라이브러리 로드됨');
      } catch (icosaError) {
        addLog(`⚠️ three-icosa 로드 실패: ${icosaError}`);
      }
      
      addLog('🎉 모든 체크 완료 - 3D 뷰어 초기화 가능합니다!');
      setStatus('success');
      
    } catch (error) {
      addLog(`❌ 에러: ${(error as Error).message}`);
      setStatus('error');
    }
  }, [modelPath, addLog]);

  const initializeDesktopDebug = useCallback(async () => {
    try {
      addLog('🖥️ 데스크톱 모드 시작');
      
      // Three.js 기본 기능 체크
      new THREE.Scene();
      new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      new THREE.WebGLRenderer();
      addLog('✅ Three.js 기본 객체 생성됨');
      
      // GLB 로더 체크
      new GLTFLoader();
      addLog('✅ GLTF 로더 생성됨');
      
      addLog('🎉 데스크톱 모드 체크 완료!');
      setStatus('success');
      
    } catch (error) {
      addLog(`❌ 에러: ${(error as Error).message}`);
      setStatus('error');
    }
  }, [addLog]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    addLog(`디바이스 타입: ${deviceType}`);
    addLog('컨테이너 DOM 준비 완료');
    
    if (deviceType === 'mobile') {
      initializeMobileDebug();
    } else {
      initializeDesktopDebug();
    }
  }, [deviceType, initializeMobileDebug, initializeDesktopDebug]);

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-4">🔧 AR 뷰어 디버그 모드</h1>
        
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span>상태:</span>
            <span className={`px-2 py-1 rounded text-xs ${
              status === 'loading' ? 'bg-yellow-600' :
              status === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}>
              {status === 'loading' ? '🔄 체크 중' :
               status === 'success' ? '✅ 성공' : '❌ 실패'}
            </span>
          </div>
          <div>디바이스: {deviceType}</div>
          <div>모델 경로: {modelPath}</div>
        </div>
        
        <div className="bg-gray-900 rounded p-4 h-96 overflow-y-auto">
          <h2 className="font-bold mb-2">디버그 로그:</h2>
          {logs.map((log, index) => (
            <div key={index} className="text-sm font-mono mb-1 break-words">
              {log}
            </div>
          ))}
        </div>
        
        <div className="mt-4">
          <Link href="/ar/view/1" className="inline-block bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
            ← 원래 AR 뷰어로 돌아가기
          </Link>
        </div>
      </div>
      
      <div ref={containerRef} className="hidden" />
    </div>
  );
}
