'use client';

/* ============================================================
 * ReportsView — Reportes del CRM
 * Embudo por etapa, ganados vs perdidos y respuesta por tipo
 * ============================================================ */

import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { ClientDTO, ClientStage } from '@/lib/types';
import { CLIENT_KIND_LABELS } from '@/lib/types';
import { money, formatDate } from '@/lib/format';
import { buildCrmReport, periodStart, describePeriod, type ReportPeriod } from '@/lib/crm-reports';
import StalledClientsView from './stalled-clients-view';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, Trophy, Scale, Users, BarChart3, Quote, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STAGE_BAR: Record<ClientStage, string> = {
  NUEVO: 'bg-stone-300',
  PROSPECTANDO: 'bg-amber-400',
  CONTACTADO: 'bg-orange-400',
  COTIZADO: 'bg-amber-500',
  NEGOCIACION: 'bg-emerald-500',
  GANADO: 'bg-emerald-600',
  PERDIDO: 'bg-red-400',
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'month', label: 'Este mes' },
  { value: 'quarter', label: 'Últimos 3 meses' },
  { value: 'all', label: 'Todo el histórico' },
];

export default function ReportsView({
  clients,
  onClientUpdated,
}: {
  clients: ClientDTO[];
  onClientUpdated?: (client: ClientDTO) => void;
}) {
  const [period, setPeriod] = useState<ReportPeriod>('all');
  const start = periodStart(period);

  /* Clientes creados dentro del periodo */
  const periodClients = useMemo(
    () => (start ? clients.filter((c) => new Date(c.createdAt).getTime() >= start.getTime()) : clients),
    [clients, start]
  );

  /* IDs de clientes con cotización creada dentro del periodo */
  const quotations = useAppStore((s) => s.quotations);
  const periodQuotedIds = useMemo(() => {
    const set = new Set<string>();
    for (const q of quotations) {
      if (start && new Date(q.createdAt).getTime() < start.getTime()) continue;
      if (q.clientId) set.add(q.clientId);
      set.add(`name:${q.clientName.trim().toLowerCase()}`);
    }
    return set;
  }, [quotations, start]);

  const report = useMemo(
    () => buildCrmReport(periodClients, { quotedClientIds: periodQuotedIds }),
    [periodClients, periodQuotedIds]
  );

  /* Totales económicos de cotizaciones del periodo (ventas con IVA, por estado) */
  const periodQuotations = useMemo(
    () => (start ? quotations.filter((q) => new Date(q.createdAt).getTime() >= start.getTime()) : quotations),
    [quotations, start]
  );
  const moneyStats = useMemo(() => {
    let won = 0;
    let open = 0;
    for (const q of periodQuotations) {
      if (q.status === 'ACEPTADA' || q.status === 'PRODUCCION' || q.status === 'ENTREGADA') {
        won += q.totalWithIva;
      } else if (q.status === 'BORRADOR' || q.status === 'ENVIADA') {
        open += q.totalWithIva;
      }
    }
    return { won, open };
  }, [periodQuotations]);

  if (clients.length === 0) {
    return (
      <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <BarChart3 className="w-10 h-10 text-stone-300" aria-hidden />
          <p className="text-sm text-stone-500 max-w-sm">
            Los reportes aparecerán cuando tengas clientes registrados en el CRM.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { funnel, wonLost, byKind, total, activeStagesCount } = report;
  const periodLabel = describePeriod(period);

  return (
    <div className="space-y-5">
      {/* ================= Selector de periodo ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-500 flex items-center gap-1.5">
          <CalendarRange className="w-4 h-4 text-amber-600" aria-hidden />
          Clientes registrados y cotizaciones creadas {periodLabel}.
        </p>
        <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
          <SelectTrigger
            size="sm"
            className="w-[210px] bg-white border-stone-300 h-9"
            aria-label="Elegir periodo del reporte"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ================= Resumen ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-stone-500">Clientes en CRM</p>
            <p className="text-2xl font-bold tabular-nums">{total}</p>
            <p className="text-[11px] text-stone-400 mt-1">{activeStagesCount} en proceso activo</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500">Ganados</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-700">{wonLost.won}</p>
              </div>
              <Trophy className="w-5 h-5 text-emerald-500" aria-hidden />
            </div>
            <p className="text-[11px] text-stone-400 mt-1">{money(moneyStats.won)} en cotizaciones cerradas</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500">Perdidos</p>
                <p className="text-2xl font-bold tabular-nums text-red-600">{wonLost.lost}</p>
              </div>
              <Scale className="w-5 h-5 text-red-300" aria-hidden />
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              Tasa de cierre: <strong className="text-stone-600">{pct(wonLost.winRate)}</strong>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500">En negociación</p>
                <p className="text-2xl font-bold tabular-nums text-amber-700">
                  {funnel.find((f) => f.stage === 'NEGOCIACION')?.count ?? 0}
                </p>
              </div>
              <Quote className="w-5 h-5 text-amber-600" aria-hidden />
            </div>
            <p className="text-[11px] text-stone-400 mt-1">{money(moneyStats.open)} por cerrar</p>
          </CardContent>
        </Card>
      </div>

      {/* ================= Clientes estancados (alerta «ahora», independiente del periodo) ================= */}
      <StalledClientsView
        clients={clients}
        onClientUpdated={
          onClientUpdated ?? (() => {
            /* sin integración de store cuando se usa standalone */
          })
        }
      />

      {/* ================= Embudo por etapa ================= */}
      <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-600" aria-hidden />
            Embudo de conversión por etapa
          </CardTitle>
          <CardDescription className="text-xs">
            Clientes registrados {periodLabel} · etapa actual del pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {funnel.map((row) => (
            <div key={row.stage} className="flex items-center gap-3">
              <span className="w-24 sm:w-28 text-xs text-stone-600 text-right shrink-0">{row.label}</span>
              <div className="flex-1 h-6 rounded-md bg-stone-100 overflow-hidden" role="img" aria-label={`${row.label}: ${row.count} clientes (${pct(row.pct)})`}>
                <div
                  className={cn('h-full rounded-md transition-all', STAGE_BAR[row.stage])}
                  style={{ width: `${Math.max(row.count > 0 ? 4 : 0, row.barPct * 100)}%` }}
                />
              </div>
              <span className="w-16 text-sm tabular-nums shrink-0">
                <strong>{row.count}</strong>
                <span className="text-[11px] text-stone-400"> · {pct(row.pct)}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ================= Ganados vs Perdidos + Respuesta por tipo ================= */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr] items-start">
        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-600" aria-hidden />
              Ganados vs perdidos
            </CardTitle>
            <CardDescription className="text-xs">Clientes cerrados y tasa de cierre</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-3 rounded-full overflow-hidden bg-stone-100" role="img" aria-label={`${wonLost.won} ganados, ${wonLost.lost} perdidos, ${wonLost.active} activos`}>
              {wonLost.won > 0 && (
                <div className="bg-emerald-500 h-full" style={{ width: `${(wonLost.won / Math.max(1, total)) * 100}%` }} />
              )}
              {wonLost.lost > 0 && (
                <div className="bg-red-400 h-full" style={{ width: `${(wonLost.lost / Math.max(1, total)) * 100}%` }} />
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xl font-bold text-emerald-700 tabular-nums">{wonLost.won}</p>
                <p className="text-[11px] text-emerald-700/80">Ganados</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xl font-bold text-red-600 tabular-nums">{wonLost.lost}</p>
                <p className="text-[11px] text-red-600/80">Perdidos</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="text-xl font-bold text-stone-700 tabular-nums">{wonLost.active}</p>
                <p className="text-[11px] text-stone-500">Activos</p>
              </div>
            </div>
            <p className="text-xs text-stone-500 text-center">
              Tasa de cierre sobre cerrados:{' '}
              <strong className="text-stone-700">{pct(wonLost.winRate)}</strong>
              <span className="text-stone-400"> ({wonLost.won} de {wonLost.won + wonLost.lost})</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" aria-hidden />
              Respuesta por tipo de cliente
            </CardTitle>
            <CardDescription className="text-xs">
              Contacto y cotización {periodLabel} sobre el total de cada tipo
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto -mx-1 px-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Contactados</TableHead>
                    <TableHead>Cotizados</TableHead>
                    <TableHead className="text-right">Ganados / Perdidos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byKind.map((k) => (
                    <TableRow key={k.kind} className={cn(k.total === 0 && 'opacity-50')}>
                      <TableCell className="font-medium">{k.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{k.total}</TableCell>
                      <TableCell>
                        {k.total > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-14 rounded-full bg-stone-100 overflow-hidden shrink-0">
                              <div
                                className="h-full bg-orange-400 rounded-full"
                                style={{ width: `${k.contactRate * 100}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-stone-600">
                              {k.contacted} · {pct(k.contactRate)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-300">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {k.total > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-14 rounded-full bg-stone-100 overflow-hidden shrink-0">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${k.quoteRate * 100}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-stone-600">
                              {k.quoted} · {pct(k.quoteRate)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {k.won + k.lost > 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                              {k.won} ganados
                            </Badge>
                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-600">
                              {k.lost} perdidos
                            </Badge>
                          </span>
                        ) : (
                          <span className="text-xs text-stone-300">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-stone-400 mt-3">
              «Contactado» = con al menos un registro en su historial. «Cotizado» = con al menos una
              cotización vinculada.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ================= Cotizaciones recientes por cliente (apoyo) ================= */}
      <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-600" aria-hidden />
            Detalle por cliente con cotizaciones
          </CardTitle>
          <CardDescription className="text-xs">
            Clientes del CRM ordenados por número de cotizaciones
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {clients.filter((c) => c.quotationsCount > 0).length === 0 ? (
            <p className="text-sm text-stone-500 py-4 text-center">
              Aún no hay cotizaciones vinculadas a clientes del CRM.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto -mx-1 px-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Cotizaciones</TableHead>
                    <TableHead className="text-right">Interacciones</TableHead>
                    <TableHead>Último contacto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodClients
                    .filter((c) => c.quotationsCount > 0 || periodQuotedIds.has(`name:${c.name.trim().toLowerCase()}`) || periodQuotedIds.has(c.id))
                    .sort((a, b) => b.quotationsCount - a.quotationsCount)
                    .map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium max-w-[220px] truncate" title={c.name}>
                          {c.name}
                        </TableCell>
                        <TableCell className="text-xs text-stone-500">
                          {CLIENT_KIND_LABELS[c.kind]}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.quotationsCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.interactionsCount}</TableCell>
                        <TableCell className="text-xs text-stone-500">
                          {c.lastContactAt ? formatDate(c.lastContactAt) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
