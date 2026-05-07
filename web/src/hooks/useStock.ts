import { useQuery } from '@tanstack/react-query';
import { fetchStock } from '../lib/api';

export const useStock = (symbol: string) => {
  return useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => fetchStock(symbol),
    enabled: symbol.length >= 4,
  });
};
