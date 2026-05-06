/**
 * /comercial/contactos/historial/[id] — Detalle de una sesión específica
 * del Apollo Prospector v2.
 *
 * Muestra: metadata de la sesión + tabla con todos los contactos
 * persistidos en matec_radar.contactos (filtrados por prospector_session_id).
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, History, Linkedin, Phone, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pgFirst, pgQuery, SCHEMA } from '@/lib/db/supabase/pg_client';

export const dynamic = 'force-dynamic';

interface SessionDetail {
  id:                string;
  modo:              'auto' | 'manual';
  sublineas:         string[];
  tiers:             string[] | null;
  empresas_count:    number;
  total_contacts:    number;
  total_with_email:  number;
  total_with_phone:  number;
  credits_used:      number;
  duration_ms:       number | null;
  cancelled:         boolean;
  created_at:        string;
  finished_at:       string | null;
}

interface ContactoRow {
  id:                number;
  apollo_id:         string | null;
  first_name:        string | null;
  last_name:         string | null;
  title:             string | null;
  nivel_jerarquico:  string | null;
  email:             string | null;
  email_status:      string | null;
  phone_mobile:      string | null;
  phone_unlocked:    boolean;
  linkedin_url:      string | null;
  empresa_nombre:    string | null;
  empresa_tier:      string | null;
  pais:              string | null;
  hubspot_status:    string;
  es_principal:      boolean;
}

const HUBSPOT_STYLE: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  sincronizado: { bg: '#D1FAE5', fg: '#047857', border: '#A7F3D0', label: 'Sincronizado' },
  pendiente:    { bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A', label: 'Pendiente' },
  error:        { bg: '#FEE2E2', fg: '#B91C1C', border: '#FECACA', label: 'Error' },
  omitido:      { bg: '#F3F4F6', fg: '#6B7280', border: '#E5E7EB', label: 'Omitido' },
};

function avatarColors(name: string): { bg: string; fg: string } {
  const palette = [
    { bg: '#DBEAFE', fg: '#1E40AF' },
    { bg: '#FEE2E2', fg: '#B91C1C' },
    { bg: '#D1FAE5', fg: '#065F46' },
    { bg: '#FEF3C7', fg: '#92400E' },
    { bg: '#E9D5FF', fg: '#6B21A8' },
    { bg: '#FCE7F3', fg: '#9D174D' },
    { bg: '#CFFAFE', fg: '#155E75' },
    { bg: '#FED7AA', fg: '#9A3412' },
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function maskPhone(tel: string | null, unlocked: boolean): string {
  if (!tel) return '—';
  if (unlocked) return tel;
  const cleaned = tel.replace(/[^\d+]/g, '');
  if (cleaned.length < 6) return '••••••••';
  return `${cleaned.slice(0, Math.min(7, cleaned.length - 4))} •••• ${cleaned.slice(-4)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function getSession(id: string): Promise<SessionDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const safe = id.replace(/'/g, "''");
  return pgFirst<SessionDetail>(`
    SELECT id, modo, sublineas, tiers, empresas_count,
           total_contacts, total_with_email, total_with_phone, credits_used,
           duration_ms, cancelled, created_at, finished_at
    FROM ${SCHEMA}.prospector_v2_sessions
    WHERE id = '${safe}'::uuid
    LIMIT 1
  `);
}

async function getContactos(id: string): Promise<ContactoRow[]> {
  const safe = id.replace(/'/g, "''");
  return pgQuery<ContactoRow>(`
    SELECT c.id, c.apollo_id, c.first_name, c.last_name, c.title,
           c.nivel_jerarquico, c.email, c.email_status,
           c.phone_mobile, c.phone_unlocked, c.linkedin_url,
           e.company_name AS empresa_nombre,
           e.tier_actual::TEXT AS empresa_tier,
           c.country::TEXT AS pais,
           c.hubspot_status::TEXT AS hubspot_status,
           c.es_principal
    FROM ${SCHEMA}.contactos c
    LEFT JOIN ${SCHEMA}.empresas e ON e.id = c.empresa_id
    WHERE c.prospector_session_id = '${safe}'::uuid
    ORDER BY c.es_principal DESC,
             CASE c.nivel_jerarquico
               WHEN 'C-LEVEL'  THEN 0
               WHEN 'DIRECTOR' THEN 1
               WHEN 'GERENTE'  THEN 2
               WHEN 'JEFE'     THEN 3
               ELSE 4
             END,
             c.created_at ASC
  `);
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  const contactos = await getContactos(id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--agent-contactos-tint)', color: 'var(--agent-contactos)' }}
          >
            <History size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--agent-contactos)' }}>
              Sesión <span className="font-mono">{session.id.slice(0, 8).toUpperCase()}</span>
            </p>
            <h1 className="text-xl font-semibold leading-tight">
              {session.modo === 'auto' ? 'Modo Automático' : 'Modo Manual'} · {formatDate(session.created_at)}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {session.sublineas?.join(', ') || 'sin sub-líneas'}
              {session.tiers?.length ? <> · tier {session.tiers.join(', ')}</> : null}
            </p>
          </div>
        </div>
        <Link href="/comercial/contactos/historial">
          <Button variant="outline" size="sm">
            <ArrowLeft size={13} className="mr-1.5" />
            Volver al historial
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Empresas" value={session.empresas_count} />
        <Stat label="Contactos" value={session.total_contacts} highlight />
        <Stat label="Con email" value={session.total_with_email} />
        <Stat label="Con teléfono" value={session.total_with_phone} />
        <Stat label="Créditos" value={session.credits_used} />
      </div>

      {/* Tabla detalle */}
      {contactos.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Esta sesión no generó contactos.</p>
        </Card>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
          <div className="border-b border-border/60 px-4 py-3">
            <h3 className="text-sm font-semibold">Contactos de la sesión</h3>
            <p className="text-xs text-muted-foreground">
              {contactos.length} contacto{contactos.length !== 1 ? 's' : ''} · ordenados por nivel jerárquico
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Contacto</th>
                  <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                  <th className="px-4 py-2.5 text-left font-medium">Email</th>
                  <th className="px-4 py-2.5 text-left font-medium">Teléfono</th>
                  <th className="px-4 py-2.5 text-left font-medium">HubSpot</th>
                </tr>
              </thead>
              <tbody>
                {contactos.map(ct => <ContactoTableRow key={ct.id} ct={ct} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className="text-2xl font-semibold leading-tight tabular-nums"
        style={highlight ? { color: 'var(--agent-contactos)' } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function ContactoTableRow({ ct }: { ct: ContactoRow }) {
  const fullName = `${ct.first_name ?? ''} ${ct.last_name ?? ''}`.trim() || '—';
  const initials = ((ct.first_name?.charAt(0) ?? '') + (ct.last_name?.charAt(0) ?? '')).toUpperCase() || '??';
  const avatar   = avatarColors(fullName);
  const hsStyle  = HUBSPOT_STYLE[ct.hubspot_status] ?? HUBSPOT_STYLE.pendiente;

  return (
    <tr className="border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: avatar.bg, color: avatar.fg }}
          >
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{fullName}</p>
              {ct.linkedin_url && (
                <a href={ct.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:opacity-70">
                  <Linkedin size={12} />
                </a>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{ct.title ?? '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <p className="truncate text-sm font-medium">{ct.empresa_nombre ?? '—'}</p>
        <p className="text-xs text-muted-foreground">
          {ct.pais ?? '—'}{ct.empresa_tier ? <> · tier {ct.empresa_tier}</> : null}
        </p>
      </td>
      <td className="px-4 py-3 align-middle">
        {ct.email ? (
          <a href={`mailto:${ct.email}`} className="text-sm hover:underline" style={{ color: 'var(--agent-contactos)' }}>
            {ct.email}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="inline-flex items-center gap-1.5 text-sm font-mono">
          {ct.phone_mobile && <Phone size={11} className="text-emerald-600" />}
          {maskPhone(ct.phone_mobile, ct.phone_unlocked)}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{ background: hsStyle.bg, color: hsStyle.fg, borderColor: hsStyle.border }}
        >
          {hsStyle.label}
        </span>
      </td>
    </tr>
  );
}
