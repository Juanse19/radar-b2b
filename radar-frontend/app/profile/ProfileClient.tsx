'use client';
// app/profile/ProfileClient.tsx
// Sprint 3.6 Phase 2 — Interactive profile forms
//
// Handles: avatar upload, nombre update, and password change.
// Uses sonner toast for user feedback.

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Camera, Loader2, ArrowLeft, KeyRound, User } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type UserRole = 'ADMIN' | 'COMERCIAL' | 'AUXILIAR';

interface ProfileClientProps {
  userId: string;
  nombre: string;
  email: string;
  rol: UserRole;
  avatarUrl: string | null;
  createdAt: string | null;
}

// ── Role badge ────────────────────────────────────────────────────────────────

const roleBadgeClass: Record<UserRole, string> = {
  ADMIN:     'bg-purple-500/15 text-purple-700 border border-purple-300/50',
  COMERCIAL: 'bg-blue-500/15 text-blue-700 border border-blue-300/50',
  AUXILIAR:  'bg-gray-500/15 text-gray-600 border border-gray-300/50',
};

const roleLabel: Record<UserRole, string> = {
  ADMIN:     'Administrador',
  COMERCIAL: 'Comercial',
  AUXILIAR:  'Auxiliar',
};

function RoleBadge({ rol }: { rol: UserRole }) {
  return (
    <span className={cn('inline-flex rounded-md px-2.5 py-0.5 text-xs font-semibold', roleBadgeClass[rol])}>
      {roleLabel[rol]}
    </span>
  );
}

// ── Avatar component ──────────────────────────────────────────────────────────

function Avatar({
  nombre,
  avatarUrl,
  size = 80,
}: {
  nombre: string;
  avatarUrl: string | null;
  size?: number;
}) {
  const initials = nombre
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={nombre}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-[#142e47] text-white font-bold select-none"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      aria-label={nombre}
    >
      {initials}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 bg-[#142e47]/5 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

// ── Label + field ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProfileClient({
  nombre: initialNombre,
  email,
  rol,
  avatarUrl: initialAvatarUrl,
  createdAt,
}: ProfileClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Personal info state
  const [nombre, setNombre]       = useState(initialNombre);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);

  // Password state
  const [passwordNuevo, setPasswordNuevo]       = useState('');
  const [passwordConfirm, setPasswordConfirm]   = useState('');

  // Loading states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingNombre, startSavingNombre]     = useTransition();
  const [savingPassword, startSavingPassword] = useTransition();

  // ── Avatar upload ─────────────────────────────────────────────────────────

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);

      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Error al subir imagen');

      setAvatarUrl(data.avatar_url);
      toast.success('Foto de perfil actualizada');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir imagen');
    } finally {
      setUploadingAvatar(false);
      // Reset so the same file can be re-selected after an error
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Save nombre ───────────────────────────────────────────────────────────

  function handleSaveNombre(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;

    startSavingNombre(async () => {
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nombre.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
        toast.success('Nombre actualizado correctamente');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar');
      }
    });
  }

  // ── Change password ───────────────────────────────────────────────────────

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (passwordNuevo.length < 8) {
      toast.error('La contraseña debe tener mínimo 8 caracteres');
      return;
    }

    if (passwordNuevo !== passwordConfirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    startSavingPassword(async () => {
      try {
        const res = await fetch('/api/profile/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password_nuevo: passwordNuevo }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Error al cambiar contraseña');

        toast.success('Contraseña cambiada correctamente');
        setPasswordNuevo('');
        setPasswordConfirm('');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al cambiar contraseña');
      }
    });
  }

  // ── Format date ───────────────────────────────────────────────────────────

  const miembroDesde = createdAt
    ? new Date(createdAt).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[#71acd2] hover:text-[#5a96be] transition-colors mb-2"
          >
            <ArrowLeft size={15} />
            Volver al dashboard
          </Link>
          <h1 className="text-2xl font-bold font-display text-foreground">Mi Perfil</h1>
        </div>
      </div>

      {/* Avatar section */}
      <div className="flex items-center gap-5 rounded-xl border border-border bg-card p-5">
        <div className="relative shrink-0">
          {uploadingAvatar ? (
            <div
              className="flex items-center justify-center rounded-full bg-[#142e47]/20"
              style={{ width: 80, height: 80 }}
            >
              <Loader2 size={28} className="animate-spin text-[#71acd2]" />
            </div>
          ) : (
            <Avatar nombre={nombre} avatarUrl={avatarUrl} size={80} />
          )}
        </div>

        <div className="space-y-1">
          <p className="font-semibold text-foreground">{nombre}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted/70 transition-colors disabled:opacity-50"
            >
              <Camera size={13} />
              Cambiar foto
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Seleccionar foto de perfil"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Personal information */}
      <Section title="Informacion personal">
        <form onSubmit={handleSaveNombre} className="space-y-4">
          <Field label="Nombre">
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#71acd2]/50 focus:border-[#71acd2]"
                placeholder="Tu nombre completo"
              />
            </div>
          </Field>

          <Field label="Correo electronico">
            <input
              type="email"
              value={email}
              readOnly
              className="w-full rounded-lg border border-input bg-muted/40 py-2 px-3 text-sm text-muted-foreground cursor-not-allowed"
            />
          </Field>

          <div className="flex items-center gap-4">
            <Field label="Rol">
              <RoleBadge rol={rol} />
            </Field>
            <Field label="Miembro desde">
              <p className="text-sm text-muted-foreground">{miembroDesde}</p>
            </Field>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingNombre || !nombre.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#142e47] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3d58] transition-colors disabled:opacity-50"
            >
              {savingNombre && <Loader2 size={14} className="animate-spin" />}
              Guardar cambios
            </button>
          </div>
        </form>
      </Section>

      {/* Change password */}
      <Section title="Cambiar contrasena">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Field label="Nueva contrasena">
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="password"
                value={passwordNuevo}
                onChange={(e) => setPasswordNuevo(e.target.value)}
                required
                minLength={8}
                placeholder="Minimo 8 caracteres"
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#71acd2]/50 focus:border-[#71acd2]"
              />
            </div>
          </Field>

          <Field label="Confirmar nueva contrasena">
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                placeholder="Repite la nueva contrasena"
                className={cn(
                  'w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#71acd2]/50',
                  passwordConfirm && passwordNuevo !== passwordConfirm
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-input focus:border-[#71acd2]',
                )}
              />
            </div>
            {passwordConfirm && passwordNuevo !== passwordConfirm && (
              <p className="text-xs text-red-500 mt-1">Las contrasenas no coinciden</p>
            )}
          </Field>

          <div className="pt-2">
            <button
              type="submit"
              disabled={
                savingPassword ||
                passwordNuevo.length < 8 ||
                passwordNuevo !== passwordConfirm
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#142e47] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3d58] transition-colors disabled:opacity-50"
            >
              {savingPassword && <Loader2 size={14} className="animate-spin" />}
              Cambiar contrasena
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}
