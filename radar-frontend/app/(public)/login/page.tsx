import { getCurrentSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { LoginForm } from './LoginForm';

export const metadata = {
  title: 'Iniciar sesión — Matec Radar B2B',
};

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) redirect('/');

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Card container */}
      <div className="w-full max-w-sm">
        <div className="rounded-2xl overflow-hidden shadow-[0_12px_36px_rgba(20,46,71,0.12)]">

          {/* ── Header navy ──────────────────────────────────────── */}
          <div className="bg-[#142e47] px-8 py-6">
            <div className="flex items-center gap-3">
              {/* Radar icon */}
              <div className="w-9 h-9 rounded-lg bg-[#71acd2]/20 flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-[#71acd2]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="12" r="5" opacity="0.5" />
                  <circle cx="12" cy="12" r="9" opacity="0.25" />
                  <line x1="12" y1="12" x2="19" y2="5" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Brand text */}
              <div>
                <p
                  className="font-bold text-xl text-white tracking-wider leading-none"
                  style={{ fontFamily: 'var(--font-display), Arial, sans-serif' }}
                >
                  MATEC
                </p>
                <p className="text-xs text-[#71acd2] font-medium tracking-wide mt-0.5">
                  Radar B2B
                </p>
              </div>
            </div>
          </div>

          {/* ── Body blanco ──────────────────────────────────────── */}
          <div className="bg-white px-8 pb-8 pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Sistema de Inteligencia Comercial
            </p>
            <div className="h-px bg-[#142e47]/10 mb-6" />
            <LoginForm />
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          Matec S.A.S · Confidencial · 2026
        </p>
      </div>
    </div>
  );
}
