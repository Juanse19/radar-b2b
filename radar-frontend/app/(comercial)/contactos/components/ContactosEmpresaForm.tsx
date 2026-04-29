'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, UserPlus, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineaSelectorCards } from '@/components/agent/LineaSelectorCards';
import { Stepper } from '../../escanear/components/Stepper';

interface Contact {
  id?:        number;
  full_name?: string;
  cargo?:     string;
  email?:     string;
  linkedin?:  string;
  pais?:      string;
}

export function ContactosEmpresaForm() {
  const [step, setStep]         = useState<1 | 2 | 3>(1);
  const [empresa, setEmpresa]   = useState<string>('');
  const [linea, setLinea]       = useState<string>('');
  const [sublinea, setSublinea] = useState<string>('');
  const [pais, setPais]         = useState<string>('');
  const [tier, setTier]         = useState<string>('B');
  const [loading, setLoading]   = useState<boolean>(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [message, setMessage]   = useState<string | null>(null);

  const canNext =
    step === 1 ? Boolean(linea) :
    step === 2 ? Boolean(empresa.trim() && pais.trim()) :
    false;

  async function searchExisting() {
    if (!empresa.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const r = await fetch(`/api/contacts?q=${encodeURIComponent(empresa)}&limit=20`);
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        setContacts([]);
        return;
      }
      const data = await r.json();
      setContacts(Array.isArray(data) ? data : (data.items ?? data.contacts ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function triggerProspect() {
    if (!empresa.trim() || !linea || !pais) {
      setError('Completá empresa, línea y país');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const r = await fetch('/api/prospect', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          linea,
          batchSize: 1,
          contactosPorEmpresa: tier === 'A' ? 5 : tier === 'B' ? 3 : 4,
          empresas: [{
            empresa: empresa.trim(),
            pais,
            linea_negocio: linea,
            tier,
            paises: [pais],
          }],
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error ?? `HTTP ${r.status}`);
      } else {
        setMessage(`WF03 disparado · esperá ~30s y recargá los contactos`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
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

        {/* Step 2 — Empresa + país + tier */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="emp" className="mb-1 block">Empresa</Label>
                <Input id="emp" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="DHL, Grupo Bimbo, Cartones América…" />
              </div>
              <div>
                <Label htmlFor="pais" className="mb-1 block">País</Label>
                <Input id="pais" value={pais} onChange={(e) => setPais(e.target.value)} placeholder="Colombia, México…" />
              </div>
              <div>
                <Label htmlFor="tier" className="mb-1 block">Tier</Label>
                <select id="tier" value={tier} onChange={(e) => setTier(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="A">A · ORO (5 contactos)</option>
                  <option value="B">B · MONITOREO (3 contactos)</option>
                  <option value="C">C · ARCHIVO (4 contactos)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Resumen + acciones */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Resumen</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>· Empresa <strong className="text-foreground">{empresa}</strong></li>
                <li>· Línea <strong className="text-foreground">{linea}</strong>{sublinea && <> · Sub-línea <strong className="text-foreground">{sublinea}</strong></>}</li>
                <li>· País <strong className="text-foreground">{pais}</strong></li>
                <li>· Tier <strong className="text-foreground">{tier}</strong></li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={searchExisting} disabled={loading || !empresa.trim()} className="flex-1">
                {loading ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Search size={14} className="mr-2" />}
                Ver contactos en BD
              </Button>
              <Button onClick={triggerProspect} disabled={loading || !empresa.trim() || !linea || !pais} className="flex-1">
                <UserPlus size={14} className="mr-2" />
                Buscar con Apollo (WF03)
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setStep((step - 1) as 1 | 2 | 3)} disabled={step === 1}>
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

      {contacts.length > 0 && (
        <Card className="overflow-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Cargo</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">País</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr key={c.id ?? i} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                  <td className="px-3 py-2">{c.full_name ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.cargo ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.email ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.pais ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
