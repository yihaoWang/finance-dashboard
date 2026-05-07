type Options = {
  fetcher?: typeof fetch;
  maxAttempts?: number;
  baseDelayMs?: number;
};

export const fetchWithRetry = async (
  url: string,
  init: RequestInit = {},
  opts: Options = {},
): Promise<Response> => {
  const fetcher = opts.fetcher ?? fetch;
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 200;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetcher(url, init);
    if (res.ok) return res;
    if (res.status < 500) throw new Error('fetch_failed');
    if (attempt === maxAttempts) throw new Error('fetch_failed');
    await new Promise((r) => setTimeout(r, baseDelay * 2 ** (attempt - 1)));
  }
  throw new Error('fetch_failed');
};
