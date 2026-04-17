/**
 * providers/openai.stub.ts — OpenAI provider stub.
 * `scan()` throws NotImplementedError until API key + real implementation is approved.
 * `estimate()` returns realistic cost numbers so the UI can render preview.
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

// GPT-4o pricing (as of 2026-04): $2.50 / 1M input, $10.00 / 1M output
const PRICE_INPUT_PER_M  = 2.5;
const PRICE_OUTPUT_PER_M = 10.0;

export const openaiProvider: AIProvider = {
  name:  'openai',
  model: 'gpt-4o',

  async scan(_params: ScanParams, _emit?: SSEEmitter): Promise<ScanResult> {
    throw new NotImplementedError('openai', 'scan');
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
    // OpenAI supports web_search (via tool_choice) and streaming, not prompt caching yet
    return feature === 'web_search' || feature === 'streaming';
  },
};
