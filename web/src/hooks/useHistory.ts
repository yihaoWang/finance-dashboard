import { useQuery } from '@tanstack/react-query';
import { fetchHistory } from '../lib/api';

export const useHistory = (symbol: string, range: string) =>
  useQuery({
    queryKey: ['history', symbol, range],
    queryFn: () => fetchHistory(symbol, range),
    enabled: symbol.length >= 4,
    staleTime: 5 * 60_000,
  });
