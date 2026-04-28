'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Layers, AlertTriangle, Check } from 'lucide-react';
import { LINEAS_CONFIG } from '@/lib/comercial/lineas-config';

interface Empresa {
  id: number;
  name: string;
  country: string;
  linea: string;
  tier: string;
}

export function ContactosMasivoForm() {
  const [linea, setLinea]         = useState<string>('');
  const [sublinea, setSublinea]   = useState<string>('');
  const [tier, setTier]           = useState<string>('');
  const [empresas, setEmpresas]   = useState<Empresa[]>([]);
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [loading, setLoading]     = useState<boolean>(false);
  const [running, setRunning]     = useState<boolean>(false);
  const [error, setError]         = useState<string | null>(null);
  const [message, setMessage]     = useState<string | null>(null);

  const subOptions = LINEAS_CONFIG.find((l) => l.key === linea)?.sublineas ?? [];

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
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="lin" className="mb-1 block">Línea</Label>
            <select id="lin" value={linea} onChange={(e) => { setLinea(e.target.value); setSublinea(''); }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Selecciona…</option>
              {LINEAS_CONFIG.slice(0, 3).map((l) => (
                <option key={l.key} value={l.key}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="sub" className="mb-1 block">Sub-línea</Label>
            <select id="sub" value={sublinea} onChange={(e) => setSublinea(e.target.value)} disabled={subOptions.length === 0}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50">
              <option value="">Todas</option>
              {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="tier" className="mb-1 block">Tier</Label>
            <select id="tier" value={tier} onChange={(e) => setTier(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="A">A · ORO</option>
              <option value="B">B · MONITOREO</option>
              <option value="C">C · ARCHIVO</option>
              <option value="D">D · DESCARTAR</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            {loading ? <Loader2 size={12} className="inline animate-spin" /> : `${empresas.length} empresas · ${selected.size} seleccionadas`}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={toggleAll} disabled={empresas.length === 0}>
              {selected.size === empresas.length && empresas.length > 0 ? 'Deseleccionar' : 'Seleccionar todas'}
            </Button>
            <Button size="sm" onClick={runProspect} disabled={running || selected.size === 0}>
              {running ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Layers size={14} className="mr-2" />}
              Buscar contactos masivos
            </Button>
          </div>
        </div>
      </Card>

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

      {empresas.length > 0 && (
        <Card className="overflow-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
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
  );
}
