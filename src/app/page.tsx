'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useSession, homeForRole } from '@/lib/use-session';
import type { UserRole } from '@/lib/types';
import { USER_ROLE_LABELS } from '@/lib/types';
import DashboardTab from '@/components/tabs/DashboardTab';
import FurnitureTab from '@/components/tabs/FurnitureTab';
import CatalogTab from '@/components/tabs/CatalogTab';
import QuoterTab from '@/components/tabs/QuoterTab';
import MaquilaTab from '@/components/tabs/MaquilaTab';
import QuotesTab from '@/components/tabs/QuotesTab';
import ClientsTab from '@/components/tabs/ClientsTab';
import SettingsTab from '@/components/tabs/SettingsTab';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Armchair,
  Boxes,
  Calculator,
  Scissors,
  FileText,
  Users,
  Settings2,
  Hammer,
  Loader2,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { overdueFollowUps, stalledClients } from '@/lib/crm';
import { stalledThreshold } from '@/lib/store';

export type TabId = 'inicio' | 'muebles' | 'catalogo' | 'cotizador' | 'maquila' | 'cotizaciones' | 'clientes' | 'config';

export interface TabProps {
  onNavigate?: (tab: TabId) => void;
}

/* Orden lógico: trabajo diario primero; lo que se configura una vez (muebles,
   catálogo, parámetros) al final, tras el separador del nav. `roles` define
   quién la ve: TIENDA opera el día a día; lo estructural es de ADMIN. */
const TABS: { id: TabId; label: string; icon: React.ElementType; roles: UserRole[] }[] = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard, roles: ['ADMIN', 'TIENDA'] },
  { id: 'cotizador', label: 'Cocinas', icon: Calculator, roles: ['ADMIN', 'TIENDA'] },
  { id: 'maquila', label: 'Maquila', icon: Scissors, roles: ['ADMIN', 'TIENDA'] },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText, roles: ['ADMIN', 'TIENDA'] },
  { id: 'clientes', label: 'Clientes (CRM)', icon: Users, roles: ['ADMIN', 'TIENDA'] },
  { id: 'muebles', label: 'Muebles', icon: Armchair, roles: ['ADMIN'] },
  { id: 'catalogo', label: 'Catálogo', icon: Boxes, roles: ['ADMIN'] },
  { id: 'config', label: 'Configuración', icon: Settings2, roles: ['ADMIN'] },
];

