/**
 * verifier.ts — Verificación de veracidad de fuentes para señales Radar v2.
 * Hace HEAD/GET a la URL de la fuente y valida fecha y monto.
 * SSRF-safe: bloquea rangos RFC 1918, loopback y IPv6 loopback.
 */
import 'server-only';
import type { Agente1Result } from '@/lib/radar-v2/schema';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type VerificationFlag =
  | 'verificada'
  | 'no_verificable'
  | 'pendiente'
  | 'no_aplica';

export interface VerificationFlags {
  fuente_verificada:          VerificationFlag;
  verificacion_http_status:   number | null;
  verificacion_fecha_valida:  boolean | null;
  verificacion_monto_coincide: boolean | null;
  verificacion_notas:         string | null;
}

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

/** Returns true if the hostname resolves to a private / loopback address. */
function isPrivateHostname(hostname: string): boolean {
  // Reject explicit loopback and reserved names
  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return true;
  }

  // Parse dotted-quad IPv4
  const ipv4Parts = hostname.split('.');
  if (ipv4Parts.length === 4) {
    const [a, b] = ipv4Parts.map(Number);
    // 10.0.0.0/8
    if (a === 10) return true;
    // 127.0.0.0/8
    if (a === 127) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
    // 0.x.x.x
    if (a === 0) return true;
  }

  // IPv6 loopback bracketed: [::1]
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const inner = hostname.slice(1, -1);
    if (inner === '::1' || inner === '0:0:0:0:0:0:0:1') return true;
  }

  return false;
}

function assertPublicUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`SSRF_GUARD: URL inválida — ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SSRF_GUARD: protocolo no permitido — ${parsed.protocol}`);
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new Error(`SSRF_GUARD: hostname privado/loopback — ${parsed.hostname}`);
  }
}

// ---------------------------------------------------------------------------
// Low-level HTTP helpers
// ---------------------------------------------------------------------------

const UA = 'Matec-Radar/2.0 (+https://matec.com.co)';

