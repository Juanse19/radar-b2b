'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Check,
  Copy,
  Database,
  DollarSign,
  Globe,
  Layers,
  Pencil,
  Save,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromptData {
  provider:                string;
  model:                   string;
  description:             string;
  price_input_per_m:       number;
  price_output_per_m:      number;
  supports_web_search:     boolean;
  supports_prompt_caching: boolean;
  system_prompt:           string;
  user_message_template:   string;
  today:                   string;
  estimated_system_tokens: number;
  estimated_user_tokens:   number;
  is_admin:                boolean;
  is_db_override:          boolean;
}

type Provider = 'claude' | 'openai' | 'gemini';

// ─── Provider config ──────────────────────────────────────────────────────────

const PROVIDERS: {
  key:   Provider;
  label: string;
  icon:  string;
  ring:  string;
  badge: string;
}[] = [
  {
    key:   'claude',
    label: 'Claude',
    icon:  '🟠',
    ring:  'ring-orange-500/40 bg-orange-500/10 text-orange-300',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  },
  {
    key:   'openai',
    label: 'OpenAI',
    icon:  '🟢',
    ring:  'ring-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    key:   'gemini',
    label: 'Gemini',
    icon:  '🔵',
    ring:  'ring-blue-500/40 bg-blue-500/10 text-blue-300',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function highlightVariables(text: string): React.ReactNode[] {
  return text.split(/(\{[a-z_]+\})/g).map((part, i) =>
    /^\{[a-z_]+\}$/.test(part) ? (
      <mark key={i} className="rounded bg-yellow-400/20 px-0.5 text-yellow-300 not-italic">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function fmt(n: number): string {
  return n.toLocaleString('es-CO');
}

function fmtPrice(p: number): string {
  return `$${p.toFixed(3)}/1M`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }, [text]);

  const cls = size === 'xs'
    ? 'flex items-center gap-1 rounded px-2 py-1 text-[11px]'
    : 'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs';

  return (
    <button
      onClick={handleCopy}
      className={`${cls} border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white`}
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className ?? ''}`}>
      {children}
    </span>
  );
}

function StatRow({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="flex items-center gap-2 text-slate-400">
        {icon}
        {label}
      </span>
      <span className={`font-medium ${highlight ? 'text-emerald-400' : 'text-slate-200'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPromptsPage() {
  const [active,       setActive]       = useState<Provider>('claude');
  const [data,         setData]         = useState<PromptData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [isEditing,    setIsEditing]    = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [savedOk,      setSavedOk]      = useState(false);

  const loadPrompt = useCallback((provider: string) => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIsEditing(false);
    setSaveError(null);
    setSavedOk(false);

    fetch(`/api/comercial/prompt?provider=${provider}`)
      .then(r => r.json())
      .then((json: PromptData & { error?: string }) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
          setEditedPrompt(json.system_prompt);
        }
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => loadPrompt(active), [active, loadPrompt]);

  const handleSave = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res  = await fetch('/api/admin/prompts', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider: data.provider, system_prompt: editedPrompt }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setSaveError(json.error ?? 'Error al guardar');
      } else {
        setSavedOk(true);
        setIsEditing(false);
        loadPrompt(active);
        setTimeout(() => setSavedOk(false), 3500);
      }
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [data, editedPrompt, active, loadPrompt]);

  const activeCfg = PROVIDERS.find(p => p.key === active)!;
  const totalTokens = (data?.estimated_system_tokens ?? 0) + (data?.estimated_user_tokens ?? 0);
  const cost100 = data
    ? ((totalTokens * data.price_input_per_m) / 1_000_000
     + (300 * data.price_output_per_m) / 1_000_000) * 100
    : 0;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-semibold text-foreground">
            <Bot size={20} className="text-primary" />
            Prompts del Agente RADAR
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prompt MAOA unificado — mismo contenido para los tres proveedores de IA
          </p>
        </div>
        {savedOk && (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            <Check size={14} />
            Guardado correctamente
          </div>
        )}
      </div>

      {/* ── Provider tabs ── */}
      <div className="flex gap-3">
        {PROVIDERS.map(p => (
          <button
            key={p.key}
            onClick={() => setActive(p.key)}
            className={`
              flex items-center gap-2.5 rounded-xl border px-5 py-3 text-sm font-medium
              transition-all duration-150
              ${active === p.key
                ? `ring-2 ${p.ring} border-transparent`
                : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'}
            `}
          >
            <span className="text-base leading-none">{p.icon}</span>
            {p.label}
            {active === p.key && data?.is_db_override && (
              <Pill className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
                DB
              </Pill>
            )}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Skeleton ── */}
      {loading && !error && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
            <div className="h-[560px] animate-pulse rounded-xl bg-muted/40" />
            <div className="h-[200px] animate-pulse rounded-xl bg-muted/40" />
          </div>
          <div className="space-y-3">
            <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
            <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      {!loading && !error && data && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* System Prompt panel */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {/* Panel header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">System Prompt</span>
                  <Pill className="border-border bg-muted text-muted-foreground">
                    <Layers size={10} />
                    {fmt(data.estimated_system_tokens)} tokens
                  </Pill>
                  {data.supports_prompt_caching && (
                    <Pill className="border-purple-500/30 bg-purple-500/10 text-purple-400">
                      <Zap size={10} />
                      cacheable
                    </Pill>
                  )}
                  {data.is_db_override && (
                    <Pill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                      <Database size={10} />
                      DB override
                    </Pill>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {data.is_admin && !isEditing && (
                    <button
                      onClick={() => { setIsEditing(true); setSaveError(null); }}
                      className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Pencil size={12} />
                      Editar
                    </button>
                  )}
                  {isEditing && (
                    <>
                      <button
                        onClick={() => { setIsEditing(false); setEditedPrompt(data.system_prompt); setSaveError(null); }}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <X size={12} />
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <Save size={12} />
                        {saving ? 'Guardando…' : 'Guardar'}
                      </button>
                    </>
                  )}
                  {!isEditing && <CopyButton text={data.system_prompt} />}
                </div>
              </div>

              {/* Save error */}
              {saveError && (
                <div className="border-b border-destructive/20 bg-destructive/10 px-5 py-2.5 text-xs text-destructive">
                  {saveError}
                </div>
              )}

              {/* Prompt body */}
              {isEditing ? (
                <textarea
                  value={editedPrompt}
                  onChange={e => setEditedPrompt(e.target.value)}
                  className="w-full min-h-[560px] resize-y bg-transparent px-5 py-4 font-mono text-[13px] leading-relaxed text-foreground outline-none"
                  spellCheck={false}
                />
              ) : (
                <pre className="max-h-[560px] overflow-auto px-5 py-4 font-mono text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                  {data.system_prompt}
                </pre>
              )}
            </div>

            {/* User message panel */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">User Message</span>
                  <Pill className="border-border bg-muted text-muted-foreground">
                    <Layers size={10} />
                    {fmt(data.estimated_user_tokens)} tokens
                  </Pill>
                  <Pill className="border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
                    variables
                  </Pill>
                </div>
                <CopyButton text={data.user_message_template} />
              </div>
              <pre className="max-h-[160px] overflow-auto px-5 py-4 font-mono text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                {highlightVariables(data.user_message_template)}
              </pre>
            </div>

            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers size={12} className="text-primary" />
                <span className="font-medium text-foreground">{fmt(totalTokens)}</span>
                tokens totales
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5">
                <DollarSign size={12} className="text-emerald-400" />
                Est. 100 empresas:
                <span className="font-mono font-semibold text-emerald-400">${cost100.toFixed(2)}</span>
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} />
                Modelo:
                <span className="font-mono font-medium text-foreground">{data.model}</span>
              </span>
              <span className="text-border">|</span>
              <span>
                Fecha inyectada:
                <span className="ml-1 font-mono font-medium text-foreground">{data.today}</span>
              </span>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-4">

            {/* Provider card */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{activeCfg.icon}</span>
                  <h3 className="text-sm font-semibold text-foreground">{data.model}</h3>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {data.description}
                </p>
              </div>

              <div className="divide-y divide-border">
                <StatRow
                  icon={<Globe size={13} />}
                  label="Búsqueda web"
                  value={data.supports_web_search ? 'Sí' : 'No'}
                  highlight={data.supports_web_search}
                />
                <StatRow
                  icon={<Database size={13} />}
                  label="Prompt caching"
                  value={data.supports_prompt_caching ? 'Sí (90% desc.)' : 'No'}
                  highlight={data.supports_prompt_caching}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: 'Input',  price: data.price_input_per_m  },
                  { label: 'Output', price: data.price_output_per_m },
                ] as const).map(({ label, price }) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                      <DollarSign size={10} />
                      {label}
                    </div>
                    <div className="font-mono text-sm font-semibold text-foreground">
                      {fmtPrice(price)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-[11px] text-muted-foreground mb-1">Est. 100 empresas</div>
                <div className="font-mono text-xl font-bold text-emerald-400">
                  ${cost100.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Variable legend */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Search size={14} className="text-muted-foreground" />
                Variables del prompt
              </h3>
              <div className="space-y-2.5">
                {([
                  { name: '{empresa}', desc: 'Nombre de la empresa, ej. "DHL Express"' },
                  { name: '{pais}',    desc: 'País objetivo, ej. "Colombia"' },
                  { name: '{linea}',   desc: 'Línea de negocio, ej. "Intralogística"' },
                ] as const).map(v => (
                  <div key={v.name} className="flex items-start gap-2.5 text-xs">
                    <code className="shrink-0 rounded border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 font-mono text-yellow-300">
                      {v.name}
                    </code>
                    <span className="text-muted-foreground leading-relaxed">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* MAOA info */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-primary/80">
                <Bot size={14} />
                MAOA Agente 1
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Prompt unificado con 10 secciones: metodología 4-pasos, 6 líneas de negocio,
                evaluación temporal, criterios de validación, anti-alucinación y taxonomía de tipos.
              </p>
              <p className="text-xs text-muted-foreground">
                Todos los proveedores usan el mismo prompt base. Los cambios guardados aplican
                solo al proveedor seleccionado.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
