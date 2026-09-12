'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TabProps } from '@/app/page';
import { useAppStore } from '@/lib/store';
import type { SettingsDTO } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';
import type { QuotationStatus } from '@/lib/types';
import { money, formatDate, num } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Armchair,
  Scissors,
  Layers,
  Wrench,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Calculator,
  RefreshCw,
  ChevronRight,
  Sparkles,
  ListChecks,
  Users,
  CalendarClock,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

interface DashboardAlert {
  level: 'error' | 'warning';
  message: string;
  detail?: string;
}

interface DashboardData {
  furnitureCount: number;
  piecesCount: number;
  materialsCount: number;
  hardwareCount: number;
  quotationsCount: number;
  alerts: DashboardAlert[];
  settings: SettingsDTO;
}

type KpiKey =
  | 'furnitureCount'
  | 'piecesCount'
  | 'materialsCount'
  | 'hardwareCount'
  | 'quotationsCount';

const KPIS: { key: KpiKey; label: string; icon: LucideIcon }[] = [
  { key: 'furnitureCount', label: 'Muebles en catálogo', icon: Armchair },
  { key: 'piecesCount', label: 'Piezas de despiece', icon: Scissors },
  { key: 'materialsCount', label: 'Materiales activos', icon: Layers },
  { key: 'hardwareCount', label: 'Herrajes activos', icon: Wrench },
  { key: 'quotationsCount', label: 'Cotizaciones', icon: FileText },
];

const IMPROVEMENTS: string[] = [
  'El acabado BLANCO ahora incluye Kit Minifixx y Taquetes que el Excel omitía por error (costos ligeramente mayores, correctos).',
  'Precios calculados en vivo desde los despieces: cambiar un precio actualiza todo al instante.',
  'Parámetros configurables: factor de venta 6.70, IVA 16%, descuento distribuidor 35% y cubierta cobrada por ML redondeada a múltiplos de 1.20 m.',
  'Dos acabados: BLANCO (cuerpo ARAUCO + frentes VESTO) y MADERADO (todo en VESTO NOUGAT).',
];

const STATUS_BADGE_CLASS: Record<QuotationStatus, string> = {
  BORRADOR: 'bg-stone-100 text-stone-700 border-stone-200',
  ENVIADA: 'bg-amber-100 text-amber-800 border-amber-200',
  ACEPTADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PRODUCCION: 'bg-orange-100 text-orange-800 border-orange-200',
  TERMINADO: 'bg-brand-100 text-brand-800 border-brand-200',
  ENTREGADA: 'bg-emerald-600 text-white border-emerald-600',
  RECHAZADA: 'bg-red-100 text-red-700 border-red-200',
  CANCELADA: 'bg-stone-200 text-stone-700 border-stone-300',
};

