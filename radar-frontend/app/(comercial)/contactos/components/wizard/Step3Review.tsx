'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Sparkles, AlertTriangle, Phone } from 'lucide-react';
import type { ProspectorWizardState } from './state';

interface Props {
  state:    ProspectorWizardState;
  onChange: (updates: Partial<ProspectorWizardState>) => void;
  onFire:   () => void;
  firing:   boolean;
}

const ACCENT = 'var(--agent-contactos)';

export function Step3Review({ state, onChange, onFire, firing }: Props) {
  const empresasConDominio = state.empresas.filter(e => !!e.dominio);
  const empresasSinDominio = state.empresas.filter(e => !e.dominio);

  const estimatedCredits = useMemo(() => {
    const perContacto = state.revealPhoneAuto ? 9 : 1;
    return empresasConDominio.length * state.maxContactos * perContacto;
  }, [empresasConDominio.length, state.maxContactos, state.revealPhoneAuto]);

  const hasEmpresas      = state.empresas.length > 0;
  const tieneJobTitles   = state.jobTitles.length > 0;
  const tieneEjecutables = empresasConDominio.length > 0;
  const canFire = hasEmpresas && tieneJobTitles && tieneEjecutables && !firing;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Revisar y ejecutar</h3>
        <p className="text-sm text-muted-foreground">
          Confirma los parámetros y dispara la búsqueda. La ejecución se mostrará en vivo.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Modo" value={state.modo === 'auto' ? 'Automático' : 'Manual'} />
        <Stat label="Empresas" value={String(state.empresas.length)} />
        <Stat label="Contactos/empresa" value={String(state.maxContactos)} />
        <Stat label="Sub-líneas" value={state.sublineas.length || 'todas'} />
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 cursor-pointer" htmlFor="reveal-phone-toggle">
            <Phone size={14} />
            <span>Incluir teléfono en cada contacto</span>
          </Label>
          <input
            id="reveal-phone-toggle"
            type="checkbox"
            checked={state.revealPhoneAuto}
            onChange={e => onChange({ revealPhoneAuto: e.target.checked })}
            className="h-4 w-4 rounded border-border"
            style={{ accentColor: ACCENT }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {state.revealPhoneAuto ? (
            <>Cada contacto consume <strong>9 créditos</strong> de Apollo (email + teléfono).</>
          ) : (
            <>Cada contacto consume <strong>1 crédito</strong> (solo email verificado). Podrás desbloquear el teléfono individualmente luego (9 créditos por desbloqueo).</>
          )}
        </p>
      </Card>

      {empresasSinDominio.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-amber-900">
            <AlertTriangle size={14} />
            {empresasSinDominio.length} empresa{empresasSinDominio.length !== 1 ? 's' : ''} sin dominio
          </p>
          <p className="mt-1 text-xs text-amber-800">
            No serán buscadas. Configura el dominio en el módulo Empresas para incluirlas.
            Empresas excluidas: <span className="font-mono">{empresasSinDominio.slice(0, 3).map(e => e.empresa).join(', ')}{empresasSinDominio.length > 3 ? `… (+${empresasSinDominio.length - 3})` : ''}</span>
          </p>
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Costo estimado Apollo</span>
          <span className="text-2xl font-semibold tabular-nums" style={{ color: ACCENT }}>
            {estimatedCredits} <span className="text-sm font-normal text-muted-foreground">créditos</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {empresasConDominio.length} empresa{empresasConDominio.length !== 1 ? 's' : ''} × {state.maxContactos} contactos × {state.revealPhoneAuto ? 9 : 1} créditos
        </p>
      </div>

      <div>
        <Label className="mb-2 block">
          Job Titles ({state.jobTitles.length})
        </Label>
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 max-h-32 overflow-y-auto">
          <div className="flex flex-wrap gap-1">
            {state.jobTitles.map(t => (
              <span
                key={t}
                className="rounded-full border px-2 py-0.5 text-xs"
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <Button
          type="button"
          size="lg"
          onClick={onFire}
          disabled={!canFire}
          className="w-full font-semibold"
          style={canFire ? { background: ACCENT, color: '#fff' } : undefined}
        >
          <Sparkles size={16} className="mr-2" />
          {firing ? 'Iniciando…' : 'Buscar contactos'}
        </Button>
        {!canFire && !firing && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {!hasEmpresas
              ? 'Selecciona al menos una empresa'
              : !tieneJobTitles
                ? 'Agrega al menos un job title'
                : 'Las empresas seleccionadas no tienen dominio configurado'}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold leading-tight">{value}</p>
    </div>
  );
}
