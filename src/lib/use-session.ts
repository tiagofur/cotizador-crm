'use client';

/* Hook de sesión: una consulta a /api/auth/session por carga de página. */

import { useEffect, useState } from 'react';
import type { SessionUserDTO } from '@/lib/types';

export interface SessionState {
  user: SessionUserDTO | null;
  /** true mientras aún no existe ningún usuario en la BD (primer arranque) */
  needsBootstrap: boolean;
  companyName: string | null;
  loading: boolean;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    user: null,
    needsBootstrap: false,
    companyName: null,
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: Omit<SessionState, 'loading'>) => {
        if (alive) setState({ ...data, loading: false });
      })
      .catch(() => {
        if (alive) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/** A dónde mandar al usuario según su rol tras iniciar sesión. */
export function homeForRole(role: string): string {
  return role === 'CLIENTE' ? '/portal' : '/';
}
