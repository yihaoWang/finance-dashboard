import { useQuery } from '@tanstack/react-query';
import { fetchValuation } from '../lib/api';

export const useValuation = (symbol: string) =>
  useQuery({
    queryKey: ['valuation', symbol],
    queryFn: () => fetchValuation(symbol),
    staleTime: 30 * 60 * 1000,
    enabled: symbol.length > 0,
  });
