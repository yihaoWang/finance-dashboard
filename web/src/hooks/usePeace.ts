import { useQuery } from '@tanstack/react-query';
import { fetchPeace } from '../lib/api';
import type { ApiResponse, PeaceBundle } from '@fd/shared';

export const usePeace = (symbol: string) =>
  useQuery<ApiResponse<PeaceBundle>, Error>({
    queryKey: ['peace', symbol],
    queryFn: () => fetchPeace(symbol),
    enabled: symbol.length >= 4,
    staleTime: 30 * 60_000,
  });
