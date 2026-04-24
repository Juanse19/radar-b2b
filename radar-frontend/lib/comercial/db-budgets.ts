/**
 * db-budgets.ts — Token events and budget management for Radar v2 v3.
 *
 * Kept in a separate file from db.ts to avoid merge conflicts and make the
 * v3 token-management surface easy to locate. Uses the same pgQuery pattern.
 */
import 'server-only';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

// ---------------------------------------------------------------------------
// Token events — granular per-stage, per-company, per-provider
// ---------------------------------------------------------------------------

export type TokenStage = 'prefilter_haiku' | 'sonnet_scan' | 'criteria_eval' | 'report_gen';

export async function insertTokenEvent(data: {
  session_id:  string;
  empresa_id?: number | null;
  stage:       TokenStage;
  provider:    string;
  model:       string;
  tokens_in:   number;
  tokens_out:  number;
  cost_usd:    number;
  cached?:     boolean;
}): Promise<void> {
  await pgQuery(`
    INSERT INTO ${S}.radar_v2_token_events
      (session_id, empresa_id, stage, provider, model, tokens_in, tokens_out, cost_usd, cached)
    VALUES (
      ${pgLit(data.session_id)}, ${pgLit(data.empresa_id ?? null)},
      ${pgLit(data.stage)}, ${pgLit(data.provider)}, ${pgLit(data.model)},
      ${pgLit(data.tokens_in)}, ${pgLit(data.tokens_out)}, ${pgLit(data.cost_usd)},
      ${pgLit(data.cached ?? false)}
    )`);
}

export async function getSessionConsumption(sessionId: string): Promise<number> {
  const rows = await pgQuery<{ total: string }>(
    `SELECT COALESCE(SUM(cost_usd), 0)::text AS total
       FROM ${S}.radar_v2_token_events
      WHERE session_id = ${pgLit(sessionId)}`,
  );
  return parseFloat(rows[0]?.total ?? '0');
}

export async function getSessionTokenEvents(sessionId: string): Promise<Array<{
  id:          string;
  empresa_id:  number | null;
  stage:       TokenStage;
  provider:    string;
  model:       string;
  tokens_in:   number;
  tokens_out:  number;
  cost_usd:    number;
  cached:      boolean;
  created_at:  string;
}>> {
  return pgQuery(
    `SELECT id, empresa_id, stage, provider, model, tokens_in, tokens_out,
            cost_usd::float8 AS cost_usd, cached, created_at
       FROM ${S}.radar_v2_token_events
      WHERE session_id = ${pgLit(sessionId)}
      ORDER BY created_at ASC`,
  );
}

// ---------------------------------------------------------------------------
// Budget management
// ---------------------------------------------------------------------------

export type BudgetStatus = 'ok' | 'warning' | 'blocked';

export interface Budget {
  session_id:       string;
  limit_usd:        number;
  alert_thresholds: number[];
  alerts_fired:     number[];
  consumed_usd:     number;
  status:           BudgetStatus;
  created_at:       string;
  updated_at:       string;
}

export async function createBudget(data: {
  session_id: string;
  limit_usd:  number;
}): Promise<void> {
  await pgQuery(`
    INSERT INTO ${S}.radar_v2_budgets (session_id, limit_usd)
    VALUES (${pgLit(data.session_id)}, ${pgLit(data.limit_usd)})
    ON CONFLICT (session_id) DO UPDATE SET
      limit_usd  = EXCLUDED.limit_usd,
      updated_at = NOW()
  `);
}

export async function updateBudgetConsumed(
  sessionId: string,
  consumed:  number,
): Promise<void> {
  await pgQuery(`
    UPDATE ${S}.radar_v2_budgets
    SET consumed_usd = ${pgLit(consumed)},
        updated_at   = NOW(),
        status       = CASE
          WHEN ${pgLit(consumed)} >= limit_usd         THEN 'blocked'
          WHEN ${pgLit(consumed)} >= limit_usd * 0.8   THEN 'warning'
          ELSE 'ok'
        END
    WHERE session_id = ${pgLit(sessionId)}
  `);
}

export async function getBudget(sessionId: string): Promise<Budget | null> {
  type BudgetRow = {
    session_id:       string;
    limit_usd:        string;
    alert_thresholds: number[];
    alerts_fired:     number[];
    consumed_usd:     string;
    status:           BudgetStatus;
    created_at:       string;
    updated_at:       string;
  };
  const rows = await pgQuery<BudgetRow>(
    `SELECT session_id, limit_usd::text, alert_thresholds, alerts_fired,
            consumed_usd::text, status, created_at, updated_at
       FROM ${S}.radar_v2_budgets
      WHERE session_id = ${pgLit(sessionId)}
      LIMIT 1`,
  );
  const r = rows[0];
  if (!r) return null;
  return {
    session_id:       r.session_id,
    limit_usd:        parseFloat(r.limit_usd),
    alert_thresholds: Array.isArray(r.alert_thresholds) ? r.alert_thresholds : [0.5, 0.8, 0.95, 1.0],
    alerts_fired:     Array.isArray(r.alerts_fired) ? r.alerts_fired : [],
    consumed_usd:     parseFloat(r.consumed_usd),
    status:           r.status,
    created_at:       r.created_at,
    updated_at:       r.updated_at,
  };
}

export async function appendBudgetAlert(
  sessionId: string,
  threshold: number,
): Promise<void> {
  // Only append if threshold is not already present
  await pgQuery(`
    UPDATE ${S}.radar_v2_budgets
    SET alerts_fired = alerts_fired || ${pgLit(JSON.stringify([threshold]))}::jsonb,
        updated_at   = NOW()
    WHERE session_id = ${pgLit(sessionId)}
      AND NOT (alerts_fired @> ${pgLit(JSON.stringify([threshold]))}::jsonb)
  `);
}
