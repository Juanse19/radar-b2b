/**
 * providers/types.ts — Shared types for the Radar v2 AI provider abstraction.
 *
 * The `AIProvider` interface allows the scanner to delegate work to any
 * implementation (Claude, OpenAI, Gemini, ...) behind a single contract.
 * No `server-only` here so types can be referenced by server code freely.
 */
import type { Agente1Result } from '@/lib/radar-v2/schema';

// ---------------------------------------------------------------------------
// Scan parameters and result types
// ---------------------------------------------------------------------------

export interface ScanParams {
  company: { id?: number; name: string; country: string };
  line: string;
  sessionId?: string;
  empresaId?: number | null;
  /** Optional API key override — if set, the provider uses this instead of the env var. */
  apiKey?: string;
  /** Optional model override — if set, the provider uses this instead of its default. */
  model?: string;
}

export interface CostEstimate {
  tokens_in_est: number;
  tokens_out_est: number;
  cost_usd_est: number;
  /** Fraction (0-1) of input tokens that are expected to hit the prompt cache */
  cached_percentage: number;
}

export interface ScanResult {
  result: Agente1Result;
  tokens_input: number;
  tokens_output: number;
  cached_tokens?: number;
  search_calls?: number;
  cost_usd: number;
  model: string;
}

export interface EstimateParams {
  linea: string;
  empresas_count: number;
  fuentes_count?: number;
  keywords_count?: number;
}

export type SupportedFeature =
  | 'web_search'
  | 'streaming'
  | 'batch'
  | 'prompt_caching';

// ---------------------------------------------------------------------------
// SSE emitter — implementation lives in lib/radar-v2/sse-emitter.ts (Fase G)
// Defined here as a structural interface so providers can stay decoupled.
// ---------------------------------------------------------------------------

export interface SSEEmitter {
  emit(event: string, data: unknown): void;
}

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

export interface AIProvider {
  /** Unique provider identifier, e.g. 'claude', 'openai', 'gemini'. */
  readonly name: string;
  /** Model string reported in telemetry / token events. */
  readonly model: string;

  /** Run a scan for a single company. Emits SSE events if `emit` is provided. */
  scan(params: ScanParams, emit?: SSEEmitter): Promise<ScanResult>;

  /** Estimate token usage and cost before actually scanning. */
  estimate(params: EstimateParams): CostEstimate;

  /** Feature capability probe — used by UI to enable/disable options. */
  supports(feature: SupportedFeature): boolean;
}

// ---------------------------------------------------------------------------
// Error type used by stub providers
// ---------------------------------------------------------------------------

export class NotImplementedError extends Error {
  constructor(provider: string, feature?: string) {
    super(
      `Provider '${provider}'${feature ? ` does not support '${feature}'` : ''} is not yet implemented`,
    );
    this.name = 'NotImplementedError';
  }
}
