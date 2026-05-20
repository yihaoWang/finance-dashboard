// Module-level FinMind token. Set once at the start of each request/cron via
// `setFinMindToken(env.FINMIND_API_TOKEN)`. CF Worker isolates persist this
// between requests with the same env, which is safe because the token is per-deploy.
let _token = '';

export const setFinMindToken = (t: string | undefined): void => {
  _token = t ?? '';
};

export const finMindToken = (): string => _token;
