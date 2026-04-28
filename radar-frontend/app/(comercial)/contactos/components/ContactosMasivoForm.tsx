'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Layers, AlertTriangle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineaSelectorCards } from '@/components/agent/LineaSelectorCards';
import { Stepper } from '../../escanear/components/Stepper';

interface Empresa {
  id: number;
  name: string;
  country: string;
  linea: string;
  tier: string;
}

export function ContactosMasivoForm() {
  const [step, setStep]           = useState<1 | 2 | 3>(1);
  const [linea, setLinea]         = useState<string>('');
  const [sublinea, setSublinea]   = useState<string>('');
  const [tier, setTier]           = useState<string>('');
  const [contactosPorEmpresa, setContactosPorEmpresa] = useState<number>(3);
  const [empresas, setEmpresas]   = useState<Empresa[]>([]);
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [loading, setLoading]     = useState<boolean>(false);
  const [running, setRunning]     = useState<boolean>(false);
  const [error, setError]         = useState<string | null>(null);
  const [message, setMessage]     = useState<string | null>(null);

  const canNext =
    step === 1 ? Boolean(linea) :
    step === 2 ? selected.size > 0 :
    false;

  // Sublineas now come from LineaSelectorCards directly via onSublineaChange.

  useEffect(() => {
    if (!linea) { setEmpresas([]); return; }
    setLoading(true);
    const params = new URLSearchParams({ linea, limit: '100' });
    if (sublinea) params.set('sublinea', sublinea);
    fetch(`/api/comercial/companies?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Empresa[]) => {
        const filtered = tier ? data.filter((e) => e.tier === tier) : data;
        setEmpresas(filtered);
        setSelected(new Set());
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [linea, sublinea, tier]);

  function toggleAll() {
    if (selected.size === empresas.length) setSelected(new Set());
    else setSelected(new Set(empresas.map((e) => e.id)));
  }

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function runProspect() {
    if (selected.size === 0 || !linea) {
      setError('Selecciona línea y al menos una empresa');
      return;
    }
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const picked = empresas.filter((e) => selected.has(e.id));
      const r = await fetch('/api/prospect', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          linea,
          batchSize: picked.length,
          contactosPorEmpresa: 3,
          empresas: picked.map((e) => ({
            empresa:        e.name,
            pais:           e.country,
            linea_negocio:  linea,
            tier:           e.tier !== 'sin_calificar' ? e.tier : 'B',
            paises:         [e.country],
          })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error ?? `HTTP ${r.status}`);
      } else {
        setMessage(`WF03 disparado para ${picked.length} empresa${picked.length !== 1 ? 's' : ''} · esperá ~30s/empresa`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <Stepper current={step} onGoto={(s) => setStep(s)} />

      <Card className="p-5">
        {/* Step 1 — Línea + Sub-línea */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label className="mb-2 block">Línea de negocio</Label>
              <LineaSelectorCards
                value={linea}
                onChange={(v) => { setLinea(v === 'ALL' ? '' : v); setSublinea(''); }}
                sublinea={sublinea || undefined}
                onSublineaChange={(s) => setSublinea(s ?? '')}
              />
            </div>
          </div>
        )}

        {/* Step 2 — Filtro tier + Selección de empresas */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="tier" className="mb-1 block">Filtrar por Tier</Label>
                <select id="tier" value={tier} onChange={(e) => setTier(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Todos los tiers</option>
                  <option value="A">A · ORO</option>
                  <option value="B">B · MONITOREO</option>
                  <option value="C">C · ARCHIVO</option>
                  <option value="D">D · DESCARTAR</option>
                </select>
              </div>
              <Button size="sm" variant="outline" onClick={toggleAll} disabled={empresas.length === 0}>
                {selected.size === empresas.length && empresas.length > 0 ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {loading ? <><Loader2 size={12} className="inline animate-spin" /> cargando…</> : `${empresas.length} empresas · ${selected.size} seleccionadas`}
            </p>

            {empresas.length > 0 && (
              <Card className="max-h-96 overflow-auto p-0">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-border bg-muted/60 text-left">
                    <tr>
                      <th className="w-10 px-3 py-2"></th>
                      <th className="px-3 py-2 font-medium">Empresa</th>
                      <th className="px-3 py-2 font-medium">Línea</th>
                      <th className="px-3 py-2 font-medium">País</th>
                      <th className="px-3 py-2 font-medium">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresas.map((e) => {
                      const checked = selected.has(e.id);
                      return (
                        <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                          <td className="px-3 py-2">
                            <button
                              onClick={() => toggle(e.id)}
                              className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                            >
                              {checked && <Check size={10} strokeWidth={3} />}
                            </button>
                          </td>
                          <td className="px-3 py-2">{e.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.linea}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.country}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.tier}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}

        {/* Step 3 — Configurar y ejecutar */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <Label htmlFor="cpe" className="mb-1 block">Contactos por empresa</Label>
              <Input
                id="cpe" type="number" min={1} max={10}
                value={contactosPorEmpresa}
                onChange={(e) => setContactosPorEmpresa(Math.min(Math.max(Number(e.target.value), 1), 10))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Default 3. Apollo cobra por contacto enriquecido — ORO=5, MONITOREO=3, ARCHIVO=4.
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Resumen del run masivo (WF03)</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>· Línea <strong className="text-foreground">{linea}</strong>{sublinea && <> · Sub-línea <strong className="text-foreground">{sublinea}</strong></>}</li>
                {tier && <li>· Tier filtrado: <strong className="text-foreground">{tier}</strong></li>}
                <li>· <strong className="text-foreground">{selected.size}</strong> empresa{selected.size !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}</li>
                <li>· Hasta <strong className="text-foreground">{contactosPorEmpresa}</strong> contacto{contactosPorEmpresa !== 1 ? 's' : ''} por empresa · ~{selected.size * contactosPorEmpresa} contactos totales</li>
              </ul>
            </div>

            <Button onClick={runProspect} disabled={running || selected.size === 0} size="sm" className="w-full">
              {running ? <><Loader2 size={14} className="mr-2 animate-spin" /> Disparando WF03…</> : <><Layers size={14} className="mr-2" /> Buscar contactos masivos</>}
            </Button>
          </div>
        )}
      </Card>

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStep((step - 1) as 1 | 2 | 3)}
          disabled={step === 1}
        >
          <ChevronLeft size={14} className="mr-1" /> Atrás
        </Button>
        {step < 3 ? (
          <Button size="sm" onClick={() => setStep((step + 1) as 1 | 2 | 3)} disabled={!canNext}>
            Siguiente <ChevronRight size={14} className="ml-1" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Revisa y ejecuta arriba</span>
        )}
      </div>

      {error && (
        <Card className="flex items-start gap-2 border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle size={14} className="mt-0.5" />
          <span>{error}</span>
        </Card>
      )}

      {message && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-600">
          {message}
        </Card>
      )}
    </div>
  );
}
