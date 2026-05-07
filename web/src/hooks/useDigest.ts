import { useQuery } from '@tanstack/react-query';
import { fetchDigest } from '../lib/api';
import type { ApiResponse, DigestBundle } from '@fd/shared';

export const useDigest = (symbol: string, date?: string) =>
  useQuery<ApiResponse<DigestBundle>, Error>({
    queryKey: ['digest', symbol, date ?? 'today'],
    queryFn: () => fetchDigest(symbol, date),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
