'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import DashboardTab from '@/components/tabs/DashboardTab';
import FurnitureTab from '@/components/tabs/FurnitureTab';
import CatalogTab from '@/components/tabs/CatalogTab';
import QuoterTab from '@/components/tabs/QuoterTab';
import QuotesTab from '@/components/tabs/QuotesTab';
import ClientsTab from '@/components/tabs/ClientsTab';
import SettingsTab from '@/components/tabs/SettingsTab';
import { Toaster } from '@/components/ui/sonner';
import {
  LayoutDashboard,
  Armchair,
  Boxes,
  Calculator,
  FileText,
  Users,
  Settings2,
  Hammer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { overdueFollowUps, stalledClients } from '@/lib/crm';
import { stalledThreshold } from '@/lib/store';

export type TabId = 'inicio' | 'muebles' | 'catalogo' | 'cotizador' | 'cotizaciones' | 'clientes' | 'config';

export interface TabProps {
  onNavigate?: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
  { id: 'muebles', label: 'Muebles', icon: Armchair },
  { id: 'catalogo', label: 'Catálogo', icon: Boxes },
  { id: 'cotizador', label: 'Cotizador', icon: Calculator },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText },
  { id: 'clientes', label: 'Clientes (CRM)', icon: Users },
  { id: 'config', label: 'Configuración', icon: Settings2 },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('inicio');
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);
  const fetchQuotations = useAppStore((s) => s.fetchQuotations);
  const fetchClients = useAppStore((s) => s.fetchClients);
  const catalog = useAppStore((s) => s.catalog);
  const quotations = useAppStore((s) => s.quotations);
  const clients = useAppStore((s) => s.clients);

  useEffect(() => {
    fetchCatalog();
    fetchQuotations();
    fetchClients();
  }, [fetchCatalog, fetchQuotations, fetchClients]);

  const overdueCount = overdueFollowUps(clients).length;
  const stalledCount = stalledClients(clients, stalledThreshold(catalog)).length;
  const alertTotal = overdueCount + stalledCount;

  useEffect(() => {
    if (alertTotal === 0) {
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
  }, [alertTotal, overdueCount, stalledCount]);

  const renderTab = () => {
    const props: TabProps = { onNavigate: setActiveTab };
    switch (activeTab) {
      case 'inicio':
        return <DashboardTab {...props} />;
      case 'muebles':
        return <FurnitureTab {...props} />;
      case 'catalogo':
        return <CatalogTab {...props} />;
      case 'cotizador':
        return <QuoterTab {...props} />;
      case 'cotizaciones':
        return <QuotesTab {...props} />;
      case 'clientes':
        return <ClientsTab {...props} />;
      case 'config':
        return <SettingsTab {...props} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
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
            <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-stone-500">
              <span className="rounded-full bg-stone-100 px-2.5 py-1">{catalog?.furniture.length ?? '—'} muebles</span>
              <span className="rounded-full bg-stone-100 px-2.5 py-1">{quotations.length ?? 0} cotizaciones</span>
            </div>
          </div>
          <nav aria-label="Navegación principal" className="flex gap-1 overflow-x-auto -mb-px pb-0">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              const badge =
                t.id === 'clientes'
                  ? overdueCount > 0
                    ? { value: overdueCount, title: `${overdueCount} seguimiento(s) atrasado(s)`, cls: 'bg-red-500 text-white' }
                    : stalledCount > 0
                      ? { value: stalledCount, title: `${stalledCount} cliente(s) sin contacto`, cls: 'bg-orange-500 text-white' }
                      : null
                  : null;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={badge ? `${t.label}, ${badge.title}` : undefined}
                  title={badge?.title}
                  className={cn(
                    'flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-t-md',
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
