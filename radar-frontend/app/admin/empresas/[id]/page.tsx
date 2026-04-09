'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineaBadge } from '@/components/LineaBadge';
import { TierBadge } from '@/components/TierBadge';
import { ScoreBadge } from '@/components/ScoreBadge';
import { HubSpotStatusBadge } from '@/components/contactos/HubSpotStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import type { Contacto } from '@/lib/types';
import { fetchJson } from '@/lib/fetcher';

interface Signal {
  id: number;
  empresa: string;
  linea: string;
  radarActivo: string;
  tipoSenal: string;
  scoreRadar: number;
  ventanaCompra: string;
  descripcion: string;
  fuente: string;
  fuenteUrl: string;
  fechaEscaneo: string;
}

interface EmpresaDetail {
  id: string;
  nombre: string;
  pais: string;
  linea: string;
  tier: string;
  dominio?: string;
}

export default function EmpresaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: senales = [], isLoading: loadingSignals } = useQuery<Signal[]>({
    queryKey: ['signals', 'empresa', id],
    queryFn: async () => {
      const data = await fetchJson<unknown>(`/api/signals?empresa_id=${id}&limit=100`);
      return Array.isArray(data) ? (data as Signal[]) : [];
    },
  });

  const { data: contactos = [], isLoading: loadingContactos } = useQuery<Contacto[]>({
    queryKey: ['contactos', 'empresa', id],
    queryFn: async () => {
      const data = await fetchJson<unknown>(`/api/contacts?empresa_id=${id}&limit=100`);
      return Array.isArray(data) ? (data as Contacto[]) : [];
    },
  });

  const { data: empresas = [] } = useQuery<EmpresaDetail[]>({
    queryKey: ['empresas', 'ALL', 0],
    queryFn: async () => {
      const data = await fetchJson<unknown>('/api/companies?linea=ALL&limit=1000');
      return Array.isArray(data) ? (data as EmpresaDetail[]) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const empresa = empresas.find(e => e.id === id);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + Header */}
      <div>
        <Link href="/admin/empresas" className="inline-flex items-center gap-2 px-3 py-2 -ml-2 mb-3 rounded-lg text-sm text-muted-foreground hover:text-gray-200 hover:bg-surface-muted transition-colors">
          <ArrowLeft size={16} />
          Volver a Empresas
        </Link>

        {empresa ? (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Building2 size={20} className="text-muted-foreground" />
                {empresa.nombre}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <LineaBadge linea={empresa.linea} />
                <TierBadge tier={empresa.tier} />
                <span className="text-sm text-muted-foreground">{empresa.pais}</span>
                {empresa.dominio && (
                  <a
                    href={`https://${empresa.dominio}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <ExternalLink size={11} />
                    {empresa.dominio}
                  </a>
                )}
              </div>
            </div>
            <div className="text-right shrink-0 ml-4">
              {senales.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Score promedio</p>
                  <ScoreBadge
                    score={senales.reduce((s, sig) => s + sig.scoreRadar, 0) / senales.length}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-10 w-64 bg-surface-muted rounded animate-pulse" />
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="senales">
        <TabsList className="bg-surface-muted border border-border">
          <TabsTrigger value="senales" className="data-[state=active]:bg-surface-muted data-[state=active]:text-white text-muted-foreground">
            Señales ({senales.length})
          </TabsTrigger>
          <TabsTrigger value="contactos" className="data-[state=active]:bg-surface-muted data-[state=active]:text-white text-muted-foreground">
            Contactos Apollo ({contactos.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Señales */}
        <TabsContent value="senales" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Historial de señales detectadas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingSignals ? (
                <div className="p-6 text-muted-foreground text-sm">Cargando señales...</div>
              ) : senales.length === 0 ? (
                <EmptyState
                  title="Sin señales registradas"
                  description="Lanza un escaneo para detectar señales de inversión para esta empresa."
                />
              ) : (
                <div className="divide-y divide-gray-800">
                  {senales.map((s, i) => (
                    <div key={s.id ?? i} className="px-4 py-3 hover:bg-surface-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <ScoreBadge score={s.scoreRadar} showNumber />
                            <span className="text-sm text-muted-foreground">{s.tipoSenal || 'Sin tipo'}</span>
                          </div>
                          {s.descripcion && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{s.descripcion}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                            <span>{s.fechaEscaneo}</span>
                            {s.ventanaCompra && <span>{s.ventanaCompra}</span>}
                            {s.fuenteUrl && (
                              <a href={s.fuenteUrl} target="_blank" rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-400 flex items-center gap-1">
                                <ExternalLink size={10} />
                                {s.fuente || 'Fuente'}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Contactos */}
        <TabsContent value="contactos" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Contactos Apollo extraídos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingContactos ? (
                <div className="p-6 text-muted-foreground text-sm">Cargando contactos...</div>
              ) : contactos.length === 0 ? (
                <EmptyState
                  title="Sin contactos"
                  description="Los contactos aparecerán aquí cuando el Agente Prospector actúe sobre esta empresa (Score ORO)."
                />
              ) : (
                <div className="divide-y divide-gray-800">
                  {contactos.map(c => (
                    <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{c.nombre}</p>
                        {c.cargo && <p className="text-xs text-muted-foreground">{c.cargo}</p>}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-xs text-blue-400 hover:text-blue-300">
                            {c.email}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.linkedinUrl && (
                          <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-muted-foreground">
                            <ExternalLink size={13} />
                          </a>
                        )}
                        <HubSpotStatusBadge status={c.hubspotStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
