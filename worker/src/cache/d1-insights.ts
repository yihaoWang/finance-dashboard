import type { Insight, InsightSourceKind } from '@fd/shared';

type Row = {
  id: string;
  source: string;
  source_kind: string;
  episode_title: string;
  episode_url: string | null;
  audio_url: string | null;
  published_at: number;
  main_thesis: string;
  validation_signals: string;
  reversal_signals: string;
  framework_tags: string;
  action_horizon: string | null;
  action_suggestion: string | null;
  model: string;
  created_at: number;
};

const parseJsonArray = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x): x is string => typeof x === 'string')) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
};

const rowToInsight = (r: Row): Insight => ({
  id: r.id,
  source: r.source,
  sourceKind: r.source_kind as InsightSourceKind,
  episodeTitle: r.episode_title,
  episodeUrl: r.episode_url,
  audioUrl: r.audio_url,
  publishedAt: r.published_at,
  mainThesis: r.main_thesis,
  validationSignals: parseJsonArray(r.validation_signals),
  reversalSignals: parseJsonArray(r.reversal_signals),
  frameworkTags: parseJsonArray(r.framework_tags),
  actionHorizon: r.action_horizon,
  actionSuggestion: r.action_suggestion,
  model: r.model,
  createdAt: r.created_at,
});

export const upsertInsight = async (
  db: D1Database,
  insight: Insight,
  rawTranscript: string | null,
): Promise<void> => {
  await db
    .prepare(
      `INSERT OR REPLACE INTO insights
        (id, source, source_kind, episode_title, episode_url, audio_url, published_at,
         main_thesis, validation_signals, reversal_signals, framework_tags,
         action_horizon, action_suggestion, raw_transcript, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      insight.id,
      insight.source,
      insight.sourceKind,
      insight.episodeTitle,
      insight.episodeUrl,
      insight.audioUrl,
      insight.publishedAt,
      insight.mainThesis,
      JSON.stringify(insight.validationSignals),
      JSON.stringify(insight.reversalSignals),
      JSON.stringify(insight.frameworkTags),
      insight.actionHorizon,
      insight.actionSuggestion,
      rawTranscript,
      insight.model,
      insight.createdAt,
    )
    .run();
};

export const listRecentInsights = async (
  db: D1Database,
  sinceTs: number,
  limit: number,
): Promise<Insight[]> => {
  const res = await db
    .prepare(
      `SELECT id, source, source_kind, episode_title, episode_url, audio_url, published_at,
              main_thesis, validation_signals, reversal_signals, framework_tags,
              action_horizon, action_suggestion, model, created_at
       FROM insights WHERE published_at >= ?
       ORDER BY published_at DESC LIMIT ?`,
    )
    .bind(sinceTs, limit)
    .all<Row>();
  return (res.results ?? []).map(rowToInsight);
};
