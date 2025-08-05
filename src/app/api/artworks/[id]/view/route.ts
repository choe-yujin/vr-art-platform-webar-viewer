import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    console.log(`👁️ 조회수 증가 프록시 요청: ${id}`);
    
    // 실제 API 서버로 요청
    const apiUrl = `https://api.livingbrush.shop/api/artworks/${id}/view`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; LivingBrush WebAR Viewer)',
      },
      // 타임아웃 설정
      signal: AbortSignal.timeout(10000), // 10초 타임아웃
    });

    if (!response.ok) {
      console.warn(`⚠️ 조회수 증가 실패 (무시함): ${response.status} ${response.statusText}`);
      
      return NextResponse.json(
        { 
          error: `View count increment failed: ${response.status} ${response.statusText}`,
          warning: 'This error is non-critical'
        },
        { 
          status: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }

    console.log(`✅ 조회수 증가 프록시 성공: ${id}`);

    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );

  } catch (error) {
    console.warn('⚠️ 조회수 증가 프록시 오류 (무시함):', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        warning: 'This error is non-critical'
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // 24시간
    },
  });
}
