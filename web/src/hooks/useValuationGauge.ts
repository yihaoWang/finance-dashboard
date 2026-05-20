import { useQuery } from '@tanstack/react-query';
import { fetchValuationGauge } from '../lib/api';

export const useValuationGauge = (symbol: string) =>
  useQuery({
    queryKey: ['valuation-gauge', symbol],
    queryFn: () => fetchValuationGauge(symbol),
    staleTime: 30 * 60 * 1000,
    enabled: symbol.length > 0,
    retry: false,
  });
