'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/auth/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function LoginForm() {
  const [state, action, isPending] = useActionState(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="correo@empresa.com"
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground"
        >
          Contraseña
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          disabled={isPending}
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="default"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Iniciando sesión...
          </>
        ) : (
          'Iniciar sesión'
        )}
      </Button>
    </form>
  );
}
