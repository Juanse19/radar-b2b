/**
 * lib/apollo/search.ts — Apollo People Search (gratis, sin email verificado).
 *
 * Endpoint: POST /api/v1/mixed_people/api_search
 * Costo: 0 créditos.
 *
 * Devuelve hasta `perPage` candidatos por dominio + job titles + país.
 * Para multi-país hacer una llamada por país (Apollo no filtra múltiples
 * países confiablemente en una sola request).
 */
import 'server-only';
import { apolloPost, type ApolloPostOptions } from './client';
import type { ApolloPersonSearch, ApolloSearchResponse } from './types';

export interface ApolloSearchParams {
  /** Dominio de la empresa, ej: "grupobimbo.com" */
  domain:  string;
  /** Job titles a buscar (Apollo los hace OR entre ellos). */
  titles:  string[];
  /** País en formato ISO/Apollo (ej "Colombia", "Mexico"). */
  country: string;
  /** Tamaño de página (default 25, máx 100). */
  perPage?: number;
  /** Página (default 1). */
  page?: number;
  /** Hooks opcionales para retry/rate-limit notifications. */
  postOpts?: ApolloPostOptions;
}

/**
 * Ejecuta una búsqueda en Apollo People Search.
 * Devuelve solo el array de personas (puede estar vacío).
 */
export async function apolloSearch(params: ApolloSearchParams): Promise<ApolloPersonSearch[]> {
  if (!params.domain) {
    throw new Error('apolloSearch: domain is required');
  }
  if (!params.titles?.length) {
    throw new Error('apolloSearch: at least one job title is required');
  }

  const body: Record<string, unknown> = {
    q_organization_domains_list: [params.domain],
    person_titles:                params.titles,
    person_locations:             [params.country],
    per_page:                     Math.min(Math.max(params.perPage ?? 25, 1), 100),
    page:                         params.page ?? 1,
  };

  const data = await apolloPost<ApolloSearchResponse>(
    '/mixed_people/api_search',
    body,
    params.postOpts,
  );

  return data.people ?? [];
}
