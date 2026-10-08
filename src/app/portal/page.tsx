'use client';

/* Portal del cliente (rol CLIENTE). Fase 4 del plan de usuarios: aquí vivirán
   las solicitudes de cotización MUEBLE/MAQUILA y el listado "mis cotizaciones". */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Hammer, Loader2, LogOut } from 'lucide-react';

export default function PortalPage() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'CLIENTE') router.replace('/');
  }, [loading, user, router]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  if (loading || !user || user.role !== 'CLIENTE') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" aria-label="Cargando" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-600 text-white shadow-sm">
            <Hammer className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-stone-900">Portal de clientes</h1>
          <p className="text-sm text-stone-500">Hola, {user.name}</p>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-stone-600">
              Pronto podrás solicitar cotizaciones de muebles y maquila desde aquí y dar seguimiento a las existentes.
            </p>
            <p className="text-sm text-stone-400 mt-2">Mientras tanto, tu asesor de tienda te atiende por WhatsApp.</p>
            <Button variant="outline" onClick={logout} className="mt-6">
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
