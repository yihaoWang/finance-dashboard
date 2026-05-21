CREATE TABLE IF NOT EXISTS user_prefs (
  email TEXT PRIMARY KEY,
  watchlist TEXT NOT NULL DEFAULT '[]',
  recents TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
