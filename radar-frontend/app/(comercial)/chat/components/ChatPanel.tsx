'use client';

import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Sparkles, Bot, User } from 'lucide-react';

interface Signal {
  id: string;
  empresa_nombre: string;
  empresa_es_nueva: boolean;
  tipo_senal: string | null;
  descripcion: string | null;
  ventana_compra: string | null;
  nivel_confianza: 'ALTA' | 'MEDIA' | 'BAJA' | null;
  pais: string | null;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  signals?: Signal[];
}

const EXAMPLES = [
  '¿Hay licitaciones BHS en Chile?',
  'Busca CAPEX de Mercado Libre',
  'Expansiones de cartón en México 2026',
  '¿Qué señales nuevas hay en intralogística Colombia?',
];

export function ChatPanel() {
  const [turns, setTurns]     = useState<ChatTurn[]>([]);
  const [input, setInput]     = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [provider, setProvider] = useState<'claude' | 'openai' | 'gemini'>('claude');
  const scrollRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, loading]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');
    setTurns((t) => [...t, { role: 'user', text: q }]);
    setLoading(true);

    try {
      const r = await fetch('/api/radar/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, provider }),
      });
      const data = await r.json();
      setTurns((t) => [
        ...t,
        {
          role: 'assistant',
          text: data.message ?? data.error ?? 'Sin respuesta.',
          signals: data.signals,
        },
      ]);
    } catch (err) {
      setTurns((t) => [
        ...t,
        { role: 'assistant', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const allSignals = turns.flatMap((t) => t.signals ?? []);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* Chat (60%) */}
      <Card className="flex flex-col lg:col-span-3 min-h-[28rem] max-h-[36rem]">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto p-4">
          {turns.length === 0 && (
            <div className="space-y-3 py-8 text-center">
              <Sparkles size={28} className="mx-auto text-primary" />
              <p className="text-sm font-medium">Hacé una pregunta para empezar</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={`flex gap-2 ${t.role === 'user' ? 'justify-end' : ''}`}>
              {t.role === 'assistant' && <Bot size={18} className="mt-1 shrink-0 text-primary" />}
              <div
                className={
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm ' +
                  (t.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/40')
                }
              >
                <p className="whitespace-pre-wrap">{t.text}</p>
                {t.signals && t.signals.length > 0 && (
                  <p className="mt-1 text-xs opacity-70">
                    {t.signals.length} señal{t.signals.length !== 1 ? 'es' : ''} →
                  </p>
                )}
              </div>
              {t.role === 'user' && <User size={18} className="mt-1 shrink-0 text-muted-foreground" />}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <Bot size={18} className="mt-1 text-primary" />
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <Loader2 size={14} className="inline animate-spin" /> Buscando…
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Proveedor IA:</span>
            <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
              {(['claude','openai','gemini'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={
                    'rounded px-2 py-0.5 text-[11px] font-medium transition-all ' +
                    (provider === p
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground')
                  }
                >
                  {p === 'claude' ? 'Claude' : p === 'openai' ? 'OpenAI' : 'Gemini'}
                </button>
              ))}
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Hacé tu pregunta…"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" size="sm" disabled={!input.trim() || loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </Button>
          </form>
        </div>
      </Card>

      {/* Signals panel (40%) */}
      <Card className="lg:col-span-2 max-h-[36rem] overflow-auto p-4">
        <h3 className="mb-3 text-sm font-semibold">Señales detectadas</h3>
        {allSignals.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Las señales encontradas aparecerán aquí.
          </p>
        ) : (
          <div className="space-y-2">
            {allSignals.map((s) => {
              const conf =
                s.nivel_confianza === 'ALTA' ? 'border-emerald-500 text-emerald-600'
                : s.nivel_confianza === 'MEDIA' ? 'border-amber-500 text-amber-600'
                : 'border-muted-foreground text-muted-foreground';
              return (
                <div key={s.id} className="rounded-md border border-border p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.empresa_nombre}</p>
                      {s.tipo_senal && <p className="text-[10px] text-primary">{s.tipo_senal}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {s.empresa_es_nueva && (
                        <Badge variant="outline" className="text-[9px]">Nueva</Badge>
                      )}
                      {s.nivel_confianza && (
                        <span className={`rounded-full border px-1.5 py-0 text-[9px] ${conf}`}>
                          {s.nivel_confianza}
                        </span>
                      )}
                    </div>
                  </div>
                  {s.descripcion && (
                    <p className="mt-1.5 text-muted-foreground line-clamp-2">{s.descripcion}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
