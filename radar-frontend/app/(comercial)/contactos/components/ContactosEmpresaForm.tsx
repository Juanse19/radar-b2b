'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, UserPlus, AlertTriangle } from 'lucide-react';
import { getMainLineas } from '@/lib/comercial/lineas-config';
import { useLineasTree, getSubLineasFor } from '@/lib/comercial/useLineasTree';

interface Contact {
  id?:        number;
  full_name?: string;
  cargo?:     string;
  email?:     string;
  linkedin?:  string;
  pais?:      string;
}

export function ContactosEmpresaForm() {
  const [empresa, setEmpresa]   = useState<string>('');
  const [linea, setLinea]       = useState<string>('');
  const [sublinea, setSublinea] = useState<string>('');
  const [pais, setPais]         = useState<string>('');
  const { data: tree } = useLineasTree();
  const subOptions = linea ? getSubLineasFor(tree, linea) : [];
  const [tier, setTier]         = useState<string>('B');
  const [loading, setLoading]   = useState<boolean>(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [message, setMessage]   = useState<string | null>(null);

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
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="emp" className="mb-1 block">Empresa</Label>
            <Input id="emp" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="DHL, Grupo Bimbo, Cartones América…" />
          </div>
          <div>
            <Label htmlFor="lin" className="mb-1 block">Línea</Label>
            <select id="lin" value={linea} onChange={(e) => { setLinea(e.target.value); setSublinea(''); }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Selecciona…</option>
              {getMainLineas().map((l) => (
                <option key={l.key} value={l.key}>{l.label}</option>
              ))}
            </select>
          </div>
          {subOptions.length > 0 && (
            <div className="md:col-span-2">
              <Label htmlFor="sublin" className="mb-1 block">Sub-línea (opcional)</Label>
              <select id="sublin" value={sublinea} onChange={(e) => setSublinea(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">Todas las sub-líneas</option>
                {subOptions.map((s) => (
                  <option key={s.id} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
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

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button size="sm" variant="outline" onClick={searchExisting} disabled={loading || !empresa.trim()}>
            {loading ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Search size={14} className="mr-2" />}
            Ver contactos en BD
          </Button>
          <Button size="sm" onClick={triggerProspect} disabled={loading || !empresa.trim() || !linea || !pais}>
            <UserPlus size={14} className="mr-2" />
            Buscar con Apollo (WF03)
          </Button>
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
