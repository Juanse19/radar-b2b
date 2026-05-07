'use client';

import { useState } from 'react';
import { Lock, Phone, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  contactoId?: number;
  telMovil?:   string | null;
  unlocked?:   boolean;
  onUnlocked?: (telMovil: string) => void;
  disabled?:   boolean;
}

const ACCENT = 'var(--agent-contactos)';

export function UnlockPhoneButton({ contactoId, telMovil, unlocked, onUnlocked, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  if (telMovil) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono">
        <Phone size={12} className="text-emerald-600" />
        {telMovil}
      </span>
    );
  }

  if (!contactoId) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock size={12} />
        ••••••••
      </span>
    );
  }

  async function handleClick() {
    if (!contactoId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospector/v2/contacts/${contactoId}/unlock-phone`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      if (json.tel_movil) {
        onUnlocked?.(json.tel_movil);
      } else {
        throw new Error('No phone returned');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(
          'text-xs h-7 px-2',
          loading && 'opacity-70',
        )}
        title="Desbloquea el teléfono móvil (9 créditos Apollo)"
      >
        {loading
          ? <><Loader2 size={11} className="mr-1 animate-spin" /> Desbloqueando…</>
          : <><Lock size={11} className="mr-1" /> Desbloquear teléfono <span className="ml-1 text-muted-foreground">(9 cr)</span></>
        }
      </Button>
      {error && (
        <span className="inline-flex items-center gap-1 text-[11px] text-destructive" title={error}>
          <AlertCircle size={11} />
          {error.length > 30 ? `${error.slice(0, 30)}…` : error}
        </span>
      )}
    </div>
  );
}
