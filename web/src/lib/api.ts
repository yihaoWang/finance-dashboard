import type { ApiResponse, MacroBundle, StockBundle } from '@fd/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export const fetchStock = async (symbol: string): Promise<ApiResponse<StockBundle>> => {
  const res = await fetch(`${API_BASE}/api/stock/${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`api_error_${res.status}: ${text}`);
  }
  return res.json() as Promise<ApiResponse<StockBundle>>;
};

export const fetchMacro = async (): Promise<ApiResponse<MacroBundle>> => {
  const res = await fetch(`${API_BASE}/api/macro`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<MacroBundle>>;
};
