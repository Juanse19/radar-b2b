/**
 * /api/prospector/v2/search — Server-Sent Events endpoint para búsqueda nativa
 * de contactos vía Apollo.io (reemplaza WF03 n8n).
 *
 * Acepta POST con un payload JSON. Retorna `text/event-stream` con la timeline
 * de la búsqueda en vivo: searching → found → enriching → contact → saved →
 * company_done → ... → session_done.
 *
 * El cliente (ProspectorLiveView) consume este stream y renderiza tarjetas
 * incrementales conforme llegan los eventos.
 *
 * Headers de respuesta:
 *   - Content-Type: text/event-stream
 *   - Last-Event-ID en request: replay desde ese ID
 */
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import {
  createSSEEmitter,
  getReplayEvents,
  replayBuffered,
} from '@/lib/comercial/sse-emitter';
import {
  apolloSearch,
} from '@/lib/apollo/search';
import {
  apolloEnrich,
} from '@/lib/apollo/enrich';
import {
  ApolloRateLimitError,
  ApolloHttpError,
} from '@/lib/apollo/client';
import { getDefaultTitles } from '@/lib/apollo/job-titles';
import { classifyLevel, NIVEL_ORDEN, type Nivel } from '@/lib/prospector/levels';
import { creditCost } from '@/lib/prospector/phone-rules';
import {
  alreadyEnriched,
  buildContactResult,
  createProspectorSession,
  finalizeProspectorSession,
  findEmpresaIdByNameCountry,
  upsertContact,
  upsertSinContactos,
} from '@/lib/prospector/db';
import {
  isProspectorCancelled,
  clearProspectorCancellation,
} from '@/lib/prospector/cancellation';
import { SESSION_CONTACT_CAP } from '@/lib/prospector/stream-events';
import type { ApolloPersonEnriched } from '@/lib/apollo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Apollo + enrich loops pueden tomar varios minutos; alineamos al cap de Vercel.
export const maxDuration = 300;

// 1.5 segundos entre llamadas Apollo: respetar rate limit y dejar tiempo a la UI.
const APOLLO_DELAY_MS = 1_500;

// ---------------------------------------------------------------------------
// Validación del input
// ---------------------------------------------------------------------------

const SearchEmpresaSchema = z.object({
  empresa_id: z.number().int().positive().optional(),
  empresa:    z.string().min(1),
  pais:       z.string().min(1),
  dominio:    z.string().optional().nullable(),
  sublinea:   z.string().optional().nullable(),
  tier:       z.string().optional().nullable(),
});

const SearchRequestSchema = z.object({
  sessionId:    z.string().uuid(),
  modo:         z.enum(['auto', 'manual']),
  sublineas:    z.array(z.string()).default([]),
  tiers:        z.array(z.string()).optional(),
  empresas:     z.array(SearchEmpresaSchema).min(1).max(20),
  job_titles:   z.array(z.string()).optional(),
  max_contactos: z.number().int().min(1).max(10).default(3),
  reveal_phone_auto: z.boolean().default(false),
});

type SearchRequestBody = z.infer<typeof SearchRequestSchema>;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: SearchRequestBody;
  try {
    const json = await req.json();
    body = SearchRequestSchema.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid body';
    return new Response(`Invalid request: ${msg}`, { status: 400 });
  }

  const lastEventId = Number.parseInt(req.headers.get('last-event-id') ?? '0', 10) || 0;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const replay = lastEventId > 0 ? getReplayEvents(body.sessionId, lastEventId) : null;
  const emitter = createSSEEmitter(writer, body.sessionId);

  // Lanzamos el pipeline async; la ReadableStream se entrega al browser
  // inmediatamente para que comience a recibir headers + replay.
  void runPipeline({ body, emitter, replay, writer, userId: session.id ?? null });

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-store, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ---------------------------------------------------------------------------
// Pipeline principal
// ---------------------------------------------------------------------------

interface PipelineArgs {
  body:    SearchRequestBody;
  emitter: ReturnType<typeof createSSEEmitter>;
  writer:  WritableStreamDefaultWriter<Uint8Array>;
  replay:  ReturnType<typeof getReplayEvents>;
  userId:  string | null;
}

