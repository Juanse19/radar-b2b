/**
 * lib/apollo/enrich.ts — Apollo Bulk Match (email verificado + teléfono).
 *
 * Endpoint: POST /api/v1/people/bulk_match
 * Costo:
 *   - 1 crédito por contacto solo email (reveal_phone_number: false)
 *   - 9 créditos con teléfono (reveal_phone_number: true)
 *
 * Recibe un array de Apollo person IDs y devuelve los datos enriquecidos.
 */
import 'server-only';
import { apolloPost, type ApolloPostOptions } from './client';
import type { ApolloPersonEnriched, ApolloBulkMatchResponse } from './types';

export interface ApolloEnrichOptions {
  /** Si true, gasta 9 créditos por contacto a cambio del teléfono móvil. */
  revealPhone?:           boolean;
  /** Si true, intenta también revelar emails personales (no recomendado). */
  revealPersonalEmails?:  boolean;
  postOpts?:              ApolloPostOptions;
}

/**
 * Enriquece hasta 10 contactos por llamada (límite de bulk_match).
 * Si se pasan más de 10, divide internamente en chunks.
 */
export async function apolloEnrich(
  apolloIds: string[],
  opts: ApolloEnrichOptions = {},
): Promise<ApolloPersonEnriched[]> {
  if (!apolloIds.length) return [];

  const chunks = chunk(apolloIds, 10);
  const results: ApolloPersonEnriched[] = [];

  for (const ids of chunks) {
    const body: Record<string, unknown> = {
      details:                ids.map(id => ({ id })),
      reveal_personal_emails: opts.revealPersonalEmails ?? false,
      reveal_phone_number:    opts.revealPhone ?? false,
    };

    const data = await apolloPost<ApolloBulkMatchResponse>(
      '/people/bulk_match',
      body,
      opts.postOpts,
    );

    if (data.matches?.length) {
      results.push(...data.matches);
    }
  }

  return results;
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
