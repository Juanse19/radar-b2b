/**
 * providers/index.ts — Registry and factory for Radar v2 AI providers.
 *
 * Use `getProvider(name?)` to obtain a provider instance. Falls back to the
 * `RADAR_V2_DEFAULT_PROVIDER` env var, then to 'claude'.
 */
import 'server-only';
import type { AIProvider } from './types';
import { claudeProvider } from './claude';
import { openaiProvider } from './openai';
import { geminiProvider } from './gemini';

const registry: Record<string, AIProvider> = {
  claude:     claudeProvider,
  anthropic:  claudeProvider,   // alias from admin API
  openai:     openaiProvider,
  gemini:     geminiProvider,
  google:     geminiProvider,   // alias from admin API (provider stored as 'google')
};

/** Returns a provider by name (or the default if `name` is null/undefined). */
export function getProvider(name?: string | null): AIProvider {
  const key = (name ?? process.env.RADAR_V2_DEFAULT_PROVIDER ?? 'claude').toLowerCase();
  const p = registry[key];
  if (!p) {
    throw new Error(
      `Unknown provider: '${key}'. Available: ${Object.keys(registry).join(', ')}`,
    );
  }
  return p;
}

/** Metadata for UI model picker (admin, wizard step 3). */
export function listProviders(): Array<{
  name:                string;
  model:               string;
  supports_web_search: boolean;
  implemented:         boolean;
}> {
  return Object.values(registry).map((p) => ({
    name:                p.name,
    model:               p.model,
    supports_web_search: p.supports('web_search'),
    // All three providers now have real implementations.
    implemented:         true,
  }));
}

export * from './types';