async function runPipeline({ body, emitter, writer, replay, userId }: PipelineArgs): Promise<void> {
  const { sessionId, modo, sublineas, tiers, empresas, job_titles, max_contactos, reveal_phone_auto } = body;
  const t0 = Date.now();
  let totalContacts  = 0;
  let totalWithEmail = 0;
  let totalWithPhone = 0;
  let creditsUsed    = 0;
  let cancelled      = false;
  let reason: 'cap_reached' | 'cancelled' | 'completed' = 'completed';

  try {
    if (replay && replay.length) {
      await replayBuffered(writer, replay);
    }

    // Crear la sesión en BD. CRÍTICO: si falla, abortamos antes de gastar
    // créditos Apollo en contactos que no podrán guardarse (FK violation).
    try {
      await createProspectorSession({
        id:                sessionId,
        user_id:           userId,
        modo,
        sublineas,
        tiers:             tiers ?? null,
        empresas_count:    empresas.length,
        estimated_credits: empresas.length * max_contactos * (reveal_phone_auto ? 9 : 1),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[prospector v2] createProspectorSession failed:', msg);
      emitter.emit('error', {
        message: `No se pudo crear la sesión en la base de datos: ${msg.slice(0, 200)}`,
        scope:   'session',
      });
      // Emitir session_done con 0 contactos para cerrar limpio.
      emitter.emit('session_done', {
        sessionId,
        total_companies:  empresas.length,
        total_contacts:   0,
        total_with_email: 0,
        total_with_phone: 0,
        credits_used:     0,
        duration_ms:      Date.now() - t0,
        cancelled:        true,
        reason:           'cancelled' as const,
      });
      await emitter.close();
      return;
    }

    emitter.emit('session_started', {
      sessionId,
      modo,
      empresas: empresas.map((e: z.infer<typeof SearchEmpresaSchema>) => ({
        empresa: e.empresa,
        pais:    e.pais,
        sublinea: e.sublinea ?? null,
      })),
      sublineas,
      total_jobs:        empresas.length,
      estimated_credits: empresas.length * max_contactos * (reveal_phone_auto ? 9 : 1),
    });

    for (let i = 0; i < empresas.length; i++) {
      if (emitter.closed) break;

      if (isProspectorCancelled(sessionId)) {
        cancelled = true;
        reason    = 'cancelled';
        break;
      }

      if (totalContacts >= SESSION_CONTACT_CAP) {
        reason = 'cap_reached';
        break;
      }

      const target = empresas[i];

      emitter.emit('company_started', {
        empresa: target.empresa,
        pais:    target.pais,
        sublinea: target.sublinea ?? null,
        index:   i + 1,
        total:   empresas.length,
      });

      const companyT0 = Date.now();

      const stats = await processCompany({
        target,
        sessionId,
        emitter,
        max_contactos,
        reveal_phone_auto,
        job_titles,
      });

      totalContacts  += stats.saved;
      totalWithEmail += stats.with_email;
      totalWithPhone += stats.with_phone;
      creditsUsed    += stats.credits;

      emitter.emit('company_done', {
        empresa:    target.empresa,
        pais:       target.pais,
        found:      stats.found,
        saved:      stats.saved,
        skipped:    stats.skipped,
        duration_ms: Date.now() - companyT0,
      });

      if (i < empresas.length - 1) {
        await sleep(APOLLO_DELAY_MS);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emitter.emit('error', { message: msg, scope: 'session' });
  } finally {
    const duration_ms = Date.now() - t0;

    try {
      await finalizeProspectorSession({
        id:               sessionId,
        total_contacts:   totalContacts,
        total_with_email: totalWithEmail,
        total_with_phone: totalWithPhone,
        credits_used:     creditsUsed,
        duration_ms,
        cancelled,
      });
    } catch (err) {
      console.error('[prospector v2] finalizeProspectorSession failed:', err);
    }

    emitter.emit('session_done', {
      sessionId,
      total_companies:  empresas.length,
      total_contacts:   totalContacts,
      total_with_email: totalWithEmail,
      total_with_phone: totalWithPhone,
      credits_used:     creditsUsed,
      duration_ms,
      cancelled,
      reason,
    });

    clearProspectorCancellation(sessionId);
    await emitter.close();
  }
}

// ---------------------------------------------------------------------------
// Procesar una empresa: search + enrich + persist
// ---------------------------------------------------------------------------

interface CompanyStats {
  found:      number;
  saved:      number;
  skipped:    number;
  with_email: number;
  with_phone: number;
  credits:    number;
}

interface ProcessCompanyArgs {
  target:            z.infer<typeof SearchEmpresaSchema>;
  sessionId:         string;
  emitter:           ReturnType<typeof createSSEEmitter>;
  max_contactos:     number;
  reveal_phone_auto: boolean;
  job_titles?:       string[];
}

async function processCompany(args: ProcessCompanyArgs): Promise<CompanyStats> {
  const stats: CompanyStats = {
    found: 0, saved: 0, skipped: 0,
    with_email: 0, with_phone: 0, credits: 0,
  };

  const { target, sessionId, emitter, max_contactos, reveal_phone_auto, job_titles } = args;
  const titles = job_titles?.length ? job_titles : getDefaultTitles(target.sublinea);

  // 1. Resolver empresa_id (si el frontend no lo envió, buscar por nombre).
  let empresaId = target.empresa_id ?? null;
  if (!empresaId) {
    empresaId = await findEmpresaIdByNameCountry(target.empresa, target.pais);
  }

  if (!empresaId) {
    emitter.emit('company_error', {
      empresa: target.empresa,
      pais:    target.pais,
      error:   `Empresa "${target.empresa}" no existe en el catálogo de Matec`,
    });
    return stats;
  }

  if (!target.dominio) {
    emitter.emit('company_error', {
      empresa: target.empresa,
      pais:    target.pais,
      error:   'Dominio no configurado para esta empresa — agrega el dominio antes de buscar',
    });
    return stats;
  }

  emitter.emit('searching', {
    empresa: target.empresa,
    pais:    target.pais,
    titles_count: titles.length,
  });

  // 2. Apollo Search (gratis)
  let candidates;
  try {
    candidates = await apolloSearch({
      domain:  target.dominio,
      titles,
      country: target.pais,
      perPage: Math.min(25, max_contactos * 5),
      postOpts: {
        onRateLimit: (attempt, waitMs) => {
          emitter.emit('rate_limit', {
            empresa: target.empresa,
            pais:    target.pais,
            attempt,
            retry_in_ms: waitMs,
          });
        },
      },
    });
  } catch (err) {
    emitter.emit('company_error', {
      empresa: target.empresa,
      pais:    target.pais,
      error:   formatApolloError(err),
    });
    return stats;
  }

  if (!candidates.length) {
    emitter.emit('no_results', {
      empresa: target.empresa,
      pais:    target.pais,
    });
    try {
      await upsertSinContactos({
        empresa_id:  empresaId,
        motivo:      'Sin resultados en Apollo People Search',
        job_titles:  titles,
        paises:      [target.pais],
      });
    } catch (err) {
      console.error('[prospector v2] upsertSinContactos failed:', err);
    }
    return stats;
  }

  emitter.emit('found', {
    empresa:    target.empresa,
    pais:       target.pais,
    candidates: candidates.length,
  });

  // 3. Ordenar por nivel y tomar los mejores
  type Sortable = (typeof candidates)[number] & { _nivel: Nivel };
  const ranked: Sortable[] = candidates
    .map(p => ({ ...p, _nivel: classifyLevel(p.title) }))
    .sort((a, b) => NIVEL_ORDEN[a._nivel] - NIVEL_ORDEN[b._nivel])
    .slice(0, max_contactos);

  // 4. Enriquecer uno por uno (email + opcional teléfono)
  for (let idx = 0; idx < ranked.length; idx++) {
    if (emitter.closed) break;
    if (isProspectorCancelled(sessionId)) break;

    const ct = ranked[idx];

    // Skip si ya tiene email verificado en BD
    try {
      if (await alreadyEnriched(ct.id)) {
        emitter.emit('skipped_duplicate', {
          apollo_id: ct.id,
          empresa:   target.empresa,
          motivo:    'already_enriched',
        });
        stats.skipped += 1;
        continue;
      }
    } catch (err) {
      console.error('[prospector v2] alreadyEnriched failed:', err);
    }

    emitter.emit('enriching', {
      empresa: target.empresa,
      pais:    target.pais,
      nombre:  ct.first_name ?? ct.name ?? '',
      cargo:   ct.title ?? '',
      nivel:   ct._nivel,
      reveal_phone: reveal_phone_auto,
    });

    let enriched: ApolloPersonEnriched[] = [];
    try {
      enriched = await apolloEnrich([ct.id], {
        revealPhone: reveal_phone_auto,
        postOpts: {
          onRateLimit: (attempt, waitMs) => {
            emitter.emit('rate_limit', {
              empresa: target.empresa,
              pais:    target.pais,
              attempt,
              retry_in_ms: waitMs,
            });
          },
        },
      });
      stats.credits += creditCost(reveal_phone_auto);
    } catch (err) {
      emitter.emit('company_error', {
        empresa: target.empresa,
        pais:    target.pais,
        error:   formatApolloError(err),
      });
      continue;
    }

    const data = enriched[0];

    // Sin email verificado → no contar como contacto válido
    const validStatuses = new Set(['verified', 'extrapolated', 'probable']);
    if (!data?.email || !validStatuses.has(data.email_status ?? '')) {
      continue;
    }

    stats.found += 1;

    const phoneMobile  = data.phone_numbers?.find(p => p.type === 'mobile')?.raw_number ?? null;
    const phoneWork    = data.phone_numbers?.find(p => p.type === 'work')?.raw_number ?? null;
    const corpPhone    = data.organization_phone ?? null;

    const result = buildContactResult({
      apollo_id:    ct.id,
      first_name:   data.first_name ?? ct.first_name ?? '',
      last_name:    data.last_name  ?? ct.last_name  ?? '',
      title:        ct.title ?? data.title ?? '',
      nivel:        ct._nivel,
      empresa:      target.empresa,
      pais:         target.pais,
      sublinea:     target.sublinea ?? null,
      linkedin:     ct.linkedin_url ?? data.linkedin_url ?? null,
      email:        data.email,
      estado_email: data.email_status ?? 'unknown',
      tel_empresa:  phoneWork ?? corpPhone,
      tel_movil:    reveal_phone_auto ? phoneMobile : null,
      phone_unlocked: false,
      es_principal: idx === 0,
    });

    emitter.emit('contact', result);

    // 5. Persistir
    try {
      const saved = await upsertContact({
        apollo_id:        ct.id,
        empresa_id:       empresaId,
        prospector_session_id: sessionId,
        first_name:       result.nombre,
        last_name:        result.apellido,
        title:            result.cargo,
        nivel:            ct._nivel,
        email:            result.email,
        email_status:     result.estado_email,
        phone_mobile:     result.tel_movil,
        phone_work_direct: phoneWork,
        corporate_phone:  corpPhone,
        linkedin_url:     result.linkedin,
        country:          target.pais,
        apollo_person_raw: data,
        es_principal:     idx === 0,
        fase2_done:       true,
      });

      emitter.emit('saved', {
        apollo_id:   saved.apollo_id,
        contacto_id: saved.id,
      });

      stats.saved      += 1;
      stats.with_email += 1;
      if (result.tel_movil) stats.with_phone += 1;
    } catch (err) {
      console.error('[prospector v2] upsertContact failed:', err);
      emitter.emit('company_error', {
        empresa: target.empresa,
        pais:    target.pais,
        error:   `DB upsert failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    await sleep(300);
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function formatApolloError(err: unknown): string {
  if (err instanceof ApolloRateLimitError) {
    return `Apollo rate limit exhausted (retry after ${Math.round(err.retryAfterMs / 1000)}s)`;
  }
  if (err instanceof ApolloHttpError) {
    return `Apollo HTTP ${err.status}: ${err.body.slice(0, 120)}`;
  }
  return err instanceof Error ? err.message : String(err);
}
