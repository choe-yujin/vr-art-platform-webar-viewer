import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    console.log(`🎨 작품 정보 프록시 요청: ${id}`);
    
    // 실제 API 서버로 요청
    const apiUrl = `https://api.livingbrush.shop/api/artworks/${id}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; LivingBrush WebAR Viewer)',
      },
      // 타임아웃 설정
      signal: AbortSignal.timeout(15000), // 15초 타임아웃
    });

    if (!response.ok) {
      console.error(`❌ API 요청 실패: ${response.status} ${response.statusText}`);
      
      let errorBody = '';
      try {
        errorBody = await response.text();
        console.error(`❌ 응답 본문:`, errorBody.substring(0, 500));
      } catch (e) {
        console.error(`❌ 응답 본문 읽기 실패:`, e);
      }
      
      return NextResponse.json(
        { 
          error: `API request failed: ${response.status} ${response.statusText}`,
          details: errorBody.substring(0, 200),
        },
        { 
          status: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }

    const data = await response.json();
    
    console.log(`✅ 작품 정보 프록시 성공: ${data.artworkId || 'Unknown'}`);

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=300', // 5분 캐시
      },
    });

  } catch (error) {
    console.error('❌ 작품 정보 프록시 오류:', error);
    
    // 타임아웃 에러 처리
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - API request took too long' },
        { 
          status: 408,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // 24시간
    },
  });
}
