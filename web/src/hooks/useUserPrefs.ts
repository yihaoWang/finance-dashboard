import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchUserPrefs, saveUserPrefs } from '../lib/api';

const STORAGE_KEY = 'fd:prefs:v1';
const DEFAULT_WATCHLIST = ['2330', '2454', '2317', '3008', '2308'];
const MAX_WATCHLIST = 30;
const MAX_RECENTS = 12;
const SYMBOL_RE = /^[A-Z0-9]{4,6}$/;

type Cached = { watchlist: string[]; recents: string[] };

const loadCache = (): Cached => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Cached>;
      return {
        watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : DEFAULT_WATCHLIST,
        recents: Array.isArray(parsed.recents) ? parsed.recents : [],
      };
    }
  } catch {
    /* ignore */
  }
  return { watchlist: DEFAULT_WATCHLIST, recents: [] };
};

const writeCache = (v: Cached) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

export type UseUserPrefs = {
  watchlist: string[];
  recents: string[];
  email: string | null;
  isInWatchlist: (s: string) => boolean;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  toggleWatchlist: (s: string) => void;
  pushRecent: (s: string) => void;
  removeRecent: (s: string) => void;
};

export const useUserPrefs = (): UseUserPrefs => {
  const initial = loadCache();
  const [watchlist, setWatchlist] = useState<string[]>(initial.watchlist);
  const [recents, setRecents] = useState<string[]>(initial.recents);
  const [email, setEmail] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<Cached>(initial);

  useEffect(() => {
    let cancelled = false;
    fetchUserPrefs()
      .then((p) => {
        if (cancelled) return;
        setEmail(p.email);
        setWatchlist(p.watchlist);
        setRecents(p.recents);
        latestRef.current = { watchlist: p.watchlist, recents: p.recents };
        writeCache(latestRef.current);
        hydratedRef.current = true;
      })
      .catch(() => {
        hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleSave = useCallback((next: Cached) => {
    latestRef.current = next;
    writeCache(next);
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveUserPrefs(latestRef.current).catch(() => {
        /* ignore; cache holds value */
      });
    }, 400);
  }, []);

  const normalize = (s: string): string | null => {
    const v = s.trim().toUpperCase();
    return SYMBOL_RE.test(v) ? v : null;
  };

  const isInWatchlist = useCallback((s: string) => watchlist.includes(s.toUpperCase()), [watchlist]);

  const addToWatchlist = useCallback(
    (raw: string) => {
      const s = normalize(raw);
      if (!s) return;
      setWatchlist((prev) => {
        if (prev.includes(s)) return prev;
        const next = [s, ...prev].slice(0, MAX_WATCHLIST);
        scheduleSave({ watchlist: next, recents: latestRef.current.recents });
        return next;
      });
    },
    [scheduleSave],
  );

  const removeFromWatchlist = useCallback(
    (raw: string) => {
      const s = raw.toUpperCase();
      setWatchlist((prev) => {
        if (!prev.includes(s)) return prev;
        const next = prev.filter((x) => x !== s);
        scheduleSave({ watchlist: next, recents: latestRef.current.recents });
        return next;
      });
    },
    [scheduleSave],
  );

  const toggleWatchlist = useCallback(
    (raw: string) => {
      const s = normalize(raw);
      if (!s) return;
      if (latestRef.current.watchlist.includes(s)) removeFromWatchlist(s);
      else addToWatchlist(s);
    },
    [addToWatchlist, removeFromWatchlist],
  );

  const pushRecent = useCallback(
    (raw: string) => {
      const s = normalize(raw);
      if (!s) return;
      setRecents((prev) => {
        if (prev[0] === s) return prev;
        const next = [s, ...prev.filter((x) => x !== s)].slice(0, MAX_RECENTS);
        scheduleSave({ watchlist: latestRef.current.watchlist, recents: next });
        return next;
      });
    },
    [scheduleSave],
  );

  const removeRecent = useCallback(
    (raw: string) => {
      const s = raw.toUpperCase();
      setRecents((prev) => {
        if (!prev.includes(s)) return prev;
        const next = prev.filter((x) => x !== s);
        scheduleSave({ watchlist: latestRef.current.watchlist, recents: next });
        return next;
      });
    },
    [scheduleSave],
  );

  // Keep latestRef in sync if state updated externally (defensive).
  useEffect(() => {
    latestRef.current = { watchlist, recents };
  }, [watchlist, recents]);

  return {
    watchlist,
    recents,
    email,
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    pushRecent,
    removeRecent,
  };
};
