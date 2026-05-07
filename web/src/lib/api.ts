import type { ApiResponse, StockBundle } from '@fd/shared';

export const fetchStock = async (symbol: string): Promise<ApiResponse<StockBundle>> => {
  const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`api_error_${res.status}: ${text}`);
  }
  return res.json() as Promise<ApiResponse<StockBundle>>;
};
