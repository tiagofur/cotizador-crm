'use client';

/* ============================================================
 * QuotesTab — Cotizaciones guardadas
 * Toolbar de búsqueda/estado, tabla con acciones (PDF/Excel/
 * duplicar/eliminar), cambio de estado inline y dialog de
 * detalle con desglose completo.
 * ============================================================ */

import { useEffect, useMemo, useState } from 'react';
import type { TabProps } from '@/app/page';
import { useAppStore, settingsLike, profileOf } from '@/lib/store';
import type { ClientDTO, Finish, QuotationDTO, QuotationStatus } from '@/lib/types';
import { Inbox, TriangleAlert } from 'lucide-react';
import { COTIZACION_STATUSES, PEDIDO_STATUSES, STATUS_LABELS } from '@/lib/types';
import WhatsAppTemplateDialog from '@/components/crm/whatsapp-template-dialog';
import QuotesKanban from '@/components/quotes/quotes-kanban';
import { money, num, formatDate, dims } from '@/lib/format';
import { toast } from 'sonner';
import {
  Calculator,
  Columns3,
  Copy,
  FileSpreadsheet,
  FileText,
  LayoutList,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';

/** Normaliza texto para búsqueda (minúsculas y sin acentos) */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const STATUS_DOT: Record<QuotationStatus, string> = {
  SOLICITUD: 'bg-indigo-500',
  BORRADOR: 'bg-stone-400',
  ENVIADA: 'bg-amber-500',
  ACEPTADA: 'bg-emerald-500',
  PRODUCCION: 'bg-orange-500',
  TERMINADO: 'bg-brand-600',
  ENTREGADA: 'bg-emerald-600',
  RECHAZADA: 'bg-red-500',
  CANCELADA: 'bg-stone-600',
};

function FinishBadge({ finish }: { finish: Finish }) {
  const catalog = useAppStore((st) => st.catalog);
  const profile = profileOf(catalog, finish);
  const name = profile?.name ?? (finish === 'MADERADO' ? 'Maderado' : 'Blanco');
  const colored = finish !== 'BLANCO';
  return (
    <Badge
      className={
        colored
          ? 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100 font-medium'
          : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-100 font-medium'
      }
    >
      {name}
    </Badge>
  );
}

function MaquilaBadge() {
  return (
    <Badge className="bg-sky-100 text-sky-800 border border-sky-200 hover:bg-sky-100 font-medium">
      Maquila
    </Badge>
  );
}

export default function QuotesTab({ onNavigate }: TabProps) {
  const catalog = useAppStore((s) => s.catalog);
  const quotations = useAppStore((s) => s.quotations);
  const clients = useAppStore((s) => s.clients);
  const fetchClients = useAppStore((s) => s.fetchClients);
  const fetchQuotations = useAppStore((s) => s.fetchQuotations);
  const setEditingQuotation = useAppStore((st) => st.setEditingQuotation);
  const loading = useAppStore((s) => s.loadingQuotations);

  const [search, setSearch] = useState('');
  const [view, setView] = useState<'cotizaciones' | 'pedidos'>('cotizaciones');
  const [displayMode, setDisplayMode] = useState<'table' | 'kanban'>('table');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuotationDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [waQuotation, setWaQuotation] = useState<QuotationDTO | null>(null);

  const settings = settingsLike(catalog);
  const ivaPct = settings.ivaRate * 100;
  const pctLabel = (v: number) => `${v % 1 === 0 ? v : v.toFixed(1)}%`;

  /* Cocinas y maquilas conviven en el mismo flujo: la fila se identifica por su badge */
  const isPedido = (qt: QuotationDTO) => !!qt.orderCode;
  const cotizaciones = useMemo(() => quotations.filter((qt) => !isPedido(qt)), [quotations]);
  const pedidos = useMemo(() => quotations.filter(isPedido), [quotations]);
  const visible = view === 'cotizaciones' ? cotizaciones : pedidos;
  const allowedStatuses: QuotationStatus[] = view === 'cotizaciones' ? COTIZACION_STATUSES : PEDIDO_STATUSES;

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    return visible.filter((qt) => {
      if (statusFilter !== 'ALL' && qt.status !== statusFilter) return false;
      if (!q) return true;
      return norm(qt.folio).includes(q) || norm(qt.clientName).includes(q);
    });
  }, [visible, search, statusFilter]);

  /* Tablero único: todos los documentos, columnas de ciclo compartidas */
  const kanbanFiltered = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return quotations;
    return quotations.filter(
      (qt) =>
        norm(qt.folio).includes(q) ||
        norm(qt.clientName).includes(q) ||
        (qt.title && norm(qt.title).includes(q))
    );
  }, [quotations, search]);

  /* Cliente del CRM vinculado a la cotización seleccionada para WhatsApp */
  const waClient: ClientDTO | null = waQuotation
    ? (clients.find((c) => c.id === waQuotation.clientId) ?? null)
    : null;

  const detail = useMemo(
    () => quotations.find((qt) => qt.id === detailId) ?? null,
    [quotations, detailId]
  );

  /* Detalle completo con bitácora de revisiones */
  const [detailFull, setDetailFull] = useState<QuotationDTO | null>(null);
  useEffect(() => {
    setDetailFull(null);
    if (!detailId) return;
    let alive = true;
    void fetch(`/api/quotations/${detailId}`)
      .then((r) => r.json())
      .then((d: QuotationDTO) => {
        if (alive) setDetailFull(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [detailId, quotations]);
  const revisions = detailFull?.revisions ?? [];

  /* Desglose maquila para el diálogo de detalle */
  const maquilaSplit = useMemo(() => {
    if (!detail || detail.kind !== 'MAQUILA') return null;
    const sheets = detail.maquilaLines.reduce((a, l) => a + l.sheetsQty * l.unitSheetCost, 0);
    const cut = detail.cutQty * detail.cutUnitCost;
    return {
      sheets,
      bandMat: detail.materialsTotal - sheets,
      cut,
      edge: detail.servicesTotal - cut,
    };
  }, [detail]);

  async function updateStatus(qt: QuotationDTO, status: QuotationStatus) {
    if (qt.status === status) return;
    setUpdatingId(qt.id);
    try {
      const res = await fetch(`/api/quotations/${qt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      await fetchQuotations();
      toast.success(`${qt.folio} → ${STATUS_LABELS[status]}`);
    } catch {
      toast.error(`No se pudo actualizar el estado de ${qt.folio}`);
    } finally {
      setUpdatingId(null);
    }
  }

  /** Fecha estimada de entrega editada a mano desde el detalle (yyyy-MM-dd o vacío) */
  const [deliveryDraft, setDeliveryDraft] = useState('');
  useEffect(() => {
    const d = quotations.find((q) => q.id === detailId);
    setDeliveryDraft(d?.estimatedDeliveryAt ? d.estimatedDeliveryAt.slice(0, 10) : '');
  }, [detailId, quotations]);
  async function updateDelivery(dateStr: string) {
    if (!detail) return;
    const prev = detail.estimatedDeliveryAt ? detail.estimatedDeliveryAt.slice(0, 10) : '';
    setDeliveryDraft(dateStr);
    if (dateStr === prev) return;
    try {
      const res = await fetch(`/api/quotations/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedDeliveryAt: dateStr || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      await fetchQuotations();
      toast.success(dateStr ? `Entrega de ${detail.folio}: ${formatDate(dateStr)}` : `Entrega de ${detail.folio} sin fecha`);
    } catch {
      toast.error('No se pudo actualizar la fecha de entrega');
      setDeliveryDraft(prev);
    }
  }

  async function duplicate(qt: QuotationDTO) {
    setDuplicatingId(qt.id);
    try {
      const res = await fetch(`/api/quotations/${qt.id}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al duplicar');
      await fetchQuotations();
      toast.success(`Cotización ${data.folio} duplicada`);
    } catch {
      toast.error(`No se pudo duplicar ${qt.folio}`);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/quotations/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(`Cotización ${deleteTarget.folio} eliminada`);
      setDeleteTarget(null);
      await fetchQuotations();
    } catch {
      toast.error('No se pudo eliminar la cotización');
    } finally {
      setDeleting(false);
    }
  }

  async function generateOrder(qt: QuotationDTO) {
    setOrderingId(qt.id);
    try {
      // Si la cotización está en BORRADOR o ENVIADA, pasarla a ACEPTADA para cumplir la regla del backend
      if (qt.status === 'BORRADOR' || qt.status === 'ENVIADA') {
        const patchRes = await fetch(`/api/quotations/${qt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ACEPTADA' }),
        });
        if (!patchRes.ok) {
          toast.error('No se pudo actualizar el estado previo a pedido');
          return;
        }
      }

      const res = await fetch(`/api/quotations/${qt.id}/order`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error((data as { error?: string })?.error || 'No se pudo generar el pedido');
        return;
      }
      toast.success(`Pedido ${data.orderCode} generado para ${qt.folio}`);
      await fetchQuotations();
    } catch {
      toast.error('No se pudo generar el pedido');
    } finally {
      setOrderingId(null);
    }
  }

  function openPdf(id: string, prices: boolean) {
    window.open(`/api/quotations/${id}/pdf?prices=${prices ? 1 : 0}`, '_blank');
  }
  function openExcel(id: string) {
    window.open(`/api/quotations/${id}/excel`, '_blank');
  }

  /* ---------- Cargando ---------- */
  if (loading && quotations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" aria-hidden />
          <p className="text-sm">Cargando cotizaciones…</p>
        </CardContent>
      </Card>
    );
  }

  /* ---------- Vacío ---------- */
  if (quotations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
            <FileText className="w-8 h-8 text-stone-400" aria-hidden />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-stone-900">Aún no hay cotizaciones</h3>
            <p className="text-sm text-stone-500 max-w-sm">
              Cotiza una cocina armada en vivo: elige muebles del catálogo, ajusta acabado y
              cubierta, y guárdala. Las maquilas se crean en la pestaña Maquila.
            </p>
          </div>
          <Button
            onClick={() => onNavigate?.('cotizador')}
            className="bg-brand-600 hover:bg-brand-700 text-white"
          >
            <Calculator className="w-4 h-4" aria-hidden />
            Cotizar una cocina
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ================= Cabecera de vista: Documentos y Switch de Modo ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {displayMode === 'table' ? (
          <div role="tablist" aria-label="Tipo de documento" className="flex gap-1 rounded-lg bg-stone-100 p-1 w-fit">
            {([
              { id: 'cotizaciones', label: 'Cotizaciones', count: cotizaciones.length },
              { id: 'pedidos', label: 'Pedidos', count: pedidos.length },
            ] as const).map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={view === t.id}
                onClick={() => {
                  setView(t.id);
                  setStatusFilter('ALL');
                }}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                  view === t.id
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                    view === t.id ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-600'
                  )}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-stone-800 flex items-center gap-1.5">
              <Columns3 className="w-4 h-4 text-amber-600" />
              Tablero Integral de Cotizaciones y Pedidos
            </h2>
            <Badge variant="secondary" className="bg-stone-100 text-stone-600 text-xs">
              {quotations.length} documentos
            </Badge>
          </div>
        )}

        {/* Switch visual [ 📋 Tabla | 🗂️ Tablero ] */}
        <div className="flex gap-1 rounded-lg bg-stone-100 p-1 border border-stone-200">
          <button
            type="button"
            onClick={() => setDisplayMode('table')}
            aria-pressed={displayMode === 'table'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
              displayMode === 'table'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            )}
          >
            <LayoutList className="w-3.5 h-3.5" />
            Tabla
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('kanban')}
            aria-pressed={displayMode === 'kanban'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
              displayMode === 'kanban'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            )}
          >
            <Columns3 className="w-3.5 h-3.5" />
            Tablero
          </button>
        </div>
      </div>

      {/* ================= Toolbar ================= */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  displayMode === 'table'
                    ? 'Buscar por folio o cliente…'
                    : 'Buscar en el tablero por folio, cliente o título…'
                }
                aria-label="Buscar cotizaciones por folio o cliente"
                className="pl-8 h-9 bg-white border-stone-200"
              />
            </div>
            {displayMode === 'table' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  size="sm"
                  className="w-full sm:w-[190px] bg-white border-stone-200 h-9"
                  aria-label="Filtrar por estado"
                >
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  {allowedStatuses.map((st) => (
                    <SelectItem key={st} value={st}>
                      {STATUS_LABELS[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Badge
              variant="secondary"
              className="bg-stone-100 text-stone-600 border border-stone-200 justify-center sm:justify-start"
            >
              {displayMode === 'table'
                ? `${filtered.length} de ${visible.length} ${view === 'cotizaciones' ? 'cotizaciones' : 'pedidos'}`
                : `${kanbanFiltered.length} de ${quotations.length} documentos`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ================= Contenido: Tabla o Tablero Kanban ================= */}
      {displayMode === 'kanban' ? (
        <QuotesKanban
          quotations={kanbanFiltered}
          onOpenDetail={(qt) => setDetailId(qt.id)}
          onStatusChange={updateStatus}
          onConvertToOrder={generateOrder}
          onDuplicate={duplicate}
          onWhatsApp={(qt) => setWaQuotation(qt)}
          onEdit={(qt) => {
            setEditingQuotation(qt);
            onNavigate?.(qt.kind === 'MAQUILA' ? 'maquila' : 'cotizador');
          }}
        />
      ) : (
        <div className="max-h-[65vh] overflow-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <Table className="min-w-[1060px]">
          <TableHeader className="sticky top-0 z-10 bg-stone-100">
            <TableRow className="hover:bg-stone-100 border-b border-stone-200">
              <TableHead className="text-stone-600">Folio</TableHead>
              <TableHead className="text-stone-600">Fecha</TableHead>
              <TableHead className="text-stone-600">Cliente</TableHead>
              <TableHead className="text-stone-600">Tipo</TableHead>
              <TableHead className="text-stone-600">Estado</TableHead>
              <TableHead className="text-stone-600">Entrega est.</TableHead>
              <TableHead className="text-stone-600 text-center">Items</TableHead>
              <TableHead className="text-stone-600 text-right">Total con IVA</TableHead>
              <TableHead className="text-stone-600 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-stone-500">
                  {view === 'pedidos'
                    ? 'Aún no hay pedidos. Convierte una cotización aceptada con «Convertir en pedido».'
                    : 'Sin resultados para tu búsqueda.'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((qt) => {
              const units = qt.items.reduce((acc, it) => acc + it.qty, 0);
              const entrega = qt.estimatedDeliveryAt ? new Date(qt.estimatedDeliveryAt) : null;
              const entregaVencida =
                entrega &&
                entrega.getTime() < Date.now() &&
                !['ENTREGADA', 'CANCELADA'].includes(qt.status);
              return (
                <TableRow key={qt.id} className="border-b border-stone-100 hover:bg-stone-50/60">
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setDetailId(qt.id)}
                      className="font-bold text-amber-700 hover:text-amber-800 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                      aria-label={`Ver detalle de ${qt.folio}`}
                    >
                      {qt.folio}
                    </button>
                    {qt.orderCode && (
                      <span className="mt-0.5 block text-[10px] font-semibold text-emerald-700">
                        {qt.orderCode}
                      </span>
                    )}
                    {qt.title && (
                      <span className="block max-w-[140px] truncate text-[11px] font-normal text-stone-500" title={qt.title}>
                        {qt.title}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-stone-500 whitespace-nowrap">
                    {formatDate(qt.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <span className="block truncate font-medium" title={qt.clientName}>
                      {qt.clientName}
                    </span>
                  </TableCell>
                  <TableCell>
                    {qt.kind === 'MAQUILA' ? <MaquilaBadge /> : <FinishBadge finish={qt.finish} />}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={qt.status}
                      onValueChange={(v) => updateStatus(qt, v as QuotationStatus)}
                      disabled={updatingId === qt.id}
                    >
                      <SelectTrigger
                        size="sm"
                        className={cn(
                          'h-8 w-[150px] rounded-full text-xs bg-white border-stone-200 px-2.5',
                          updatingId === qt.id && 'opacity-60'
                        )}
                        aria-label={`Estado de ${qt.folio}`}
                      >
                        {updatingId === qt.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" aria-hidden />
                        ) : (
                          <span
                            className={cn('h-2 w-2 rounded-full shrink-0', STATUS_DOT[qt.status])}
                            aria-hidden
                          />
                        )}
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(isPedido(qt) ? PEDIDO_STATUSES : COTIZACION_STATUSES).map((st) => (
                          <SelectItem key={st} value={st}>
                            {STATUS_LABELS[st]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {entrega ? (
                      <span
                        className={cn(
                          'text-xs font-medium',
                          entregaVencida ? 'text-red-600' : 'text-stone-600'
                        )}
                        title={entregaVencida ? 'Fecha estimada vencida' : 'Fecha estimada de entrega'}
                      >
                        {formatDate(qt.estimatedDeliveryAt!)}
                        {entregaVencida && ' · vencida'}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {qt.kind === 'MAQUILA' ? (
                      <>
                        <span className="font-semibold">{qt.maquilaLines.length}</span>
                        <span className="text-stone-400 text-xs">
                          {' '}
                          · {qt.maquilaLines.reduce((a, l) => a + l.sheetsQty, 0)} tab
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">{qt.items.length}</span>
                        <span className="text-stone-400 text-xs"> · {units} u</span>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="block font-bold tabular-nums">{money(qt.totalWithIva)}</span>
                    {qt.applyDistributor && (
                      <span className="block text-[11px] text-emerald-600 tabular-nums">
                        Dist: {money(qt.distributorTotal)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-stone-500 hover:text-stone-900"
                          aria-label={`Acciones para ${qt.folio}`}
                        >
                          <MoreHorizontal className="w-4 h-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {qt.clientId && (
                          <DropdownMenuItem onSelect={() => setWaQuotation(qt)}>
                            <MessageCircle className="text-emerald-600" aria-hidden />
                            Enviar por WhatsApp
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => openPdf(qt.id, true)}>
                          <FileText className="text-amber-600" aria-hidden />
                          PDF con precios
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openPdf(qt.id, false)}>
                          <FileText className="text-stone-400" aria-hidden />
                          {qt.kind === 'MAQUILA' ? 'PDF hoja de corte (sin precios)' : 'PDF sin precios'}
                        </DropdownMenuItem>
                        {qt.kind !== 'MAQUILA' && (
                          <DropdownMenuItem onSelect={() => openExcel(qt.id)}>
                            <FileSpreadsheet className="text-emerald-600" aria-hidden />
                            Excel producción
                          </DropdownMenuItem>
                        )}
                        {['SOLICITUD', 'BORRADOR', 'ENVIADA', 'ACEPTADA', 'PRODUCCION', 'EN_CORTE', 'TERMINADO'].includes(qt.status) && (
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditingQuotation(qt);
                              onNavigate?.(qt.kind === 'MAQUILA' ? 'maquila' : 'cotizador');
                            }}
                          >
                            <Pencil className="text-stone-500" aria-hidden />
                            {qt.orderCode ? 'Editar (crea revisión)' : 'Editar'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {!qt.orderCode && (
                          <DropdownMenuItem onSelect={() => void generateOrder(qt)} disabled={orderingId === qt.id}>
                            {orderingId === qt.id ? (
                              <Loader2 className="animate-spin" aria-hidden />
                            ) : (
                              <PackageCheck aria-hidden />
                            )}
                            Convertir en pedido
                          </DropdownMenuItem>
                        )}
                        {qt.orderCode && (
                          <DropdownMenuItem disabled>
                            <PackageCheck className="text-emerald-600" aria-hidden />
                            Pedido {qt.orderCode}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => duplicate(qt)} disabled={duplicatingId === qt.id}>
                          {duplicatingId === qt.id ? (
                            <Loader2 className="animate-spin" aria-hidden />
                          ) : (
                            <Copy aria-hidden />
                          )}
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setDeleteTarget(qt)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 aria-hidden />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    )}

      {/* ================= Dialog de detalle ================= */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-xl font-bold text-stone-900">
                    {detail.folio}
                  </DialogTitle>
                  {detail.orderCode && (
                    <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      {detail.orderCode}
                    </span>
                  )}
                  {detail.kind === 'MAQUILA' ? <MaquilaBadge /> : <FinishBadge finish={detail.finish} />}
                  {detail.source === 'PORTAL' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                      <Inbox className="w-3 h-3" aria-hidden />
                      Portal
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 border border-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-700">
                    <span
                      className={cn('h-2 w-2 rounded-full', STATUS_DOT[detail.status])}
                      aria-hidden
                    />
                    {STATUS_LABELS[detail.status]}
                  </span>
                </div>
                <DialogDescription className="text-xs">
                  {detail.title && <span className="font-medium text-stone-700">{detail.title} · </span>}
                  {formatDate(detail.createdAt)} · Total con IVA{' '}
                  <span className="font-bold text-amber-700">{money(detail.totalWithIva)}</span>
                </DialogDescription>
              </DialogHeader>

              {/* Pre-cotización del portal con cortes estimados */}
              {detail.cutsEstimated && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  <TriangleAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" aria-hidden />
                  <p>
                    <strong>Pre-cotización con cortes estimados.</strong> Las pasadas de sierra se calcularon con el
                    promedio por hoja de Configuración. Abre el documento en el cotizador de maquila, captura las
                    pasadas reales y guarda antes de enviarla al cliente.
                  </p>
                </div>
              )}

              {/* Datos del cliente */}
              <div className="grid gap-2 sm:grid-cols-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-stone-400">Cliente</p>
                  <p className="font-medium">{detail.clientName}</p>
                </div>
                <div className="space-y-0.5 text-xs text-stone-600">
                  {detail.clientPhone && <p>Tel: {detail.clientPhone}</p>}
                  {detail.clientEmail && <p>Correo: {detail.clientEmail}</p>}
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-2">
                  <Label htmlFor="delivery-date" className="text-[11px] uppercase tracking-wide text-stone-400">
                    Entrega estimada
                  </Label>
                  <Input
                    id="delivery-date"
                    type="date"
                    value={deliveryDraft}
                    onChange={(e) => void updateDelivery(e.target.value)}
                    className="h-8 w-[170px] bg-white border-stone-200 text-xs"
                    aria-label="Fecha estimada de entrega"
                  />
                  <span className="text-[11px] text-stone-400">
                    {detail.kind === 'MAQUILA' ? 'default maquila' : 'default cocina'} · editable
                  </span>
                </div>
                {detail.notes && (
                  <p className="sm:col-span-2 text-xs text-stone-500 italic border-t border-stone-200 pt-2">
                    «{detail.notes}»
                  </p>
                )}
              </div>

              {/* Despiece del cliente (maquila) */}
              {detail.kind === 'MAQUILA' && !!detail.maquilaPieces?.length && (
                <div className="rounded-lg border border-stone-200 overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-stone-100">
                      <TableRow className="hover:bg-stone-100 border-b border-stone-200">
                        <TableHead className="text-stone-600 text-center w-12">Cant</TableHead>
                        <TableHead className="text-stone-600">Pieza</TableHead>
                        <TableHead className="text-stone-600 text-right">Medidas (mm)</TableHead>
                        <TableHead className="text-stone-600">Material</TableHead>
                        <TableHead className="text-stone-600 text-center">Veta</TableHead>
                        <TableHead className="text-stone-600">Cantos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.maquilaPieces.map((p) => {
                        const cantos = [
                          p.bandL1 && 'L1',
                          p.bandL2 && 'L2',
                          p.bandA1 && 'A1',
                          p.bandA2 && 'A2',
                        ].filter((x): x is string => !!x);
                        return (
                          <TableRow key={p.id} className="border-b border-stone-100">
                            <TableCell className="text-center tabular-nums font-medium">{p.qty}</TableCell>
                            <TableCell className="max-w-[200px]">
                              <span className="block truncate font-medium" title={p.name}>{p.name}</span>
                              {p.notes && <span className="block text-[11px] text-stone-500 italic">{p.notes}</span>}
                            </TableCell>
                            <TableCell className="text-right text-xs text-stone-600 whitespace-nowrap tabular-nums">
                              {num(p.length, 0)} × {num(p.width, 0)}
                            </TableCell>
                            <TableCell className="max-w-[170px]">
                              <span className="block truncate text-xs" title={p.material?.name}>
                                {p.material?.name ?? '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-xs text-stone-500">
                              {p.grain ? '≡' : '—'}
                            </TableCell>
                            <TableCell>
                              {cantos.length ? (
                                <span className="flex flex-wrap gap-1">
                                  {cantos.map((c) => (
                                    <span
                                      key={c}
                                      className="inline-flex items-center rounded bg-brand-50 border border-brand-200 px-1.5 py-px text-[10px] font-bold text-brand-700"
                                    >
                                      {c}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span className="text-xs text-stone-400">Sin cantos</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Bitácora de revisiones (solo pedidos) */}
              {detail.orderCode && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-stone-400">
                    Revisiones anteriores <span className="text-stone-400 normal-case">(actual: Rev. {detail.rev})</span>
                  </p>
                  {!detailFull && (
                    <p className="mt-1 text-xs text-stone-400">Cargando revisiones…</p>
                  )}
                  {detailFull && revisions.length === 0 && (
                    <p className="mt-1 text-xs text-stone-500">Sin cambios desde que se creó el pedido.</p>
                  )}
                  {revisions.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {revisions.map((r) => (
                        <li key={r.id} className="text-xs text-stone-600">
                          <details>
                            <summary className="cursor-pointer select-none">
                              <span className="font-semibold text-stone-800">Rev. {r.rev}</span>{' '}
                              · {formatDate(r.createdAt)} · {money(r.totalWithIva)}
                              {r.note && <span className="text-stone-500"> — {r.note}</span>}
                            </summary>
                            <ul className="mt-1 ml-4 border-l border-stone-200 pl-3 space-y-0.5">
                              {detail.kind === 'MAQUILA'
                                ? (
                                    JSON.parse(r.itemsJson) as {
                                      material: string;
                                      sheetsQty: number;
                                      edgeBandMl: number;
                                    }[]
                                  ).map((it, i) => (
                                    <li key={i}>
                                      {it.sheetsQty}× tablero {it.material} + {num(it.edgeBandMl)} m cintilla
                                    </li>
                                  ))
                                : (
                                    JSON.parse(r.itemsJson) as {
                                      code: string;
                                      name: string;
                                      qty: number;
                                      unitPrice: number;
                                    }[]
                                  ).map((it, i) => (
                                    <li key={i}>
                                      {it.qty}× {it.name} — {money(it.unitPrice)} c/u
                                    </li>
                                  ))}
                            </ul>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Items */}
              {detail.kind === 'MAQUILA' ? (
                <div className="space-y-1.5">
                  {detail.sheetsEstimated && (
                    <p className="text-[11px] text-amber-700">
                      Hojas estimadas desde el despiece — ajústalas a las reales del optimizador al editar (pestaña Maquila → Tableros).
                    </p>
                  )}
                  <div className="rounded-lg border border-stone-200 overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-stone-100">
                      <TableRow className="hover:bg-stone-100 border-b border-stone-200">
                        <TableHead className="text-stone-600">Material</TableHead>
                        <TableHead className="text-stone-600 text-center">Tableros</TableHead>
                        <TableHead className="text-stone-600 text-right">Costo hoja</TableHead>
                        <TableHead className="text-stone-600 text-right">Cintilla (m)</TableHead>
                        <TableHead className="text-stone-600 text-right">Cintilla/m</TableHead>
                        <TableHead className="text-stone-600 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.maquilaLines.map((ln) => (
                        <TableRow key={ln.id} className="border-b border-stone-100">
                          <TableCell className="font-medium max-w-[220px]">
                            <span className="block truncate" title={ln.material?.name}>
                              {ln.material?.name ?? '—'}
                            </span>
                            {ln.notes && (
                              <span className="block text-[11px] text-stone-500 italic">{ln.notes}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">{ln.sheetsQty}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(ln.unitSheetCost)}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(ln.edgeBandMl)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(ln.unitBandCostMl)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {money(ln.sheetsQty * ln.unitSheetCost + ln.edgeBandMl * ln.unitBandCostMl)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                </div>
              ) : (
              <div className="rounded-lg border border-stone-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-stone-100">
                    <TableRow className="hover:bg-stone-100 border-b border-stone-200">
                      <TableHead className="text-stone-600 w-12 text-center">Cant</TableHead>
                      <TableHead className="text-stone-600">Código</TableHead>
                      <TableHead className="text-stone-600">Mueble</TableHead>
                      <TableHead className="text-stone-600 text-right">Dimensiones</TableHead>
                      <TableHead className="text-stone-600 text-right">Precio unit.</TableHead>
                      <TableHead className="text-stone-600 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((it) => (
                      <TableRow key={it.id} className="border-b border-stone-100">
                        <TableCell className="text-center tabular-nums">{it.qty}</TableCell>
                        <TableCell className="font-mono text-[11px] text-stone-500 whitespace-nowrap">
                          {it.code}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <span className="block truncate" title={it.name}>
                            {it.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-stone-500 whitespace-nowrap">
                          {dims(it.width, it.height, it.depth)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(it.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {money(it.unitPrice * it.qty)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {detail.countertopMaterial && (
                      <TableRow className="border-b border-stone-100 bg-amber-50/50">
                        <TableCell className="text-center text-stone-400">—</TableCell>
                        <TableCell className="font-mono text-[11px] text-stone-500">
                          CUBIERTA
                        </TableCell>
                        <TableCell className="font-medium">
                          {detail.countertopMaterial.name}
                        </TableCell>
                        <TableCell className="text-right text-xs text-stone-500 whitespace-nowrap">
                          {num(detail.countertopMl)} m
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(
                            detail.countertopMl > 0
                              ? detail.countertopCost / detail.countertopMl
                              : (detail.countertopMaterial.costPerMl || 0)
                          )}
                          /ML
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {money(detail.countertopCost)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              )}

              {/* Totales */}
              {detail.kind === 'MAQUILA' && maquilaSplit ? (
                <div className="flex justify-end">
                  <div className="w-full sm:max-w-xs space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Tableros (al costo)</span>
                      <span className="tabular-nums">{money(maquilaSplit.sheets)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Cintilla (material)</span>
                      <span className="tabular-nums">{money(maquilaSplit.bandMat)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Corte ({detail.cutQty} pasadas)</span>
                      <span className="tabular-nums">{money(maquilaSplit.cut)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Encintado ({num(detail.edgeBandMl)} m)</span>
                      <span className="tabular-nums">{money(maquilaSplit.edge)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Subtotal</span>
                      <span className="tabular-nums">{money(detail.materialsTotal + detail.servicesTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">IVA ({pctLabel(ivaPct)})</span>
                      <span className="tabular-nums">{money(detail.ivaAmount)}</span>
                    </div>
                    <div className="flex justify-between items-baseline py-1">
                      <span className="text-sm font-bold text-stone-900">TOTAL (CON IVA)</span>
                      <span className="text-lg font-bold text-amber-700 tabular-nums">
                        {money(detail.totalWithIva)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
              <div className="flex justify-end">
                <div className="w-full sm:max-w-xs space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Venta de muebles</span>
                    <span className="tabular-nums">{money(detail.furnitureSale)}</span>
                  </div>
                  {detail.countertopMaterial && (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">
                        Cubierta ({detail.countertopMaterial.name})
                      </span>
                      <span className="tabular-nums">{money(detail.countertopSale)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Subtotal</span>
                    <span className="tabular-nums">
                      {money(detail.furnitureSale + detail.countertopSale)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">
                      IVA (
                      {pctLabel(
                        detail.furnitureSale + detail.countertopSale > 0
                          ? (detail.ivaAmount / (detail.furnitureSale + detail.countertopSale)) * 100
                          : ivaPct
                      )}
                      )
                    </span>
                    <span className="tabular-nums">{money(detail.ivaAmount)}</span>
                  </div>
                  <div className="flex justify-between items-baseline py-1">
                    <span className="text-sm font-bold text-stone-900">TOTAL (CON IVA)</span>
                    <span className="text-lg font-bold text-amber-700 tabular-nums">
                      {money(detail.totalWithIva)}
                    </span>
                  </div>

                  {detail.applyDistributor && (
                    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                        Precio distribuidor
                      </p>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">Venta distribuidor</span>
                        <span className="tabular-nums">{money(detail.distributorFurniture)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">Cubierta distribuidor</span>
                        <span className="tabular-nums">{money(detail.distributorCountertop)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">IVA</span>
                        <span className="tabular-nums">{money(detail.distributorIva)}</span>
                      </div>
                      <Separator className="bg-emerald-200" />
                      <div className="flex justify-between text-sm font-bold text-emerald-700">
                        <span>Total distribuidor</span>
                        <span className="tabular-nums">{money(detail.distributorTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Exports */}
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetailId(null)}
                  className="text-stone-500"
                >
                  Cerrar
                </Button>
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPdf(detail.id, true)}
                    className="border-stone-200"
                  >
                    <FileText className="w-4 h-4 text-amber-600" aria-hidden />
                    PDF con precios
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPdf(detail.id, false)}
                    className="border-stone-200"
                  >
                    <FileText className="w-4 h-4 text-stone-400" aria-hidden />
                    {detail.kind === 'MAQUILA' ? 'Hoja de corte (sin precios)' : 'PDF sin precios'}
                  </Button>
                  {detail.kind !== 'MAQUILA' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openExcel(detail.id)}
                      className="border-stone-200"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" aria-hidden />
                      Excel producción
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="border-stone-200"
                  >
                    <Printer className="w-4 h-4" aria-hidden />
                    Imprimir
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= Confirmar eliminación ================= */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar la cotización {deleteTarget?.folio}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente. Se eliminará la cotización de «{deleteTarget?.clientName}»
              con {deleteTarget?.items.length ?? 0}{' '}
              {(deleteTarget?.items.length ?? 0) === 1 ? 'línea' : 'líneas'} y no podrá recuperarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="border-stone-200">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Eliminando…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" aria-hidden />
                  Eliminar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Botón flotante de acceso rápido (visible con lista cargada) */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate?.('cotizador')}
          className="border-stone-200 text-stone-600"
        >
          <Calculator className="w-4 h-4 text-amber-600" aria-hidden />
          Cotizar una cocina
        </Button>
      </div>

      {/* WhatsApp con plantillas para cotizaciones vinculadas a un cliente del CRM */}
      {waQuotation && waClient && (
        <WhatsAppTemplateDialog
          open
          onOpenChange={(o) => !o && setWaQuotation(null)}
          client={waClient}
          quotations={quotations}
          initialTemplate="cotizacion"
          initialQuotationId={waQuotation.id}
          onLogged={(_it, _client) => {
            void fetchQuotations();
            void fetchClients();
          }}
        />
      )}
    </div>
  );
}
