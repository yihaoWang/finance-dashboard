import { useQuery } from '@tanstack/react-query';
import { fetchScreener } from '../lib/api';

export const useScreener = () =>
  useQuery({
    queryKey: ['screener'],
    queryFn: () => fetchScreener(),
    staleTime: 10 * 60 * 1000,
  });
