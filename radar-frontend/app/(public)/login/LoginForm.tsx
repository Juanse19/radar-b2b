'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/auth/actions';
import { Loader2, AlertCircle } from 'lucide-react';

export function LoginForm() {
  const [state, action, isPending] = useActionState(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-sm font-medium text-foreground"
        >
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="correo@empresa.com"
          required
          disabled={isPending}
          className="border border-border rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary transition-all text-sm bg-surface text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-sm font-medium text-foreground"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          disabled={isPending}
          className="border border-border rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary transition-all text-sm bg-surface text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Error alert */}
      {state.error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
        >
          <AlertCircle size={15} className="shrink-0" />
          {state.error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
      >
        {isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Iniciando sesión...
          </>
        ) : (
          'Iniciar sesión'
        )}
      </button>
    </form>
  );
}
