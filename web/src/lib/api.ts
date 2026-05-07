import type { ApiResponse, MacroBundle, PricePoint, StockBundle } from '@fd/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export const fetchStock = async (symbol: string): Promise<ApiResponse<StockBundle>> => {
  const res = await fetch(`${API_BASE}/api/stock/${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`api_error_${res.status}: ${text}`);
  }
  return res.json() as Promise<ApiResponse<StockBundle>>;
};

export const fetchHistory = async (symbol: string, range: string): Promise<ApiResponse<PricePoint[]>> => {
  const res = await fetch(`${API_BASE}/api/history/${encodeURIComponent(symbol)}?range=${range}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<PricePoint[]>>;
};

export const fetchMacro = async (): Promise<ApiResponse<MacroBundle>> => {
  const res = await fetch(`${API_BASE}/api/macro`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<MacroBundle>>;
};
