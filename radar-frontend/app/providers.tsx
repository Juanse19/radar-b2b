'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/fetcher';

// retryFn vive a nivel de módulo para garantizar la misma referencia entre
// renders. Aunque el QueryClient se inicializa una sola vez (useState lazy
// initializer), tener funciones puras estables fuera del componente es la
// guía oficial de Tanstack Query y evita cualquier sorpresa con HMR.
function retryFn(failureCount: number, error: Error): boolean {
  // 4xx son permanentes — no reintentar.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  // 5xx / red: máximo 1 reintento (2 intentos en total).
  return failureCount < 1;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            60 * 1000,
        refetchOnWindowFocus: false,
        // No tirar errores al boundary: los manejamos con `error` y <ErrorState/>.
        throwOnError:         false,
        retry:                retryFn,
      },
      mutations: {
        throwOnError: false,
        retry:        false,
      },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
