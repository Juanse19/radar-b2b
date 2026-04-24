/**
 * calificador/perfilador.ts — Web-search wrapper used before LLM scoring.
 * Providers call this (or handle it inline) to build empresa profile context.
 * Kept as a standalone module so it can be mocked in tests.
 */
import 'server-only';

export interface PerfilEmpresaResult {
  summary: string;
  sources: string[];
}

/**
 * Build a Tavily search query for empresa profiling.
 * Used by providers that don't have built-in web_search (e.g. Gemini fallback).
 */
export function buildPerfilQuery(empresa: string, pais: string, linea: string): string {
  return `"${empresa}" ${pais} industria planta manufactura inversión ${linea} 2025 2026`;
}

/** Placeholder — providers with native web_search (Claude, OpenAI) do this inline. */
export const EMPTY_PERFIL: PerfilEmpresaResult = {
  summary: '',
  sources: [],
};
