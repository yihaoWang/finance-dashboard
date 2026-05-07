import { useQuery } from '@tanstack/react-query';
import { fetchMacro } from '../lib/api';

export const useMacro = () => useQuery({
  queryKey: ['macro'],
  queryFn: fetchMacro,
  staleTime: 5 * 60_000,
});