async function fetchHead(
  url: string,
  opts: { timeoutMs: number },
): Promise<{ status: number; ok: boolean }> {
  assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, {
      method:  'HEAD',
      headers: { 'User-Agent': UA },
      signal:  controller.signal,
      redirect: 'follow',
    });
    return { status: res.status, ok: res.ok };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBody(
  url: string,
  opts: { timeoutMs: number; maxBytes: number },
): Promise<string> {
  assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, {
      method:  'GET',
      headers: { 'User-Agent': UA },
      signal:  controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return '';
    // Stream only up to maxBytes to avoid huge downloads
    const reader = res.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.byteLength;
      if (totalBytes >= opts.maxBytes) {
        reader.cancel().catch(() => undefined);
        break;
      }
    }
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(combined);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Accepts "DD/MM/AAAA" format and returns true if date is valid and ≤ today. */
function isValidDMY(s: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false;
  const d = parseDMY(s);
  if (isNaN(d.getTime())) return false;
  return d <= new Date();
}

function parseDMY(s: string): Date {
  const [day, month, year] = s.split('/').map(Number);
  // month is 0-indexed in Date constructor
  return new Date(year, month - 1, day);
}

// ---------------------------------------------------------------------------
// Monto normalization
// ---------------------------------------------------------------------------

/**
 * Returns true if the raw body text contains a normalized representation
 * of the monto string, e.g. "USD 12M" → searches for 12M, 12 M,
 * 12,000,000  12.000.000  "12 millones".
 */
function containsMontoNormalized(body: string, monto: string): boolean {
  const lower = body.toLowerCase();

  // Extract all numeric tokens from monto (digits + optional decimal)
  const numMatch = monto.match(/[\d,.]+/);
  if (!numMatch) return false;

  const rawNum = numMatch[0].replace(/,/g, '').replace(/\./g, '');
  const numVal = parseFloat(rawNum);
  if (isNaN(numVal)) return false;

  // Magnitude suffix detection
  const suffix = monto.replace(/[\d,.\s]/g, '').toUpperCase();
  const isMillion  = /^M(IL(LION(ES)?)?)?$/.test(suffix) || monto.toUpperCase().includes('MILLON') || monto.toUpperCase().includes('MILLÓN');
  const isBillion  = /^B(IL(LION(ES)?)?)?$/.test(suffix) || monto.toUpperCase().includes('BILLON') || monto.toUpperCase().includes('BILLÓN');
  const isThousand = /^K$/.test(suffix) || monto.toUpperCase().includes('MIL ');

  const fullVal = isBillion
    ? numVal * 1_000_000_000
    : isMillion
    ? numVal * 1_000_000
    : isThousand
    ? numVal * 1_000
    : numVal;

  // Build candidate strings to look for in body
  const candidates: string[] = [];

  // Original numeric part compacted
  candidates.push(rawNum);

  // "12M", "12 M"
  if (suffix) {
    candidates.push(`${rawNum}${suffix.toLowerCase()}`);
    candidates.push(`${rawNum} ${suffix.toLowerCase()}`);
  }

  // Full number with dot/comma thousands separators
  if (fullVal >= 1_000) {
    // 12,000,000 style
    candidates.push(
      Math.round(fullVal)
        .toLocaleString('en-US')
        .toLowerCase(),
    );
    // 12.000.000 style
    candidates.push(
      Math.round(fullVal)
        .toLocaleString('de-DE')
        .toLowerCase(),
    );
  }

  // "12 millones", "12 mil"
  if (isMillion)  candidates.push(`${rawNum} millon`);
  if (isThousand) candidates.push(`${rawNum} mil`);

  return candidates.some((c) => lower.includes(c));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function verifyResult(
  r: Pick<Agente1Result, 'radar_activo' | 'fuente_link' | 'fecha_senal' | 'monto_inversion'>,
): Promise<VerificationFlags> {
  // Descartadas → no aplica
  if (r.radar_activo === 'No') {
    return {
      fuente_verificada:          'no_aplica',
      verificacion_http_status:   null,
      verificacion_fecha_valida:  null,
      verificacion_monto_coincide: null,
      verificacion_notas:         null,
    };
  }

  const url = r.fuente_link?.trim();

  // No URL or placeholder
  if (!url || url === 'No disponible' || url === '' || !/^https?:\/\//i.test(url)) {
    return {
      fuente_verificada:          'no_verificable',
      verificacion_http_status:   null,
      verificacion_fecha_valida:  null,
      verificacion_monto_coincide: null,
      verificacion_notas:         'URL no disponible',
    };
  }

  // SSRF check before any HTTP call
  try {
    assertPublicUrl(url);
  } catch (e) {
    return {
      fuente_verificada:          'no_verificable',
      verificacion_http_status:   null,
      verificacion_fecha_valida:  null,
      verificacion_monto_coincide: null,
      verificacion_notas:         e instanceof Error ? e.message : 'URL bloqueada',
    };
  }

  // HEAD request
  let httpStatus: number | null = null;
  let httpOk = false;
  try {
    const head = await fetchHead(url, { timeoutMs: 5_000 });
    httpStatus = head.status;
    httpOk     = head.ok;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('abort') || msg.includes('timeout') || msg.toLowerCase().includes('aborted');
    return {
      fuente_verificada:          isTimeout ? 'pendiente' : 'no_verificable',
      verificacion_http_status:   null,
      verificacion_fecha_valida:  null,
      verificacion_monto_coincide: null,
      verificacion_notas:         isTimeout ? 'Timeout en HEAD request' : `Error de red: ${msg.slice(0, 120)}`,
    };
  }

  // Date validation
  const fecha = r.fecha_senal?.trim() ?? '';
  let fechaOk: boolean | null = null;
  if (fecha && fecha !== 'No disponible') {
    fechaOk = isValidDMY(fecha);
  }

  // Monto validation — only if HTTP OK and monto is declared
  const monto = r.monto_inversion?.trim() ?? '';
  let montoOk: boolean | null = null;

  if (httpOk && monto && monto !== 'No reportado' && monto !== 'No disponible') {
    try {
      const body = await fetchBody(url, { timeoutMs: 8_000, maxBytes: 300_000 });
      if (body) {
        montoOk = containsMontoNormalized(body, monto);
      }
    } catch {
      // Non-fatal — leave montoOk null
    }
  }

  // Final verdict
  let estado: VerificationFlag;
  const notas: string[] = [];

  if (!httpOk) {
    estado = 'no_verificable';
    notas.push(`HTTP ${httpStatus ?? 'error'}`);
  } else if (fechaOk === false) {
    estado = 'no_verificable';
    notas.push('Fecha inválida o futura');
  } else if (montoOk === false) {
    estado = 'no_verificable';
    notas.push('Monto no encontrado en la fuente');
  } else {
    estado = 'verificada';
  }

  return {
    fuente_verificada:          estado,
    verificacion_http_status:   httpStatus,
    verificacion_fecha_valida:  fechaOk,
    verificacion_monto_coincide: montoOk,
    verificacion_notas:         notas.length > 0 ? notas.join('; ') : null,
  };
}
