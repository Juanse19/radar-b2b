import { getCurrentSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { Radar } from 'lucide-react';
import { LoginForm } from './LoginForm';

export const metadata = {
  title: 'Iniciar sesión — Matec Radar B2B',
};

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) redirect('/');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sidebar border border-white/10">
              <Radar size={28} className="text-sidebar-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Matec Radar B2B
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sistema de Inteligencia Comercial
            </p>
          </div>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-border bg-surface-muted p-6 shadow-lg">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
