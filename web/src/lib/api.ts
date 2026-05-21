import type { ApiResponse, DigestBundle, DigestHistoryItem, FinancialsBundle, MacroBundle, NewsBundle, PeaceBundle, PricePoint, ScreenerBundle, SentimentBundle, StockBundle, ValuationBundle, ValuationGauge } from '@fd/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// credentials: 'include' ensures CF_Authorization cookie (HttpOnly, SameSite=None)
// is sent on every API request — Chrome's default 'same-origin' has dropped it
// in some redirect-followed contexts, causing CF Access to see auth_status=NONE
// and respond with a cross-origin SSO 302 (which fails CORS).
const apiFetch = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${API_BASE}${path}`, { credentials: 'include', ...init });

export const fetchStock = async (symbol: string): Promise<ApiResponse<StockBundle>> => {
  const res = await apiFetch(`/api/stock/${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`api_error_${res.status}: ${text}`);
  }
  return res.json() as Promise<ApiResponse<StockBundle>>;
};

export const fetchHistory = async (symbol: string, range: string): Promise<ApiResponse<PricePoint[]>> => {
  const res = await apiFetch(`/api/history/${encodeURIComponent(symbol)}?range=${range}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<PricePoint[]>>;
};

export const fetchMacro = async (): Promise<ApiResponse<MacroBundle>> => {
  const res = await apiFetch(`/api/macro`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<MacroBundle>>;
};

export const fetchNews = async (symbol: string): Promise<ApiResponse<NewsBundle>> => {
  const res = await apiFetch(`/api/news/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<NewsBundle>>;
};

export const fetchDigest = async (symbol: string, date?: string): Promise<ApiResponse<DigestBundle>> => {
  const path = symbol === 'market' ? '/api/digest' : `/api/digest/${encodeURIComponent(symbol)}`;
  const url = `${path}${date !== undefined ? `?date=${date}` : ''}`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<DigestBundle>>;
};

export const fetchFinancials = async (symbol: string): Promise<ApiResponse<FinancialsBundle>> => {
  const res = await apiFetch(`/api/financials/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<FinancialsBundle>>;
};

export const fetchSentiment = async (): Promise<ApiResponse<SentimentBundle>> => {
  const res = await apiFetch(`/api/sentiment`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<SentimentBundle>>;
};

export const fetchPeace = async (symbol: string): Promise<ApiResponse<PeaceBundle>> => {
  const res = await apiFetch(`/api/peace?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<PeaceBundle>>;
};

export const postPeaceTags = async (
  symbol: string,
  kind: 'moat' | 'risk',
  values: string[],
): Promise<void> => {
  const res = await apiFetch(`/api/peace/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, kind, values }),
  });
  if (!res.ok) throw new Error(`api_error_${res.status}`);
};

export const fetchDigestHistory = async (scope: 'market' | 'stock', symbol?: string, limit = 30): Promise<ApiResponse<DigestHistoryItem[]>> => {
  const params = new URLSearchParams({ scope, limit: String(limit) });
  if (symbol !== undefined) params.set('symbol', symbol);
  const res = await apiFetch(`/api/digest/history?${params}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<DigestHistoryItem[]>>;
};

export const fetchScreener = async (): Promise<ApiResponse<ScreenerBundle>> => {
  const res = await apiFetch(`/api/screener`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<ScreenerBundle>>;
};

export const fetchValuation = async (symbol: string): Promise<ApiResponse<ValuationBundle>> => {
  const res = await apiFetch(`/api/valuation/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<ValuationBundle>>;
};

export const fetchValuationGauge = async (symbol: string): Promise<ApiResponse<ValuationGauge>> => {
  const res = await apiFetch(`/api/valuation/gauge/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json() as Promise<ApiResponse<ValuationGauge>>;
};
