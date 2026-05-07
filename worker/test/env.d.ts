declare module 'cloudflare:test' {
  interface ProvidedEnv {
    KV: KVNamespace;
    DB: D1Database;
  }
}
