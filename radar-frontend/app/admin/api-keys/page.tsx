'use client';

import { useEffect, useState } from 'react';
import { Key, Plus, Pencil, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiKeyConfig {
  id: string;
  provider: 'anthropic' | 'openai' | 'google';
  label: string;
  model: string;
  api_key_masked: string;
  is_active: boolean;
  is_default: boolean;
  monthly_budget_usd: number | null;
  created_at: string;
  updated_at: string;
}

type Provider = 'anthropic' | 'openai' | 'google';

const PROVIDER_DEFAULTS: Record<Provider, { label: string; model: string }> = {
  anthropic: { label: 'Claude Sonnet 4.6', model: 'claude-sonnet-4-6' },
  openai:    { label: 'GPT-4o',            model: 'gpt-4o'            },
  google:    { label: 'Gemini 2.0 Flash',  model: 'gemini-2.0-flash'  },
};

// ---------------------------------------------------------------------------
// Provider badge styling
// ---------------------------------------------------------------------------

function ProviderBadge({ provider }: { provider: Provider }) {
  const styles: Record<Provider, string> = {
    anthropic: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    openai:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    google:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  };
  const labels: Record<Provider, string> = {
    anthropic: 'Anthropic',
    openai:    'OpenAI',
    google:    'Google',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[provider]}`}
    >
      {labels[provider]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Form dialog (Add / Edit)
// ---------------------------------------------------------------------------

interface FormState {
  provider: Provider;
  label: string;
  model: string;
  api_key: string;
  is_active: boolean;
  monthly_budget_usd: string;
}

function getDefaultForm(provider: Provider = 'anthropic'): FormState {
  return {
    provider,
    label:              PROVIDER_DEFAULTS[provider].label,
    model:              PROVIDER_DEFAULTS[provider].model,
    api_key:            '',
    is_active:          false,
    monthly_budget_usd: '',
  };
}

interface ConfigDialogProps {
  open:        boolean;
  editing:     ApiKeyConfig | null;
  onClose:     () => void;
  onSaved:     () => void;
}

function ConfigDialog({ open, editing, onClose, onSaved }: ConfigDialogProps) {
  const [form,       setForm]       = useState<FormState>(getDefaultForm());
  const [showKey,    setShowKey]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          provider:           editing.provider,
          label:              editing.label,
          model:              editing.model,
          api_key:            '',        // never pre-fill key
          is_active:          editing.is_active,
          monthly_budget_usd: editing.monthly_budget_usd != null
            ? String(editing.monthly_budget_usd)
            : '',
        });
      } else {
        setForm(getDefaultForm());
      }
      setShowKey(false);
      setSaveError(null);
    }
  }, [open, editing]);

  function handleProviderChange(p: Provider) {
    setForm((f) => ({
      ...f,
      provider: p,
      label:    PROVIDER_DEFAULTS[p].label,
      model:    PROVIDER_DEFAULTS[p].model,
    }));
  }

  async function handleSubmit() {
    if (!form.label.trim() || !form.model.trim()) {
      setSaveError('Label y modelo son requeridos');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const budget = form.monthly_budget_usd.trim()
        ? Number(form.monthly_budget_usd)
        : null;

      const payload = {
        provider:           form.provider,
        label:              form.label.trim(),
        model:              form.model.trim(),
        api_key:            form.api_key || undefined,
        is_active:          form.is_active,
        monthly_budget_usd: budget,
      };

      const url    = editing ? `/api/admin/api-keys/${editing.id}` : '/api/admin/api-keys';
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Editar configuracion IA' : 'Nueva configuracion IA'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Provider */}
          <div className="space-y-1.5">
            <Label htmlFor="cfg-provider">Proveedor</Label>
            <Select
              value={form.provider}
              onValueChange={(v) => handleProviderChange(v as Provider)}
            >
              <SelectTrigger id="cfg-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label htmlFor="cfg-label">Label</Label>
            <Input
              id="cfg-label"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Claude Sonnet 4.6"
            />
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label htmlFor="cfg-model">Modelo</Label>
            <Input
              id="cfg-model"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              placeholder="claude-sonnet-4-6"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label htmlFor="cfg-key">
              API Key{editing ? ' (dejar en blanco para no cambiar)' : ''}
            </Label>
            <div className="relative">
              <Input
                id="cfg-key"
                type={showKey ? 'text' : 'password'}
                value={form.api_key}
                onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                placeholder={editing ? '••••••••' : 'sk-ant-...'}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? 'Ocultar key' : 'Mostrar key'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Monthly budget */}
          <div className="space-y-1.5">
            <Label htmlFor="cfg-budget">Presupuesto mensual (USD, opcional)</Label>
            <Input
              id="cfg-budget"
              type="number"
              min="0"
              step="0.01"
              value={form.monthly_budget_usd}
              onChange={(e) => setForm((f) => ({ ...f, monthly_budget_usd: e.target.value }))}
              placeholder="50.00"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="cfg-active"
              checked={form.is_active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
            />
            <Label htmlFor="cfg-active" className="cursor-pointer">
              Activo
            </Label>
          </div>

          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" />
                Guardando...
              </>
            ) : (
              editing ? 'Guardar cambios' : 'Crear'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminApiKeysPage() {
  const [configs,     setConfigs]     = useState<ApiKeyConfig[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [editing,     setEditing]     = useState<ApiKeyConfig | null>(null);

  async function loadConfigs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/api-keys');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as ApiKeyConfig[];
      setConfigs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando configuraciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfigs();
  }, []);

  async function handleToggleActive(config: ApiKeyConfig) {
    setActionError(null);
    const res = await fetch(`/api/admin/api-keys/${config.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: !config.is_active }),
    });
    if (!res.ok) {
      setActionError('Error al actualizar. Intenta de nuevo.');
    } else {
      void loadConfigs();
    }
  }

  async function handleSetDefault(config: ApiKeyConfig) {
    setActionError(null);
    const res = await fetch(`/api/admin/api-keys/${config.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_default: true }),
    });
    if (!res.ok) {
      setActionError('Error al actualizar. Intenta de nuevo.');
    } else {
      void loadConfigs();
    }
  }

  async function handleDelete(config: ApiKeyConfig) {
    if (!confirm(`Eliminar "${config.label}"? Esta accion no se puede deshacer.`)) return;
    setActionError(null);
    const res = await fetch(`/api/admin/api-keys/${config.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setActionError('Error al eliminar. Intenta de nuevo.');
    } else {
      void loadConfigs();
    }
  }

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(config: ApiKeyConfig) {
    setEditing(config);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Key size={20} className="text-primary" />
            API Keys de IA
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra las credenciales de los proveedores de IA usados por el Radar.
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus size={14} className="mr-1.5" />
          Nueva configuracion
        </Button>
      </div>

      {/* Action error banner */}
      {actionError && (
        <p className="text-sm text-red-500">{actionError}</p>
      )}

      {/* Loading */}
      {loading && (
        <Card className="overflow-hidden">
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </Card>
      )}

      {/* Error */}
      {!loading && error && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-destructive">Error al cargar las configuraciones</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadConfigs()}>
            Reintentar
          </Button>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && configs.length === 0 && (
        <Card className="p-12 text-center">
          <Key size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">Sin configuraciones de API</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Agrega tu primera configuracion de proveedor de IA para comenzar.
          </p>
          <Button size="sm" className="mt-4" onClick={openAdd}>
            <Plus size={14} className="mr-1.5" />
            Agregar configuracion
          </Button>
        </Card>
      )}

      {/* Table */}
      {!loading && !error && configs.length > 0 && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((cfg) => (
                <TableRow key={cfg.id}>
                  <TableCell>
                    <ProviderBadge provider={cfg.provider} />
                  </TableCell>
                  <TableCell className="font-medium">{cfg.label}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{cfg.model}</code>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {cfg.api_key_masked || <span className="italic">sin key</span>}
                    </code>
                  </TableCell>
                  <TableCell>
                    {cfg.monthly_budget_usd != null
                      ? `$${Number(cfg.monthly_budget_usd).toFixed(2)}`
                      : <span className="text-muted-foreground">—</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={cfg.is_active}
                      onCheckedChange={() => void handleToggleActive(cfg)}
                    />
                  </TableCell>
                  <TableCell>
                    {cfg.is_default ? (
                      <Badge tone="success">Default</Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSetDefault(cfg)}
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Establecer
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(cfg)}
                        aria-label="Editar"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDelete(cfg)}
                        aria-label="Eliminar"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog */}
      <ConfigDialog
        open={dialogOpen}
        editing={editing}
        onClose={closeDialog}
        onSaved={() => void loadConfigs()}
      />
    </div>
  );
}
