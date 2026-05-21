import { useEffect, useRef, useState } from 'react';
import { fetchStockNames } from '../lib/api';

const STORAGE_KEY = 'fd:names:v1';
const PRESETS: Record<string, string> = {
  '2330': '台積電',
  '2454': '聯發科',
  '2317': '鴻海',
  '3008': '大立光',
  '2308': '台達電',
};

const loadCache = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...PRESETS, ...(JSON.parse(raw) as Record<string, string>) };
  } catch {
    /* ignore */
  }
  return { ...PRESETS };
};

const writeCache = (m: Record<string, string>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
};

export const useStockNames = (symbols: string[]): Record<string, string> => {
  const [names, setNames] = useState<Record<string, string>>(loadCache);
  const fetchedRef = useRef<Set<string>>(new Set(Object.keys(loadCache())));

  useEffect(() => {
    const missing = symbols.filter((s) => !fetchedRef.current.has(s));
    if (missing.length === 0) return;
    missing.forEach((s) => fetchedRef.current.add(s));
    let cancelled = false;
    fetchStockNames(missing)
      .then((m) => {
        if (cancelled || Object.keys(m).length === 0) return;
        setNames((prev) => {
          const next = { ...prev, ...m };
          writeCache(next);
          return next;
        });
      })
      .catch(() => {
        /* leave names blank */
      });
    return () => {
      cancelled = true;
    };
  }, [symbols.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return names;
};
