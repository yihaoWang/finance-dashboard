import { useQuery } from '@tanstack/react-query';
import { fetchSentiment } from '../lib/api';

export const useSentiment = () =>
  useQuery({
    queryKey: ['sentiment'],
    queryFn: fetchSentiment,
    staleTime: 5 * 60 * 1000,
  });
