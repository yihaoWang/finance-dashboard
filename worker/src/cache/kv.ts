export const kvGetJson = async <T>(kv: KVNamespace, key: string): Promise<T | null> => {
  const raw = await kv.get(key);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
};

export const kvPutJson = async (
  kv: KVNamespace,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> => {
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
};