export default function Home() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>('inicio');
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);
  const fetchQuotations = useAppStore((s) => s.fetchQuotations);
  const fetchClients = useAppStore((s) => s.fetchClients);
  const catalog = useAppStore((s) => s.catalog);
  const quotations = useAppStore((s) => s.quotations);
  const clients = useAppStore((s) => s.clients);

  const isInternal = !!user && user.role !== 'CLIENTE';
  const visibleTabs = TABS.filter((t) => !user || t.roles.includes(user.role));

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/login');
    else if (user.role === 'CLIENTE') router.replace(homeForRole(user.role));
  }, [sessionLoading, user, router]);

  useEffect(() => {
    if (!isInternal) return;
    fetchCatalog();
    fetchQuotations();
    fetchClients();
  }, [isInternal, fetchCatalog, fetchQuotations, fetchClients]);

  const overdueCount = overdueFollowUps(clients).length;
  const stalledCount = stalledClients(clients, stalledThreshold(catalog)).length;
  const solicitudesCount = quotations.filter((q) => q.status === 'SOLICITUD').length;
  const alertTotal = overdueCount + stalledCount;

  useEffect(() => {
    if (!isInternal || alertTotal === 0) {
      document.title = 'Cotizador de Muebles';
      return;
    }
    if (overdueCount > 0 && stalledCount > 0) {
      document.title = `(${alertTotal}) Cotizador de Muebles`;
    } else if (overdueCount > 0) {
      document.title = `(${overdueCount} atrasados) Cotizador de Muebles`;
    } else {
      document.title = `(${stalledCount} sin contacto) Cotizador de Muebles`;
    }
  }, [isInternal, alertTotal, overdueCount, stalledCount]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  if (sessionLoading || !user || !isInternal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" aria-label="Cargando" />
      </div>
    );
  }

  const renderTab = () => {
    const props: TabProps = { onNavigate: setActiveTab };
    const allowed = (id: TabId) => visibleTabs.some((t) => t.id === id);
    switch (activeTab) {
      case 'inicio':
        return <DashboardTab {...props} />;
      case 'cotizador':
        return <QuoterTab {...props} />;
      case 'maquila':
        return <MaquilaTab {...props} />;
      case 'cotizaciones':
        return <QuotesTab {...props} />;
      case 'clientes':
        return <ClientsTab {...props} />;
      case 'muebles':
        return allowed('muebles') ? <FurnitureTab {...props} /> : null;
      case 'catalogo':
        return allowed('catalogo') ? <CatalogTab {...props} /> : null;
      case 'config':
        return allowed('config') ? <SettingsTab {...props} /> : null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster richColors position="bottom-right" />

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 h-14">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-600 text-white shrink-0">
              <Hammer className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
                {catalog?.settings.companyName || 'Cotizador de Muebles'}
              </h1>
              <p className="text-[11px] sm:text-xs text-stone-500 leading-tight hidden sm:block">
                Despieces · Herrajes · Cotizaciones · Producción
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-stone-500">
              <span className="hidden md:inline rounded-full bg-stone-100 px-2.5 py-1">{catalog?.furniture.length ?? '—'} muebles</span>
              <span className="hidden md:inline rounded-full bg-stone-100 px-2.5 py-1">{quotations.length ?? 0} cotizaciones</span>
              <span
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-amber-800"
                title={`${user.name} · ${USER_ROLE_LABELS[user.role]}`}
              >
                <span className="font-semibold truncate max-w-[10rem]">{user.name}</span>
                <span className="text-amber-600/80">·</span>
                <span className="text-amber-700">{USER_ROLE_LABELS[user.role]}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="h-8 w-8 text-stone-500 hover:text-stone-800"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <nav aria-label="Navegación principal" className="flex gap-1 overflow-x-auto no-scrollbar -mb-px pb-0">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              const badge =
                t.id === 'clientes'
                  ? overdueCount > 0
                    ? { value: overdueCount, title: `${overdueCount} seguimiento(s) atrasado(s)`, cls: 'bg-red-500 text-white' }
                    : stalledCount > 0
                      ? { value: stalledCount, title: `${stalledCount} cliente(s) sin contacto`, cls: 'bg-orange-500 text-white' }
                      : null
                  : t.id === 'cotizaciones' && solicitudesCount > 0
                    ? { value: solicitudesCount, title: `${solicitudesCount} solicitud(es) del portal por atender`, cls: 'bg-indigo-500 text-white' }
                    : null;
              return (
                <Fragment key={t.id}>
                  {t.id === 'muebles' && (
                    <span
                      aria-hidden="true"
                      className="mx-1.5 h-6 w-px shrink-0 self-center bg-stone-200"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    aria-current={active ? 'page' : undefined}
                    aria-label={badge ? `${t.label}, ${badge.title}` : undefined}
                    title={badge?.title}
                    className={cn(
                      'flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-t-md shrink-0',
                      active
                        ? 'border-amber-600 text-amber-700 bg-amber-50/60'
                        : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                    {badge && badge.value > 0 && (
                      <span
                        className={cn(
                          'ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5',
                          badge.cls
                        )}
                      >
                        {badge.value > 99 ? '99+' : badge.value}
                      </span>
                    )}
                  </button>
                </Fragment>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">{renderTab()}</main>

      <footer className="mt-auto bg-white border-t border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-stone-500">
          <span>
            {catalog?.settings.companyName || 'Cotizador de Muebles'} · Precios en MXN · IVA {((catalog?.settings.ivaRate ?? 0.16) * 100).toFixed(0)}%
          </span>
          <span>Datos persistidos localmente · Factor de venta {catalog?.settings.saleFactor ?? 6.7}</span>
        </div>
      </footer>
    </div>
  );
}
