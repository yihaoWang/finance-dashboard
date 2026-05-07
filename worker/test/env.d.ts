declare module 'cloudflare:test' {
  interface ProvidedEnv {
    KV: KVNamespace;
    DB: D1Database;
    TEST_MIGRATIONS: import('@cloudflare/vitest-pool-workers/config').D1Migration[];
  }
}
