import { useQuery } from '@tanstack/react-query';
import { fetchDigestHistory } from '../lib/api';
import type { ApiResponse, DigestHistoryItem } from '@fd/shared';

export const useDigestHistory = (scope: 'market' | 'stock', symbol?: string, limit = 30) =>
  useQuery<ApiResponse<DigestHistoryItem[]>, Error>({
    queryKey: ['digestHistory', scope, symbol, limit],
    queryFn: () => fetchDigestHistory(scope, symbol, limit),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
