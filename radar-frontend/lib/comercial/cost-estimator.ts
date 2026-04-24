/**
 * cost-estimator.ts — Combines provider.estimate() with adjustments for
 * fuentes/keywords padding, prompt caching, and optional Haiku prefilter.
 *
 * Returns a CostEstimate + a recommended budget (with 50% buffer).
 */
import 'server-only';
import type { AIProvider, CostEstimate } from './providers/types';

export interface EstimateCostArgs {
  provider:        AIProvider;
  empresas_count:  number;
  linea:           string;
  fuentes_count?:  number;
  keywords_count?: number;
  /** If true, applies a 35% reduction assuming Haiku prefilter discards ~35% of empresas. */
  with_prefilter?: boolean;
}

export interface EstimateCostResult extends CostEstimate {
  budget_recommended_usd: number;
  /** Breakdown per stage for admin / debug */
  breakdown: {
    base_cost_usd:          number;
    fuentes_keywords_extra: number;
    prefilter_savings:      number;
    cache_savings:          number;
  };
}

export function estimateCost(args: EstimateCostArgs): EstimateCostResult {
  const base = args.provider.estimate({
    linea:           args.linea,
    empresas_count:  args.empresas_count,
    fuentes_count:   args.fuentes_count,
    keywords_count:  args.keywords_count,
  });

  // Fuentes / keywords add roughly 50 tokens each to the system prompt
  const extra_tokens_in = (args.fuentes_count ?? 0) * 50 + (args.keywords_count ?? 0) * 30;
  const extra_cost_usd  = (extra_tokens_in * 3.0) / 1_000_000;

  // Prompt caching saves ~30% of input tokens when empresas_count >= 2
  const cache_saved_usd = base.cached_percentage * base.cost_usd_est;

  // Prefilter discards ~35% of empresas → scales cost down before the padding
  const prefilter_saved_usd = args.with_prefilter ? base.cost_usd_est * 0.35 : 0;

  const cost_usd_est = Math.max(
    0,
    base.cost_usd_est + extra_cost_usd - cache_saved_usd - prefilter_saved_usd,
  );

  return {
    tokens_in_est:     base.tokens_in_est + extra_tokens_in,
    tokens_out_est:    base.tokens_out_est,
    cost_usd_est,
    cached_percentage: base.cached_percentage,
    budget_recommended_usd: Number((cost_usd_est * 1.5).toFixed(4)),
    breakdown: {
      base_cost_usd:          base.cost_usd_est,
      fuentes_keywords_extra: extra_cost_usd,
      prefilter_savings:      prefilter_saved_usd,
      cache_savings:          cache_saved_usd,
    },
  };
}