export default function DashboardTab({ onNavigate }: TabProps) {
  const quotations = useAppStore((s) => s.quotations);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error('dashboard');
      const json: DashboardData = await res.json();
      setData(json);
    } catch {
      setError('No se pudo cargar el resumen del sistema.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recent = quotations.slice(0, 5);
  const alerts = data?.alerts ?? [];
  const settings = data?.settings;
  const clients = useAppStore((s) => s.clients);

  /* Seguimientos pendientes de clientes (hoy o atrasados), los más urgentes primero */
  const pendingFollowUps = clients
    .filter((c) => c.nextFollowUpAt && new Date(c.nextFollowUpAt).getTime() <= new Date().setHours(23, 59, 59, 999))
    .sort(
      (a, b) => new Date(a.nextFollowUpAt!).getTime() - new Date(b.nextFollowUpAt!).getTime()
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Resumen general</h2>
          <p className="text-sm text-stone-500">
            Estado del catálogo, auditoría de datos y actividad reciente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {settings && (
            <div className="hidden md:flex items-center gap-2" aria-label="Parámetros actuales">
              <Badge variant="outline" className="border-stone-200 text-stone-600">
                Factor {num(settings.saleFactor)}
              </Badge>
              <Badge variant="outline" className="border-stone-200 text-stone-600">
                IVA {num(settings.ivaRate * 100, 0)}%
              </Badge>
              <Badge variant="outline" className="border-stone-200 text-stone-600">
                Distribuidor −{num(settings.distributorDiscount * 100, 0)}%
              </Badge>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Actualizar resumen"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} aria-hidden="true" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <section aria-label="Indicadores clave">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {KPIS.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card
                key={kpi.key}
                className="bg-white rounded-xl border border-stone-200 shadow-sm py-4"
              >
                <CardContent className="px-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"
                      aria-hidden="true"
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-stone-500">
                        {kpi.label}
                      </p>
                      {loading ? (
                        <Skeleton className="mt-1 h-7 w-14" />
                      ) : (
                        <p className="text-2xl font-bold leading-tight tabular-nums">
                          {num(data?.[kpi.key] ?? 0, 0)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Auditoría + Mejoras */}
      <section aria-label="Estado de los datos y mejoras" className="grid gap-4 lg:grid-cols-5">
        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="w-4 h-4 text-amber-600" aria-hidden="true" />
              Estado de los datos
            </CardTitle>
            <CardDescription>
              Auditoría automática del catálogo y los despieces.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2" aria-hidden="true">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  Reintentar
                </Button>
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Todo listo para cotizar</p>
                  <p className="text-sm text-emerald-700/80">
                    El catálogo, los despieces y los parámetros están completos.
                  </p>
                </div>
              </div>
            ) : (
              <ul
                className="max-h-60 space-y-2 overflow-y-auto pr-1"
                aria-label="Alertas de auditoría"
              >
                {alerts.map((a, i) => (
                  <li
                    key={`${a.level}-${i}`}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg border p-3',
                      a.level === 'error'
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50'
                    )}
                  >
                    {a.level === 'error' ? (
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          a.level === 'error' ? 'text-red-800' : 'text-amber-800'
                        )}
                      >
                        {a.message}
                      </p>
                      {a.detail && <p className="mt-0.5 text-xs text-stone-600">{a.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!loading && !error && alerts.length > 0 && (
              <p className="mt-3 text-xs text-stone-500">
                {alerts.length} {alerts.length === 1 ? 'pendiente' : 'pendientes'} detectados en la
                auditoría automática.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-amber-600" aria-hidden="true" />
              Mejoras sobre el Excel
            </CardTitle>
            <CardDescription>
              Correcciones y capacidades nuevas respecto a la hoja original.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {IMPROVEMENTS.map((text, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-stone-600">{text}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* CRM: seguimiento de clientes */}
      <section aria-label="Seguimiento de clientes">
        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-4 h-4 text-amber-600" aria-hidden="true" />
                  Seguimiento de clientes (CRM)
                </CardTitle>
                <CardDescription>
                  {clients.length === 0
                    ? 'Registra prospectos y da seguimiento a cada comunicación.'
                    : `${clients.length} cliente${clients.length === 1 ? '' : 's'} en seguimiento.`}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => onNavigate?.('clientes')}
                className="bg-brand-600 text-white hover:bg-brand-700"
              >
                {clients.length === 0 ? (
                  <>
                    <UserPlus className="w-4 h-4" aria-hidden="true" />
                    Abrir CRM
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    Abrir CRM
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingFollowUps.length === 0 ? (
              <p className="text-sm text-stone-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                Sin seguimientos pendientes para hoy. ¡Al día!
              </p>
            ) : (
              <ul className="space-y-2">
                {pendingFollowUps.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('clientes')}
                      className="w-full rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-left transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      aria-label={`Seguimiento pendiente de ${c.name}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-stone-900 truncate">{c.name}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 shrink-0">
                          <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                          {formatDate(c.nextFollowUpAt!)}
                        </span>
                      </div>
                      {c.phone && <p className="text-xs text-stone-500 mt-0.5">{c.phone}</p>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Cotizaciones recientes + Acciones rápidas */}
      <section aria-label="Actividad reciente y acciones" className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-amber-600" aria-hidden="true" />
              Cotizaciones recientes
            </CardTitle>
            <CardDescription>Las últimas 5 cotizaciones registradas.</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
                <FileText className="h-8 w-8 text-stone-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-stone-700">Aún no hay cotizaciones</p>
                  <p className="text-sm text-stone-500">
                    Crea tu primera cotización desde el cotizador.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onNavigate?.('cotizador')}
                  className="bg-brand-600 text-white hover:bg-brand-700"
                >
                  <Calculator className="w-4 h-4" aria-hidden="true" />
                  Ir al cotizador
                </Button>
              </div>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {recent.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('cotizaciones')}
                      className="w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      aria-label={`Ver cotización ${q.folio} de ${q.clientName}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-stone-900">{q.folio}</span>
                        <Badge variant="outline" className={STATUS_BADGE_CLASS[q.status]}>
                          {STATUS_LABELS[q.status]}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                        <span className="truncate text-sm text-stone-500">
                          {q.clientName} · {formatDate(q.createdAt)} ·{' '}
                          {q.items.length === 1 ? '1 mueble' : `${q.items.length} muebles`}
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-stone-900">
                          {money(q.totalWithIva)}
                          <ChevronRight className="h-4 w-4 text-stone-400" aria-hidden="true" />
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Acciones rápidas</CardTitle>
            <CardDescription>Atajos a las secciones más usadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              className="w-full bg-brand-600 text-white hover:bg-brand-700"
              onClick={() => onNavigate?.('cotizador')}
            >
              <Calculator className="w-4 h-4" aria-hidden="true" />
              Ir al cotizador
            </Button>
            <Button variant="outline" className="w-full" onClick={() => onNavigate?.('muebles')}>
              <Armchair className="w-4 h-4" aria-hidden="true" />
              Ver muebles
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onNavigate?.('cotizaciones')}
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              Ver cotizaciones
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
