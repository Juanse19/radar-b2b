'use client';

import { useState, useEffect, useCallback } from 'react';
import { Code2, Copy, Check, Zap, Globe, Database, DollarSign } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

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
}

type Provider = 'claude' | 'openai' | 'gemini';

const PROVIDERS: { key: Provider; label: string; color: string }[] = [
  { key: 'claude', label: 'Claude',  color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  { key: 'openai', label: 'OpenAI',  color: 'bg-green-500/10  text-green-400  border-green-500/30'  },
  { key: 'gemini', label: 'Gemini',  color: 'bg-blue-500/10   text-blue-400   border-blue-500/30'   },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Wrap variable placeholders in a highlighted span inside rendered text. */
function highlightVariables(text: string): React.ReactNode[] {
  const parts = text.split(/(\{[a-z_]+\})/g);
  return parts.map((part, i) =>
    /^\{[a-z_]+\}$/.test(part) ? (
      <mark
        key={i}
        className="rounded bg-yellow-400/25 px-0.5 text-yellow-300 not-italic"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function formatPrice(pricePerM: number): string {
  return `$${pricePerM.toFixed(3)}/1M tokens`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied — silent fail */
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      title="Copiar al portapapeles"
      className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
    >
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

function TokenBadge({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
      <span className="font-medium text-slate-200">{count.toLocaleString()}</span>
      {label}
    </span>
  );
}

function ProviderCard({ data }: { data: PromptData }) {
  const totalTokens = data.estimated_system_tokens + data.estimated_user_tokens;
  const costPer100 =
    ((totalTokens * data.price_input_per_m) / 1_000_000 +
     (300 * data.price_output_per_m) / 1_000_000) *
    100;

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-[#1a1d2e] p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">
          {data.model}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {data.description}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-white/5 bg-white/5 p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <DollarSign size={11} />
            Input
          </div>
          <div className="mt-1 font-mono font-medium text-slate-200">
            {formatPrice(data.price_input_per_m)}
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/5 p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <DollarSign size={11} />
            Output
          </div>
          <div className="mt-1 font-mono font-medium text-slate-200">
            {formatPrice(data.price_output_per_m)}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/5 bg-white/5 p-3 text-xs">
        <div className="text-slate-400">Costo est. por 100 empresas</div>
        <div className="mt-1 font-mono text-base font-semibold text-emerald-400">
          ${costPer100.toFixed(2)}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Globe size={11} />
            Búsqueda web
          </span>
          <span
            className={
              data.supports_web_search
                ? 'font-medium text-emerald-400'
                : 'text-slate-500'
            }
          >
            {data.supports_web_search ? 'Si' : 'No'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Database size={11} />
            Prompt caching
          </span>
          <span
            className={
              data.supports_prompt_caching
                ? 'font-medium text-emerald-400'
                : 'text-slate-500'
            }
          >
            {data.supports_prompt_caching ? 'Si (90% desc.)' : 'No'}
          </span>
        </div>
      </div>
    </div>
  );
}

function VariableLegend() {
  const vars = [
    { name: '{empresa}', desc: 'Nombre de la empresa, ej. "DHL Express"' },
    { name: '{pais}',    desc: 'País objetivo, ej. "Colombia"' },
    { name: '{linea}',   desc: 'Línea de negocio, ej. "Intralogística"' },
    { name: '{today}',   desc: 'Fecha actual inyectada al build del prompt' },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1d2e] p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Variables del prompt</h3>
      <div className="space-y-2">
        {vars.map((v) => (
          <div key={v.name} className="flex items-start gap-3 text-xs">
            <code className="mt-0.5 shrink-0 rounded bg-yellow-400/15 px-1.5 py-0.5 font-mono text-yellow-300">
              {v.name}
            </code>
            <span className="text-slate-400">{v.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────

export default function PromptViewerPage() {
  const [activeProvider, setActiveProvider] = useState<Provider>('claude');
  const [data, setData] = useState<PromptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/radar-v2/prompt?provider=${activeProvider}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          if (json.error) {
            setError(json.error as string);
          } else {
            setData(json as PromptData);
          }
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [activeProvider]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Code2 size={20} className="text-primary" />
            Visor de Prompts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prompts exactos enviados al modelo de IA al escanear una empresa
          </p>
        </div>
      </div>

      {/* Provider tabs */}
      <div className="flex gap-2">
        {PROVIDERS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setActiveProvider(key)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              activeProvider === key
                ? color
                : 'border-white/10 bg-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div className="h-8 animate-pulse rounded-lg bg-white/5" />
            <div className="h-[500px] animate-pulse rounded-xl bg-white/5" />
          </div>
          <div className="space-y-4">
            <div className="h-64 animate-pulse rounded-xl bg-white/5" />
            <div className="h-40 animate-pulse rounded-xl bg-white/5" />
          </div>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && data && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left: prompt panels */}
          <div className="space-y-5">
            {/* System prompt */}
            <div className="rounded-xl border border-white/10 bg-[#12141f]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-200">System Prompt</span>
                  <TokenBadge
                    label="tokens est."
                    count={data.estimated_system_tokens}
                  />
                  {data.supports_prompt_caching && (
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                      cacheable
                    </span>
                  )}
                </div>
                <CopyButton text={data.system_prompt} />
              </div>
              <pre className="overflow-auto max-h-[520px] p-5 font-mono text-[13px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
                {data.system_prompt}
              </pre>
            </div>

            {/* User message template */}
            <div className="rounded-xl border border-white/10 bg-[#12141f]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-200">User Message</span>
                  <TokenBadge
                    label="tokens est."
                    count={data.estimated_user_tokens}
                  />
                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
                    variables resaltadas
                  </span>
                </div>
                <CopyButton text={data.user_message_template} />
              </div>
              <pre className="overflow-auto max-h-[240px] p-5 font-mono text-[13px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
                {highlightVariables(data.user_message_template)}
              </pre>
            </div>

            {/* Token + cost summary bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#1a1d2e] px-5 py-3 text-xs text-slate-400">
              <Zap size={13} className="text-yellow-400" />
              <span>
                Total estimado:{' '}
                <span className="font-semibold text-slate-200">
                  {(data.estimated_system_tokens + data.estimated_user_tokens).toLocaleString()} tokens
                </span>
              </span>
              <span className="text-white/20">|</span>
              <span>
                Fecha inyectada:{' '}
                <span className="font-mono font-semibold text-slate-200">{data.today}</span>
              </span>
              <span className="text-white/20">|</span>
              <span>
                Modelo:{' '}
                <span className="font-mono font-semibold text-slate-200">{data.model}</span>
              </span>
            </div>
          </div>

          {/* Right: provider card + variable legend */}
          <div className="space-y-4">
            <ProviderCard data={data} />
            <VariableLegend />
          </div>
        </div>
      )}
    </div>
  );
}
