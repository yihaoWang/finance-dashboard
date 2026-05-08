import { useQuery } from '@tanstack/react-query';
import { fetchFinancials } from '../lib/api';
import type { ApiResponse, FinancialsBundle } from '@fd/shared';

export const useFinancials = (symbol: string) =>
  useQuery<ApiResponse<FinancialsBundle>, Error>({
    queryKey: ['financials', symbol],
    queryFn: () => fetchFinancials(symbol),
    enabled: symbol.length >= 4,
    staleTime: 60 * 60_000,
  });
