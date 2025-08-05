// src/utils/api.ts
export interface ArtworkResponse {
  artworkId: number;
  userId: number;
  userNickname: string;
  title: string;
  description: string;
  glbUrl: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  thumbnailMediaId?: number;
  thumbnailUrl?: string;
  priceCash?: number;
  favoriteCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  isPaid: boolean;
  hasThumbnail: boolean;
  qrImageUrl?: string;
  // 호환성을 위한 user 객체
  user: {
    userId: number;
    nickname: string;
    profileImageUrl?: string;
    bio?: string;
  };
  // 호환성을 위한 tags 배열
  tags?: Array<{
    id: number;
    name: string;
  }>;
  webArUrl?: string;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: string;
}

class ArtworkApiError extends Error {
  public status: number;
  public code: string;
  public details?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ArtworkApiError';
    this.status = error.status;
    this.code = error.code;
    this.details = error.details;
  }
}

// 환경 변수가 없으면 내부 프록시 API 사용
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const USE_INTERNAL_PROXY = !API_BASE_URL || API_BASE_URL === 'proxy';

// 디버깅용 로그
console.log('🔧 API URL 설정:', {
  env: process.env.NEXT_PUBLIC_API_URL,
  useProxy: USE_INTERNAL_PROXY,
  final: USE_INTERNAL_PROXY ? '내부 프록시 사용' : API_BASE_URL
});

// 환경 변수 디버깅
console.log('🔧 환경 변수 확인:', {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  API_BASE_URL: API_BASE_URL,
  NODE_ENV: process.env.NODE_ENV
});

/**
 * 작품 정보 조회 API
 * 
 * @param artworkId 작품 ID
 * @param token 액세스 토큰 (선택사항)
 * @returns 작품 정보
 */
export async function fetchArtwork(artworkId: string, token?: string): Promise<ArtworkResponse> {
  try {
    // 내부 프록시 또는 외부 API 사용 결정
    const url = USE_INTERNAL_PROXY 
      ? `/api/artworks/${artworkId}` // 내부 Next.js 프록시
      : `${API_BASE_URL}/api/artworks/${artworkId}`; // 외부 API
    
    console.log(`🎨 작품 정보 요청: ${url}`);
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // 토큰이 있으면 헤더에 추가 (비공개 작품 접근용)
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      // CORS 및 캐시 설정
      mode: 'cors',
      cache: 'no-cache',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      const apiError: ApiError = {
        status: response.status,
        code: errorData.code || 'UNKNOWN_ERROR',
        message: errorData.message || `HTTP ${response.status} 오류가 발생했습니다.`,
        details: errorData.details,
      };

      throw new ArtworkApiError(apiError);
    }

    const artwork: ArtworkResponse = await response.json();
    
    // 백엔드 응답을 프론트엔드 호환 형식으로 변환
    const compatibleArtwork: ArtworkResponse = {
      ...artwork,
      // user 객체 생성 - 실제 백엔드에서 제공된 작가 정보 사용
      user: {
        userId: artwork.user?.userId || artwork.userId,
        nickname: artwork.user?.nickname || artwork.userNickname,
        profileImageUrl: artwork.user?.profileImageUrl, // 실제 S3 이미지 URL
        bio: artwork.user?.bio // 실제 작가 소개
      },
      // tags 배열 초기화 (백엔드에서 아직 지원하지 않음)
      tags: artwork.tags || []
    };
    
    console.log(`✅ 작품 정보 로드 완료:`, {
      id: compatibleArtwork.artworkId,
      title: compatibleArtwork.title,
      artist: compatibleArtwork.user.nickname,
      glbUrl: compatibleArtwork.glbUrl,
      visibility: compatibleArtwork.visibility,
      isPublic: compatibleArtwork.isPublic
    });

    return compatibleArtwork;

  } catch (error) {
    if (error instanceof ArtworkApiError) {
      throw error;
    }

    console.error('❌ 작품 정보 조회 중 네트워크 오류:', error);
    
    throw new ArtworkApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 작품 조회수 증가 API
 * 
 * @param artworkId 작품 ID
 */
export async function incrementViewCount(artworkId: string): Promise<void> {
  try {
    // 내부 프록시 또는 외부 API 사용 결정
    const url = USE_INTERNAL_PROXY
      ? `/api/artworks/${artworkId}/view` // 내부 Next.js 프록시
      : `${API_BASE_URL}/api/artworks/${artworkId}/view`; // 외부 API
    
    console.log(`👁️ 조회수 증가 요청: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
    });

    if (response.ok) {
      console.log(`✅ 조회수 증가 완료: 작품 ${artworkId}`);
    } else {
      console.warn(`⚠️ 조회수 증가 실패 (무시함): ${response.status}`);
    }

  } catch (error) {
    console.warn('⚠️ 조회수 증가 중 오류 (무시함):', error);
    // 조회수 증가 실패는 치명적이지 않으므로 무시
  }
}

/**
 * GLB 파일 URL 검증 및 HTTPS 변환
 * 
 * @param glbUrl 원본 GLB URL
 * @returns 검증된 GLB URL
 */
export function validateAndFixGlbUrl(glbUrl: string): string {
  try {
    const url = new URL(glbUrl);
    
    // S3 URL인지 확인
    if (url.hostname.includes('s3.') || url.hostname.includes('.amazonaws.com')) {
      // HTTPS로 강제 변환
      url.protocol = 'https:';
      return url.toString();
    }

    // 기타 URL도 HTTPS로 변환
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
    }

    return url.toString();

  } catch (error) {
    console.error('❌ GLB URL 검증 실패:', glbUrl, error);
    throw new Error(`유효하지 않은 GLB URL입니다: ${glbUrl}`);
  }
}

/**
 * URL 파라미터에서 토큰 추출
 * 
 * @returns 액세스 토큰 (있는 경우)
 */
export function extractTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
}

/**
 * 작품 ID 유효성 검증
 * 
 * @param artworkId 작품 ID
 * @returns 유효성 여부
 */
export function isValidArtworkId(artworkId: string): boolean {
  // 숫자 ID 형식 검증
  const numericId = parseInt(artworkId, 10);
  if (!isNaN(numericId) && numericId > 0) {
    return true;
  }

  // UUID 형식 검증
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(artworkId)) {
    return true;
  }

  // 16자리 해시 형식 검증
  const hashRegex = /^[0-9a-f]{16}$/i;
  if (hashRegex.test(artworkId)) {
    return true;
  }

  return false;
}

export { ArtworkApiError };
