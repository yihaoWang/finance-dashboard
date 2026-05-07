import { useQuery } from '@tanstack/react-query';
import { fetchNews } from '../lib/api';

export const useNews = (symbol: string) => {
  return useQuery({
    queryKey: ['news', symbol],
    queryFn: () => fetchNews(symbol),
    enabled: symbol.length >= 4,
    staleTime: 30 * 60 * 1000,
  });
};
