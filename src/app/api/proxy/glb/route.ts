import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    console.log(`🔧 GLB 프록시 요청: ${url}`);

    // URL 유효성 검증
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      console.error('❌ 유효하지 않은 URL:', url);
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // S3 URL인지 확인하고 HTTPS 강제 적용
    if (targetUrl.hostname.includes('s3.') || targetUrl.hostname.includes('.amazonaws.com')) {
      targetUrl.protocol = 'https:';
    }

    console.log(`💾 GLB 다운로드 시도: ${targetUrl.toString()}`);

    // GLB 파일 다운로드
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/octet-stream, model/gltf-binary, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      // 타임아웃 설정
      signal: AbortSignal.timeout(30000), // 30초 타임아웃
    });

    if (!response.ok) {
      console.error(`❌ GLB 다운로드 실패: ${response.status} ${response.statusText}`);
      console.error(`❌ 요청 URL: ${targetUrl.toString()}`);
      console.error(`❌ 응답 헤더:`, Object.fromEntries(response.headers.entries()));
      
      // 응답 본문을 읽어서 더 자세한 에러 정보 확인
      let errorBody = '';
      try {
        errorBody = await response.text();
        console.error(`❌ 응답 본문:`, errorBody.substring(0, 500)); // 처음 500자만 로그
      } catch (e) {
        console.error(`❌ 응답 본문 읽기 실패:`, e);
      }
      
      return NextResponse.json(
        { 
          error: `Failed to download GLB file: ${response.status} ${response.statusText}`,
          details: errorBody.substring(0, 200),
          url: targetUrl.toString()
        },
        { status: response.status }
      );
    }

    // GLB 파일 스트림
    const glbBuffer = await response.arrayBuffer();

    if (glbBuffer.byteLength === 0) {
      console.error('❌ GLB 파일이 비어있습니다');
      return NextResponse.json(
        { error: 'GLB file is empty' },
        { status: 400 }
      );
    }

    // 응답 헤더 설정
    const headers = new Headers();
    headers.set('Content-Type', 'model/gltf-binary');
    headers.set('Content-Length', glbBuffer.byteLength.toString());
    headers.set('Cache-Control', 'public, max-age=3600'); // 1시간 캐시
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    headers.set('Accept-Ranges', 'bytes');

    console.log(`✅ GLB 프록시 성공: ${glbBuffer.byteLength} bytes`);

    return new NextResponse(glbBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('❌ GLB 프록시 오류:', error);
    
    // 타임아웃 에러 처리
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - GLB file download took too long' },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Max-Age': '86400', // 24시간
    },
  });
} 