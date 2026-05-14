import type { ApiResponse, DigestBundle, DigestHistoryItem, FinancialsBundle, MacroBundle, NewsBundle, PeaceBundle, PricePoint, SentimentBundle, StockBundle } from '@fd/shared';

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

export const fetchNews = async (symbol: string): Promise<ApiResponse<NewsBundle>> => {
  const res = await fetch(`${API_BASE}/api/news/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<NewsBundle>>;
};

export const fetchDigest = async (symbol: string, date?: string): Promise<ApiResponse<DigestBundle>> => {
  const path = symbol === 'market' ? '/api/digest' : `/api/digest/${encodeURIComponent(symbol)}`;
  const url = `${API_BASE}${path}${date !== undefined ? `?date=${date}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<DigestBundle>>;
};

export const fetchFinancials = async (symbol: string): Promise<ApiResponse<FinancialsBundle>> => {
  const res = await fetch(`${API_BASE}/api/financials/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<FinancialsBundle>>;
};

export const fetchSentiment = async (): Promise<ApiResponse<SentimentBundle>> => {
  const res = await fetch(`${API_BASE}/api/sentiment`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<SentimentBundle>>;
};

export const fetchPeace = async (symbol: string): Promise<ApiResponse<PeaceBundle>> => {
  const res = await fetch(`${API_BASE}/api/peace?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<PeaceBundle>>;
};

export const postPeaceTags = async (
  symbol: string,
  kind: 'moat' | 'risk',
  values: string[],
): Promise<void> => {
  const res = await fetch(`${API_BASE}/api/peace/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, kind, values }),
  });
  if (!res.ok) throw new Error(`api_error_${res.status}`);
};

export const fetchDigestHistory = async (scope: 'market' | 'stock', symbol?: string, limit = 30): Promise<ApiResponse<DigestHistoryItem[]>> => {
  const params = new URLSearchParams({ scope, limit: String(limit) });
  if (symbol !== undefined) params.set('symbol', symbol);
  const res = await fetch(`${API_BASE}/api/digest/history?${params}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<DigestHistoryItem[]>>;
};
