'use client';

/* ============================================================
 * ClientsTab — CRM: registro y seguimiento de clientes
 * KPIs de seguimiento + lista con búsqueda/filtros + acciones
 * rápidas (registrar interacción, WhatsApp, editar, eliminar)
 * ============================================================ */

import { useMemo, useState } from 'react';
import type { TabProps } from '@/app/page';
import { useAppStore } from '@/lib/store';
import type { ClientDTO, ClientStage } from '@/lib/types';
import {
  ACTIVE_STAGES,
  CLIENT_KINDS,
  CLIENT_KIND_LABELS,
  CLIENT_STAGES,
  CLIENT_STAGE_LABELS,
} from '@/lib/types';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Search,
  Loader2,
  PhoneCall,
  MessageCircle,
  Mail,
  Pencil,
  Trash2,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ClientDialog from '@/components/crm/client-dialog';
import LogInteractionDialog from '@/components/crm/log-interaction-dialog';
import ClientDetail from '@/components/crm/client-detail';
import { followUpStatus, overdueFollowUps, sortClients, type ClientSort } from '@/lib/crm';
import ReportsView from '@/components/crm/reports-view';
import WhatsAppTemplateDialog, { waPhone } from '@/components/crm/whatsapp-template-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** Normaliza texto (minúsculas y sin acentos) */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const SCROLL_XS =
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300 hover:[&::-webkit-scrollbar-thumb]:bg-stone-400';

const STAGE_BADGE: Record<ClientStage, string> = {
  NUEVO: 'bg-stone-100 text-stone-600 border-stone-200',
  PROSPECTANDO: 'bg-amber-50 text-amber-700 border-amber-200',
  CONTACTADO: 'bg-orange-50 text-orange-700 border-orange-200',
  COTIZADO: 'bg-amber-100 text-amber-800 border-amber-300',
  NEGOCIACION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  GANADO: 'bg-emerald-600/15 text-emerald-800 border-emerald-300',
  PERDIDO: 'bg-red-50 text-red-600 border-red-200',
};

