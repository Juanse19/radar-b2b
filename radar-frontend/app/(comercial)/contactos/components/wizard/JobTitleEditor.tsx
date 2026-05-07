'use client';

import { useState, type KeyboardEvent } from 'react';
import { X, Plus, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  jobTitles:  string[];
  onChange:   (titles: string[]) => void;
  /** Callback para "Restaurar default" según la sub-línea actual. */
  onResetToDefaults?: () => void;
  defaultsLabel?: string;
}

const ACCENT = 'var(--agent-contactos)';

export function JobTitleEditor({ jobTitles, onChange, onResetToDefaults, defaultsLabel }: Props) {
  const [draft, setDraft] = useState('');

  function addTitle() {
    const t = draft.trim();
    if (!t) return;
    if (jobTitles.includes(t)) {
      setDraft('');
      return;
    }
    onChange([...jobTitles, t]);
    setDraft('');
  }

  function removeTitle(t: string) {
    onChange(jobTitles.filter(x => x !== t));
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTitle();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>
          Job Titles a buscar
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({jobTitles.length})
          </span>
        </Label>
        {onResetToDefaults && (
          <button
            type="button"
            onClick={onResetToDefaults}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Restaurar lista por defecto de la sub-línea"
          >
            <RefreshCw size={11} />
            {defaultsLabel ?? 'Restaurar default'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2 min-h-[3rem]">
        {jobTitles.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Agrega al menos un job title para buscar
          </p>
        )}
        {jobTitles.map(t => (
          <span
            key={t}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
            )}
            style={{
              borderColor: ACCENT,
              color:       ACCENT,
              background:  `color-mix(in srgb, ${ACCENT} 10%, transparent)`,
            }}
          >
            {t}
            <button
              type="button"
              onClick={() => removeTitle(t)}
              className="opacity-70 hover:opacity-100"
              aria-label={`Quitar ${t}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ej: Director de Operaciones, Plant Manager…"
          className="text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTitle}
          disabled={!draft.trim()}
        >
          <Plus size={14} className="mr-1" />
          Agregar
        </Button>
      </div>
    </div>
  );
}
