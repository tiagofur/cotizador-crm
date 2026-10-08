'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, homeForRole } from '@/lib/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hammer, Loader2, LogIn } from 'lucide-react';

/** Pantalla de acceso. Si la BD no tiene usuarios, ofrece crear al ADMIN inicial. */
export default function LoginPage() {
  const router = useRouter();
  const { user, needsBootstrap, companyName, loading } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Alta inicial de admin
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!loading && user) router.replace(homeForRole(user.role));
  }, [loading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(needsBootstrap ? '/api/auth/bootstrap' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsBootstrap ? { name, email, password } : { identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo iniciar sesión');
        return;
      }
      router.replace(homeForRole(data.user.role));
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setBusy(false);
    }
  };

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" aria-label="Cargando" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-600 text-white shadow-sm">
            <Hammer className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-stone-900">{companyName || 'Cotizador de Muebles'}</h1>
          <p className="text-sm text-stone-500">
            {needsBootstrap ? 'Primer arranque: crea tu usuario administrador' : 'Inicia sesión para continuar'}
          </p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {needsBootstrap ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Tu nombre</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" required autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Correo</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="identifier">Correo o teléfono</Label>
                  <Input
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="tu@correo.com · 322 000 0000"
                    required
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={needsBootstrap ? 'new-password' : 'current-password'}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                {needsBootstrap ? 'Crear administrador' : 'Iniciar sesión'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-stone-400 mt-4">Acceso restringido al personal y clientes registrados</p>
      </div>
    </div>
  );
}
