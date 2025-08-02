// src/hooks/useArtwork.ts
import { useEffect, useState } from 'react';
import { fetchArtwork, incrementViewCount, extractTokenFromUrl, isValidArtworkId, validateAndFixGlbUrl, ArtworkResponse, ArtworkApiError } from '@/utils/api';

interface UseArtworkResult {
  artwork: ArtworkResponse | null;
  loading: boolean;
  error: string | null;
  modelPath: string | null;
}

export function useArtwork(artworkId: string): UseArtworkResult {
  const [artwork, setArtwork] = useState<ArtworkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelPath, setModelPath] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadArtwork = async () => {
      if (!mounted) return;

      setLoading(true);
      setError(null);
      setArtwork(null);
      setModelPath(null);

      try {
        // 1. 작품 ID 유효성 검증
        if (!isValidArtworkId(artworkId)) {
          throw new Error(`유효하지 않은 작품 ID입니다: ${artworkId}`);
        }

        // 2. URL에서 액세스 토큰 추출
        const token = extractTokenFromUrl();
        
        // 3. 작품 정보 조회
        console.log(`🎨 작품 로딩 시작: ID=${artworkId}, Token=${token ? 'O' : 'X'}`);
        
        const artworkData = await fetchArtwork(artworkId, token || undefined);
        
        if (!mounted) return;

        // 4. GLB URL 검증 및 수정
        const validatedGlbUrl = validateAndFixGlbUrl(artworkData.glbUrl);
        
        // 5. 프록시를 통한 GLB URL 생성 (Unity WebGL CORS 우회)
        const proxyGlbUrl = `/api/proxy/glb?url=${encodeURIComponent(validatedGlbUrl)}`;
        
        // 5. 상태 업데이트
        setArtwork(artworkData);
        setModelPath(proxyGlbUrl);
        
        console.log(`✅ 작품 로딩 완료:`, {
          title: artworkData.title,
          originalGlbUrl: validatedGlbUrl,
          proxyGlbUrl: proxyGlbUrl,
          visibility: artworkData.visibility
        });

        // 6. 조회수 증가 (비동기, 에러 무시)
        incrementViewCount(artworkId).catch(err => {
          console.warn('⚠️ 조회수 증가 실패 (무시함):', err);
        });

      } catch (err) {
        if (!mounted) return;

        console.error('❌ 작품 로딩 실패:', err);

        if (err instanceof ArtworkApiError) {
          // API 에러 처리
          switch (err.status) {
            case 404:
              setError('작품을 찾을 수 없습니다. 삭제되었거나 존재하지 않는 작품입니다.');
              break;
            case 403:
              setError('이 작품에 접근할 권한이 없습니다. 비공개 작품이거나 액세스 토큰이 유효하지 않습니다.');
              break;
            case 500:
              setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
              break;
            default:
              setError(err.message || '알 수 없는 오류가 발생했습니다.');
          }
        } else {
          // 일반 에러 처리
          setError(err instanceof Error ? err.message : '작품을 불러오는 중 오류가 발생했습니다.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadArtwork();

    return () => {
      mounted = false;
    };
  }, [artworkId]);

  return {
    artwork,
    loading,
    error,
    modelPath,
  };
}
