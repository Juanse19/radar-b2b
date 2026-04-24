'use client';

// app/admin/keywords/page.tsx — Sprint A.3
// Panel admin para gestionar palabras_clave_por_linea que usa WF02 Radar.
// Paola puede agregar / editar / desactivar keywords sin tocar n8n.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Filter, Loader2, Tag, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Badge }    from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubLineaRow { id: number; codigo: string; nombre: string; }

interface KeywordRow {
  id:                number;
  sub_linea_id:      number;
  sub_linea_nombre?: string;
  palabra:           string;
  idioma:            string;
  tipo:              string;
  peso:              number;
  activo:            boolean;
  created_at:        string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  senal:     'Señal',
  producto:  'Producto',
  sector:    'Sector',
  exclusion: 'Exclusión',
};

const TIPO_COLORS: Record<string, string> = {
  senal:     'bg-blue-100 text-blue-800',
  producto:  'bg-green-100 text-green-800',
  sector:    'bg-yellow-100 text-yellow-800',
  exclusion: 'bg-red-100 text-red-800',
};

function PesoBar({ peso }: { peso: number }) {
  const pct  = ((peso + 5) / 10) * 100;
  const color = peso >= 2  ? 'bg-blue-500'
              : peso >= 1  ? 'bg-green-500'
              : peso <= -1 ? 'bg-red-500'
              : 'bg-gray-400';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-5 text-right">{peso > 0 ? `+${peso}` : peso}</span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminKeywordsPage() {
  const qc = useQueryClient();

  // Filters
  const [selectedSubLinea, setSelectedSubLinea] = useState<string>('all');
  const [busqueda, setBusqueda]                 = useState('');

  // New keyword form
  const [newPalabra, setNewPalabra]     = useState('');
  const [newTipo, setNewTipo]           = useState<string>('senal');
  const [newPeso, setNewPeso]           = useState<string>('1');
  const [showForm, setShowForm]         = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: subLineas = [] } = useQuery<SubLineaRow[]>({
    queryKey: ['sub-lineas'],
    queryFn:  () => fetch('/api/sub-lineas').then(r => r.json()),
  });

  const qs = selectedSubLinea !== 'all' ? `?sub_linea_id=${selectedSubLinea}` : '';
  const { data: keywords = [], isLoading } = useQuery<KeywordRow[]>({
    queryKey: ['admin-keywords', selectedSubLinea],
    queryFn:  () => fetch(`/api/admin/keywords${qs}`).then(r => r.json()),
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newPalabra.trim()) throw new Error('Escribe la keyword');
      if (selectedSubLinea === 'all') throw new Error('Selecciona una sub-línea');
      const peso = Number(newPeso);
      if (isNaN(peso) || peso < -5 || peso > 5) throw new Error('Peso entre -5 y +5');

      const r = await fetch('/api/admin/keywords', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub_linea_id: Number(selectedSubLinea),
          palabra:      newPalabra.trim(),
          tipo:         newTipo,
          peso,
        }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Error al guardar'); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-keywords'] });
      toast.success('Keyword agregada');
      setNewPalabra('');
      setNewPeso('1');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/keywords?id=${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Error al eliminar');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-keywords'] });
      toast.success('Keyword desactivada');
    },
    onError: () => toast.error('No se pudo desactivar'),
  });

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = keywords.filter(kw =>
    kw.palabra.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const totalPeso = filtered.reduce((sum, kw) => sum + kw.peso, 0);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="h-6 w-6 text-blue-500" />
            Keywords Radar
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            WF02 consulta estas keywords al buscar señales en Tavily.
            Peso +2 = CAPEX/licitación · +1 = sector · negativo = exclusión.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(v => !v)}
          disabled={selectedSubLinea === 'all'}
        >
          {showForm ? <ChevronUp className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          Nueva keyword
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Select value={selectedSubLinea} onValueChange={v => { setSelectedSubLinea(v ?? 'all'); setShowForm(false); }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filtrar por sub-línea" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sub-líneas</SelectItem>
            {subLineas.map(sl => (
              <SelectItem key={sl.id} value={String(sl.id)}>{sl.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar keyword..."
            className="pl-9"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center text-xs text-muted-foreground border rounded-md px-3">
            Peso total: <span className={`ml-1 font-mono font-bold ${totalPeso > 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {totalPeso > 0 ? `+${totalPeso}` : totalPeso}
            </span>
          </div>
        )}
      </div>

      {/* Add form */}
      {showForm && selectedSubLinea !== 'all' && (
        <div className="flex gap-2 mb-4 p-4 border rounded-lg bg-card shadow-sm">
          <Input
            placeholder="Nueva keyword (ej: CAPEX expansión 2026)..."
            value={newPalabra}
            onChange={e => setNewPalabra(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMutation.mutate()}
            className="flex-1"
          />
          <Select value={newTipo} onValueChange={v => setNewTipo(v ?? 'senal')}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newPeso} onValueChange={v => setNewPeso(v ?? '1')}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Peso" />
            </SelectTrigger>
            <SelectContent>
              {[-2, -1, 1, 2].map(p => (
                <SelectItem key={p} value={String(p)}>{p > 0 ? `+${p}` : p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => addMutation.mutate()}
            disabled={!newPalabra.trim() || addMutation.isPending}
          >
            {addMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {selectedSubLinea === 'all' && showForm && (
        <p className="text-sm text-muted-foreground mb-4 px-1">
          Selecciona una sub-línea para agregar keywords.
        </p>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando keywords...
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Keyword</th>
                {selectedSubLinea === 'all' && (
                  <th className="text-left px-4 py-2.5 font-medium w-40">Sub-línea</th>
                )}
                <th className="text-left px-4 py-2.5 font-medium w-28">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium w-32">Peso WF02</th>
                <th className="text-left px-4 py-2.5 font-medium w-16">Idioma</th>
                <th className="px-4 py-2.5 w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(kw => (
                <tr key={kw.id} className="border-t hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{kw.palabra}</td>
                  {selectedSubLinea === 'all' && (
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {kw.sub_linea_nombre}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_COLORS[kw.tipo] ?? 'bg-gray-100 text-gray-700'}`}>
                      {TIPO_LABELS[kw.tipo] ?? kw.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <PesoBar peso={kw.peso} />
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                    {kw.idioma}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(kw.id)}
                      disabled={deleteMutation.isPending}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Desactivar keyword"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={selectedSubLinea === 'all' ? 6 : 5} className="px-4 py-10 text-center text-muted-foreground">
                    {busqueda
                      ? `Sin resultados para "${busqueda}"`
                      : selectedSubLinea === 'all'
                      ? 'No hay keywords activas. Selecciona una sub-línea y agrega la primera.'
                      : 'No hay keywords para esta sub-línea. Haz clic en "Nueva keyword".'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t bg-muted text-xs text-muted-foreground flex justify-between">
              <span>{filtered.length} keyword{filtered.length !== 1 ? 's' : ''} activa{filtered.length !== 1 ? 's' : ''}</span>
              <span className="text-muted-foreground/60">
                WF02 las carga en cada scan · peso impulsa score_radar
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
