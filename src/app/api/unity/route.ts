import { NextRequest, NextResponse } from 'next/server';

/**
 * Unity WebGL에서 사용할 통합 API 엔드포인트
 * Unity는 이 엔드포인트를 통해 작품 정보와 API Base URL을 받아옵니다.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const artworkId = searchParams.get('artworkId');

    // API 설정 정보 반환
    if (action === 'config') {
      const config = {
        apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || '/api', // 내부 프록시 사용
        useProxy: true, // 항상 프록시 사용
        corsEnabled: true,
        timestamp: new Date().toISOString()
      };

      console.log('🔧 Unity 설정 정보 요청:', config);

      return NextResponse.json(config, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 작품 정보 프록시
    if (action === 'artwork' && artworkId) {
      console.log(`🎨 Unity용 작품 정보 요청: ${artworkId}`);
      
      const apiUrl = `https://api.livingbrush.shop/api/artworks/${artworkId}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; LivingBrush Unity WebGL)',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.error(`❌ Unity 작품 정보 요청 실패: ${response.status}`);
        return NextResponse.json(
          { error: `Failed to fetch artwork: ${response.status}` },
          { 
            status: response.status,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            }
          }
        );
      }

      const data = await response.json();
      
      // GLB URL을 프록시 URL로 변경
      if (data.glbUrl) {
        const originalGlbUrl = data.glbUrl;
        data.glbUrl = `/api/proxy/glb?url=${encodeURIComponent(originalGlbUrl)}`;
        console.log(`🔄 GLB URL 프록시로 변경: ${originalGlbUrl} → ${data.glbUrl}`);
      }
      
      console.log(`✅ Unity용 작품 정보 성공: ${data.artworkId || 'Unknown'}`);

      return NextResponse.json(data, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // 잘못된 요청
    return NextResponse.json(
      { error: 'Invalid request. Use ?action=config or ?action=artwork&artworkId=ID' },
      { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );

  } catch (error) {
    console.error('❌ Unity API 오류:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
