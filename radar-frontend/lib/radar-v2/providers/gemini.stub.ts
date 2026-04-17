/**
 * providers/gemini.stub.ts — Google Gemini provider stub.
 * Same pattern as openai.stub.ts.
 */
import 'server-only';
import type {
  AIProvider,
  CostEstimate,
  EstimateParams,
  ScanParams,
  ScanResult,
  SupportedFeature,
  SSEEmitter,
} from './types';
import { NotImplementedError } from './types';

// Gemini 3 Pro pricing (as of 2026-04): $2.00 / 1M input, $12.00 / 1M output
const PRICE_INPUT_PER_M  = 2.0;
const PRICE_OUTPUT_PER_M = 12.0;

export const geminiProvider: AIProvider = {
  name:  'gemini',
  model: 'gemini-3-pro',

  async scan(_params: ScanParams, _emit?: SSEEmitter): Promise<ScanResult> {
    throw new NotImplementedError('gemini', 'scan');
  },

  estimate(params: EstimateParams): CostEstimate {
    const tokens_in_est  = params.empresas_count * 6500;
    const tokens_out_est = params.empresas_count * 800;
    const cost_usd_est =
      (tokens_in_est  * PRICE_INPUT_PER_M  / 1_000_000) +
      (tokens_out_est * PRICE_OUTPUT_PER_M / 1_000_000);
    return { tokens_in_est, tokens_out_est, cost_usd_est, cached_percentage: 0 };
  },

  supports(feature: SupportedFeature): boolean {
    // Gemini supports web_search (Google Search grounding) and streaming.
    return feature === 'web_search' || feature === 'streaming';
  },
};
