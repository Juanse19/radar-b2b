'use client';

import { Mail, Linkedin, Phone, Building2, MapPin, CheckCircle2, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { UnlockPhoneButton } from './UnlockPhoneButton';
import type { ContactCardState } from './useProspectorStream';

interface Props {
  contact:    ContactCardState;
  onUnlocked?: (apolloId: string, telMovil: string) => void;
}

const ACCENT = 'var(--agent-contactos)';

const NIVEL_BADGE: Record<string, { bg: string; fg: string }> = {
  'C-LEVEL':  { bg: '#D6E4F0', fg: '#1A3C6E' },
  'DIRECTOR': { bg: '#D6F0DA', fg: '#1E6B2E' },
  'GERENTE':  { bg: '#FFF3CD', fg: '#7B3F00' },
  'JEFE':     { bg: '#EDE0F5', fg: '#4A0072' },
  'ANALISTA': { bg: '#F0F0F0', fg: '#333333' },
};

export function ContactCardLive({ contact, onUnlocked }: Props) {
  const badge = NIVEL_BADGE[contact.nivel] ?? NIVEL_BADGE.ANALISTA;
  const fullName = `${contact.nombre} ${contact.apellido}`.trim();

  return (
    <Card
      className={cn(
        'relative p-4 transition-all',
        contact.es_principal && 'ring-2',
      )}
      style={contact.es_principal
        ? { borderColor: ACCENT, '--tw-ring-color': ACCENT } as React.CSSProperties
        : undefined
      }
    >
      {contact.es_principal && (
        <span
          className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-sm"
          style={{ background: ACCENT }}
          title="Contacto principal"
        >
          <Star size={12} fill="currentColor" />
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-tight truncate">{fullName || '—'}</p>
          <p className="text-xs text-muted-foreground truncate">{contact.cargo}</p>
        </div>
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
          style={{ background: badge.bg, color: badge.fg }}
        >
          {contact.nivel}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Building2 size={11} />
          <span className="truncate">{contact.empresa}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin size={11} />
          <span>{contact.pais}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Mail size={11} className="text-muted-foreground shrink-0" />
          <a
            href={`mailto:${contact.email}`}
            className="truncate font-mono text-foreground hover:underline"
            style={{ color: ACCENT }}
          >
            {contact.email}
          </a>
          {contact.estado_email === 'verified' && (
            <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
          )}
        </div>

        {contact.linkedin && (
          <div className="flex items-center gap-1.5">
            <Linkedin size={11} className="text-muted-foreground shrink-0" />
            <a
              href={contact.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:underline"
              style={{ color: ACCENT }}
            >
              LinkedIn
            </a>
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          <Phone size={11} className="text-muted-foreground shrink-0" />
          <UnlockPhoneButton
            contactoId={contact.contacto_id}
            telMovil={contact.tel_movil}
            unlocked={contact.phone_unlocked}
            onUnlocked={(tel) => onUnlocked?.(contact.apollo_id, tel)}
            disabled={!contact.saved}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-2">
        <span>{contact.estado_email}</span>
        <span className="flex items-center gap-1">
          {contact.saved
            ? <><CheckCircle2 size={10} className="text-emerald-600" /> Guardado</>
            : <><Loader2 size={10} className="animate-spin" /> Procesando…</>
          }
        </span>
      </div>
    </Card>
  );
}
