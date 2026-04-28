/**
 * lib/radar/chatInterpreter.ts — Convierte una pregunta libre del usuario
 * en parámetros estructurados para el RADAR (modo + filtros).
 *
 * Implementación inicial: heurística regex/keyword. Provee la API esperada
 * por el endpoint /api/radar/chat. Una segunda iteración puede sustituir el
 * cuerpo por una llamada a un LLM ligero (Haiku / 4o-mini) sin cambiar la
 * firma — el contrato `interpretChat()` es estable.
 */
import 'server-only';

export interface InterpretedQuery {
  mode:      'empresa' | 'señales' | 'chat';
  linea:     string | null;
  empresa:   string | null;
  paises:    string[];
  keywords:  string[];
  raw:       string;
}

const LINEAS = [
  { key: 'BHS',            patterns: [/bhs/i, /aeropuerto/i, /terminal/i, /carrusel/i, /equipaje/i] },
  { key: 'Cartón',         patterns: [/cart[óo]n/i, /papel/i, /corrugadora/i, /corrugado/i] },
  { key: 'Intralogística', patterns: [/intralog[íi]stica/i, /cedi/i, /wms/i, /ASRS/i, /almac[eé]n/i, /sortation/i] },
  { key: 'Final de Línea', patterns: [/final\s+de\s+l[íi]nea/i, /palletizador/i, /alimentos\s+y\s+bebidas/i, /packaging/i] },
  { key: 'Motos',          patterns: [/motos?/i, /ensambladora/i, /motocicleta/i] },
  { key: 'Solumat',        patterns: [/solumat/i, /pl[áa]stico/i, /molde/i] },
];

const PAIS_MAP: Array<{ pais: string; patterns: RegExp[] }> = [
  { pais: 'Colombia',  patterns: [/colombia/i] },
  { pais: 'México',    patterns: [/m[ée]xico/i] },
  { pais: 'Chile',     patterns: [/chile/i] },
  { pais: 'Perú',      patterns: [/per[úu]/i] },
  { pais: 'Argentina', patterns: [/argentina/i] },
  { pais: 'Brasil',    patterns: [/brasil/i] },
  { pais: 'Panamá',    patterns: [/panam[áa]/i] },
];

const STOPWORDS = new Set([
  'busca', 'busca señales', 'mostrame', 'cu[áa]l', 'qu[ée]', 'hay', 'de', 'en', 'la', 'el',
  'para', 'con', 'sin', 'me', 'algunas', 'todas', 'recientes',
]);

function detectLinea(text: string): string | null {
  for (const l of LINEAS) {
    if (l.patterns.some((p) => p.test(text))) return l.key;
  }
  return null;
}

function detectPaises(text: string): string[] {
  const found: string[] = [];
  for (const p of PAIS_MAP) {
    if (p.patterns.some((rx) => rx.test(text))) found.push(p.pais);
  }
  return found;
}

function detectEmpresa(text: string): string | null {
  // Captura "de Empresa Nombre", "<Empresa>"
  const m1 = text.match(/de\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚáéíóúñü\-]*(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚáéíóúñü\-]*){0,3})/);
  if (m1) return m1[1].trim();
  const m2 = text.match(/"([^"]{2,80})"/);
  if (m2) return m2[1].trim();
  return null;
}

function detectMode(text: string, hasEmpresa: boolean): InterpretedQuery['mode'] {
  if (hasEmpresa) return 'empresa';
  if (/se[ñn]al|licitaci[óo]n|inversi[óo]n|capex|expansi[óo]n|nueva\s+planta/i.test(text)) {
    return 'señales';
  }
  return 'chat';
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 8);
}

export function interpretChat(question: string): InterpretedQuery {
  const text = question.trim();
  const linea  = detectLinea(text);
  const paises = detectPaises(text);
  const empresa = detectEmpresa(text);
  const mode = detectMode(text, !!empresa);
  const keywords = extractKeywords(text);

  return { mode, linea, empresa, paises, keywords, raw: text };
}