function relativeDays(iso: string | null): string {
  if (!iso) return 'Sin contacto';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000));
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} d`;
  const months = Math.floor(days / 30);
  return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000));
}

/** Semáforo del último contacto: verde ≤7d, ámbar 8-21d, rojo >21d o nunca */
function contactTone(c: ClientDTO): 'ok' | 'warn' | 'late' {
  const d = daysSince(c.lastContactAt);
  if (c.stage === 'PERDIDO') return 'ok';
  if (d === Infinity) return 'late';
  if (d > 21) return 'late';
  if (d > 7) return 'warn';
  return 'ok';
}

const TONE_DOT: Record<'ok' | 'warn' | 'late', string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  late: 'bg-red-500',
};

type DetailView = { mode: 'detail' } | { mode: 'edit' } | null;

export default function ClientsTab({ onNavigate }: TabProps) {
  const clients = useAppStore((s) => s.clients);
  const quotations = useAppStore((s) => s.quotations);
  const loadingClients = useAppStore((s) => s.loadingClients);
  const fetchClients = useAppStore((s) => s.fetchClients);
  const fetchQuotations = useAppStore((s) => s.fetchQuotations);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [kindFilter, setKindFilter] = useState<string>('ALL');
  const [onlyPending, setOnlyPending] = useState(false);
  const [sort, setSort] = useState<ClientSort>('urgencia');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDTO | null>(null);
  const [logFor, setLogFor] = useState<ClientDTO | null>(null);
  const [waFor, setWaFor] = useState<ClientDTO | null>(null);
  const [detail, setDetail] = useState<DetailView>(null);
  const [detailClient, setDetailClient] = useState<ClientDTO | null>(null);
  const [deleting, setDeleting] = useState<ClientDTO | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  /* ---------- KPIs (calculados en cliente con la misma lógica del server) ---------- */
  const stats = useMemo(() => {
    const byStage = { NUEVO: 0, PROSPECTANDO: 0, CONTACTADO: 0, COTIZADO: 0, NEGOCIACION: 0, GANADO: 0, PERDIDO: 0 } as Record<ClientStage, number>;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    let toContactToday = 0;
    let overdue = 0;
    let inactive30 = 0;
    for (const c of clients) {
      byStage[c.stage] = (byStage[c.stage] ?? 0) + 1;
      if (c.nextFollowUpAt) {
        const t = new Date(c.nextFollowUpAt).getTime();
        if (t <= todayEnd.getTime()) {
          toContactToday++;
          if (t < Date.now() - 24 * 3600 * 1000) overdue++;
        }
      }
      const last = c.lastContactAt ? new Date(c.lastContactAt).getTime() : new Date(c.createdAt).getTime();
      if (Date.now() - last > 30 * 24 * 3600 * 1000 && ACTIVE_STAGES.includes(c.stage)) inactive30++;
    }
    return { byStage, toContactToday, overdue, inactive30 };
  }, [clients]);

  const overdue = useMemo(() => overdueFollowUps(clients), [clients]);

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    return clients.filter((c) => {
      if (stageFilter !== 'ALL' && c.stage !== stageFilter) return false;
      if (kindFilter !== 'ALL' && c.kind !== kindFilter) return false;
      if (onlyOverdue && !overdue.some((o) => o.id === c.id)) return false;
      if (onlyPending) {
        const due = c.nextFollowUpAt && new Date(c.nextFollowUpAt).getTime() <= Date.now() + 24 * 3600 * 1000;
        if (!due) return false;
      }
      if (!q) return true;
      const hay = norm([c.name, c.company, c.phone, c.email, c.city].filter(Boolean).join(' '));
      return hay.includes(q);
    });
  }, [clients, search, stageFilter, kindFilter, onlyPending, onlyOverdue, overdue]);

  const sorted = useMemo(() => sortClients(filtered, sort), [filtered, sort]);

  /* ---------- Acciones ---------- */

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(c: ClientDTO) {
    setEditing(c);
    setDialogOpen(true);
  }

  function openDetail(c: ClientDTO) {
    setDetailClient(c);
    setDetail({ mode: 'detail' });
  }

  function upsertClient(c: ClientDTO) {
    // El store se refresca con fetchClients; esto solo acelera la UI de diálogos abiertos
    if (detailClient?.id === c.id) setDetailClient(c);
  }

  async function afterMutation() {
    await Promise.all([fetchClients(), fetchQuotations()]);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/clients/${deleting.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al eliminar el cliente');
      toast.success(`Cliente «${deleting.name}» eliminado`);
      setDeleting(null);
      await afterMutation();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar el cliente');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* ================= KPIs de seguimiento ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500">Total clientes</p>
                <p className="text-2xl font-bold tabular-nums">{clients.length}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-stone-100">
                <Users className="w-5 h-5 text-stone-500" aria-hidden />
              </div>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              {stats.byStage.PROSPECTANDO + stats.byStage.NUEVO} en prospectación
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'rounded-xl border shadow-sm bg-white',
            stats.toContactToday > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-stone-200'
          )}
        >
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500">Por contactar hoy</p>
                <p className="text-2xl font-bold tabular-nums text-amber-700">{stats.toContactToday}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
                <CalendarClock className="w-5 h-5 text-amber-600" aria-hidden />
              </div>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              {stats.overdue > 0 ? `${stats.overdue} atrasado${stats.overdue === 1 ? '' : 's'}` : 'Sin atrasos'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500">Sin contacto &gt; 30 días</p>
                <p className="text-2xl font-bold tabular-nums">{stats.inactive30}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100">
                <AlertTriangle className="w-5 h-5 text-red-500" aria-hidden />
              </div>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">En etapas activas</p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500">Ganados / Negociación</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-700">
                  {stats.byStage.GANADO + stats.byStage.NEGOCIACION}
                </p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden />
              </div>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">{stats.byStage.GANADO} ganados</p>
          </CardContent>
        </Card>
      </div>

      {/* ================= Sub-pestañas: Clientes / Reportes ================= */}
      <Tabs defaultValue="clientes">
        <TabsList className="bg-white border border-stone-200 h-10 p-1">
          <TabsTrigger
            value="clientes"
            className="data-[state=active]:bg-stone-800 data-[state=active]:text-white px-4 gap-1.5"
          >
            <Users className="w-4 h-4" aria-hidden />
            Clientes
          </TabsTrigger>
          <TabsTrigger
            value="reportes"
            className="data-[state=active]:bg-brand-600 data-[state=active]:text-white px-4 gap-1.5"
          >
            <BarChart3 className="w-4 h-4" aria-hidden />
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="mt-4">
      {/* ================= Lista de clientes ================= */}
      <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" aria-hidden />
                Clientes y prospectos
              </CardTitle>
              <CardDescription className="text-xs">
                Registro y seguimiento de comunicación — nunca más olvides a quién contactar
              </CardDescription>
            </div>
            <Button
              onClick={openCreate}
              className="bg-brand-600 hover:bg-brand-700 text-white shrink-0"
            >
              <UserPlus className="w-4 h-4" aria-hidden />
              Nuevo cliente
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, empresa, teléfono, correo…"
                aria-label="Buscar clientes"
                className="pl-8 h-9 bg-white border-stone-300"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger
                size="sm"
                className="w-full lg:w-[170px] bg-white border-stone-300 h-9"
                aria-label="Filtrar por etapa"
              >
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las etapas</SelectItem>
                {CLIENT_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CLIENT_STAGE_LABELS[s]} ({stats.byStage[s]})
                  </SelectItem>
              ))}
                </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger
                size="sm"
                className="w-full lg:w-[160px] bg-white border-stone-300 h-9"
                aria-label="Filtrar por tipo"
              >
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                {CLIENT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {CLIENT_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setOnlyOverdue((v) => !v)}
              aria-pressed={onlyOverdue}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-xs font-medium shrink-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                onlyOverdue
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
              Atrasados ({overdue.length})
            </button>
            <Select value={sort} onValueChange={(v) => setSort(v as ClientSort)}>
              <SelectTrigger
                size="sm"
                className="w-full lg:w-[170px] bg-white border-stone-300 h-9"
                aria-label="Ordenar clientes"
              >
                <SelectValue placeholder="Orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgencia">Orden: urgencia</SelectItem>
                <SelectItem value="recientes">Orden: recientes</SelectItem>
                <SelectItem value="nombre">Orden: nombre (A–Z)</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 h-9 cursor-pointer select-none shrink-0">
              <Checkbox
                checked={onlyPending}
                onCheckedChange={(v) => setOnlyPending(v === true)}
                aria-label="Mostrar solo seguimientos pendientes"
              />
              <span className="text-xs text-stone-600">Solo pendientes</span>
            </label>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {loadingClients && clients.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-stone-500">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" aria-hidden />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <Users className="w-10 h-10 text-stone-300" aria-hidden />
              {clients.length === 0 ? (
                <>
                  <p className="text-sm text-stone-500 max-w-sm">
                    Aún no tienes clientes registrados. Agrega tus prospectos (carpinteros,
                    distribuidores, fábricas…) para darles seguimiento.
                  </p>
                  <Button onClick={openCreate} className="bg-brand-600 hover:bg-brand-700 text-white">
                    <UserPlus className="w-4 h-4" aria-hidden />
                    Registrar primer cliente
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-stone-500">Sin resultados para los filtros actuales.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setStageFilter('ALL');
                      setKindFilter('ALL');
                      setOnlyPending(false);
                      setOnlyOverdue(false);
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className={cn('max-h-[62vh] overflow-auto -mx-1 px-1', SCROLL_XS)}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow className="hover:bg-white">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>
                      <span title="Verde ≤7 días · Ámbar 8–21 · Rojo &gt;21 o sin contacto">Último contacto</span>
                    </TableHead>
                    <TableHead>Seguimiento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((c) => {
                    const tone = contactTone(c);
                    const fuStatus = followUpStatus(c);
                    return (
                      <TableRow
                        key={c.id}
                        className={cn(
                          fuStatus === 'overdue' && 'bg-amber-50',
                          fuStatus === 'today' && 'bg-amber-50/50'
                        )}
                      >
                        <TableCell className="max-w-[280px]">
                          <button
                            type="button"
                            onClick={() => openDetail(c)}
                            className="text-left w-full outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                            aria-label={`Ver ficha de ${c.name}`}
                          >
                            <p className="font-medium leading-tight truncate hover:text-amber-700">
                              {c.name}
                            </p>
                            <p className="text-xs text-stone-500 truncate">
                              {CLIENT_KIND_LABELS[c.kind]}
                              {c.company ? ` · ${c.company}` : ''}
                              {c.phone ? ` · ${c.phone}` : ''}
                            </p>
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STAGE_BADGE[c.stage]}>
                            {CLIENT_STAGE_LABELS[c.stage]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn('w-2 h-2 rounded-full shrink-0', TONE_DOT[tone])}
                              aria-hidden
                            />
                            <div>
                              <p className="text-sm leading-tight">{relativeDays(c.lastContactAt)}</p>
                              <p className="text-[11px] text-stone-400 leading-tight">
                                {c.lastInteraction
                                  ? c.lastInteraction.type === 'COTIZACION'
                                    ? 'Cotización'
                                    : c.lastInteraction.type === 'WHATSAPP'
                                      ? 'WhatsApp'
                                      : c.lastInteraction.type === 'LLAMADA'
                                        ? 'Llamada'
                                        : c.lastInteraction.type === 'EMAIL'
                                          ? 'Correo'
                                          : c.lastInteraction.type === 'VISITA'
                                            ? 'Visita'
                                            : 'Nota'
                                  : '—'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.nextFollowUpAt ? (
                            <span
                              className={cn(
                                'text-sm inline-flex items-center gap-1',
                                fuStatus === 'overdue'
                                  ? 'font-semibold text-red-600'
                                  : fuStatus === 'today'
                                    ? 'font-semibold text-amber-700'
                                    : 'text-stone-600'
                              )}
                              title={
                                fuStatus === 'overdue'
                                  ? 'Seguimiento atrasado'
                                  : fuStatus === 'today'
                                    ? 'Vence hoy'
                                    : undefined
                              }
                            >
                              <CalendarClock className="w-3.5 h-3.5" aria-hidden />
                              {formatDate(c.nextFollowUpAt)}
                            </span>
                          ) : (
                            <span className="text-xs text-stone-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setLogFor(c)}
                              aria-label={`Registrar interacción con ${c.name}`}
                              title="Registrar llamada / WhatsApp / correo"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                              <PhoneCall className="w-4 h-4" aria-hidden />
                            </Button>
                            {waPhone(c.phone) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setWaFor(c)}
                                aria-label={`Enviar WhatsApp a ${c.name}`}
                                title="Enviar por WhatsApp con plantilla"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              >
                                <MessageCircle className="w-4 h-4" aria-hidden />
                              </Button>
                            )}
                            {c.email && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(`mailto:${c.email}`, '_self')}
                                aria-label={`Enviar correo a ${c.name}`}
                                title="Enviar correo"
                                className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              >
                                <Mail className="w-4 h-4" aria-hidden />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(c)}
                              aria-label={`Editar ${c.name}`}
                              title="Editar cliente"
                              className="h-8 w-8 text-stone-500 hover:text-stone-700"
                            >
                              <Pencil className="w-4 h-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleting(c)}
                              aria-label={`Eliminar ${c.name}`}
                              title="Eliminar cliente"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="reportes" className="mt-4">
          <ReportsView clients={clients} onClientUpdated={upsertClient} />
        </TabsContent>
      </Tabs>

      {/* ================= Diálogos ================= */}
      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editing}
        onSaved={(c) => {
          upsertClient(c);
          void afterMutation();
        }}
      />

      {logFor && (
        <LogInteractionDialog
          open={!!logFor}
          onOpenChange={(o) => !o && setLogFor(null)}
          client={logFor}
          onLogged={(_it, client) => {
            upsertClient(client);
            void afterMutation();
          }}
        />
      )}

      {waFor && (
        <WhatsAppTemplateDialog
          open={!!waFor}
          onOpenChange={(o) => !o && setWaFor(null)}
          client={waFor}
          quotations={quotations}
          onLogged={(_it, client) => {
            upsertClient(client);
            void afterMutation();
          }}
        />
      )}

      {detailClient && detail && (
        <ClientDetail
          open={detail.mode === 'detail'}
          onOpenChange={(o) => {
            if (!o) setDetail(null);
          }}
          client={detailClient}
          onClientUpdated={upsertClient}
          onLogInteraction={() => {
            setLogFor(detailClient);
          }}
          onEdit={() => setDetail({ mode: 'edit' })}
          onNewQuotation={() => {
            setDetail(null);
            onNavigate?.('cotizador');
          }}
          onWhatsApp={waPhone(detailClient.phone) ? () => setWaFor(detailClient) : undefined}
        />
      )}

      {detail?.mode === 'edit' && detailClient && (
        <ClientDialog
          open
          onOpenChange={(o) => {
            if (!o) setDetail({ mode: 'detail' });
          }}
          client={detailClient}
          onSaved={(c) => {
            upsertClient(c);
            setDetail({ mode: 'detail' });
            void afterMutation();
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará su historial de interacciones. Si el cliente tiene cotizaciones vinculadas no
              podrá eliminarse. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
