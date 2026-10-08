'use client';

import { useMemo, useState } from 'react';
import type { Finish, QuotationDTO, QuotationStatus } from '@/lib/types';
import { useAppStore, profileOf } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { money, formatDate, num } from '@/lib/format';
import {
  Clock,
  Inbox,
  Send,
  CheckCircle2,
  Hammer,
  PackageCheck,
  Truck,
  Eye,
  MessageCircle,
  Copy,
  Pencil,
  FileText,
  Loader2,
  User,
  CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { waPhone } from '@/components/crm/whatsapp-template-dialog';

export interface QuotesKanbanProps {
  quotations: QuotationDTO[];
  onOpenDetail: (qt: QuotationDTO) => void;
  onStatusChange: (qt: QuotationDTO, newStatus: QuotationStatus) => Promise<void>;
  onConvertToOrder: (qt: QuotationDTO) => Promise<void>;
  onDuplicate: (qt: QuotationDTO) => Promise<void>;
  onWhatsApp: (qt: QuotationDTO) => void;
  onEdit: (qt: QuotationDTO) => void;
}

interface ColumnDef {
  status: QuotationStatus;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  border: string;
  headerBg: string;
  text: string;
  dot: string;
}

const LIFECYCLE_COLUMNS: ColumnDef[] = [
  {
    status: 'BORRADOR',
    label: 'Borrador',
    sublabel: 'En armado',
    icon: Clock,
    border: 'border-stone-300',
    headerBg: 'bg-stone-100',
    text: 'text-stone-700',
    dot: 'bg-stone-400',
  },
  {
    status: 'ENVIADA',
    label: 'Enviada',
    sublabel: 'En espera',
    icon: Send,
    border: 'border-amber-300',
    headerBg: 'bg-amber-50',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  {
    status: 'ACEPTADA',
    label: 'Aceptada',
    sublabel: 'Lista para taller',
    icon: CheckCircle2,
    border: 'border-emerald-300',
    headerBg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
  },
  {
    status: 'PRODUCCION',
    label: 'En Producción',
    sublabel: 'Taller: corte, canteado y armado',
    icon: Hammer,
    border: 'border-orange-300',
    headerBg: 'bg-orange-50',
    text: 'text-orange-800',
    dot: 'bg-orange-500',
  },
  {
    status: 'TERMINADO',
    label: 'Terminado',
    sublabel: 'Listo p/ entrega',
    icon: PackageCheck,
    border: 'border-sky-300',
    headerBg: 'bg-sky-50',
    text: 'text-sky-800',
    dot: 'bg-sky-600',
  },
  {
    status: 'ENTREGADA',
    label: 'Entregada',
    sublabel: 'Cerrada / Pagada',
    icon: Truck,
    border: 'border-teal-300',
    headerBg: 'bg-teal-50',
    text: 'text-teal-800',
    dot: 'bg-teal-600',
  },
];

/* Columna solo para solicitudes del portal (se muestra únicamente si hay) */
const SOLICITUD_COLUMN: ColumnDef = {
  status: 'SOLICITUD',
  label: 'Solicitudes',
  sublabel: 'Pre-cotización del portal',
  icon: Inbox,
  border: 'border-indigo-300',
  headerBg: 'bg-indigo-50',
  text: 'text-indigo-800',
  dot: 'bg-indigo-500',
};

function FinishPill({ finish }: { finish: Finish }) {
  const catalog = useAppStore((st) => st.catalog);
  const profile = profileOf(catalog, finish);
  const name = profile?.name ?? (finish === 'MADERADO' ? 'Maderado' : 'Blanco');
  const colored = finish !== 'BLANCO';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border truncate max-w-[120px]',
        colored
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-stone-50 text-stone-600 border-stone-200'
      )}
      title={`Acabado: ${name}`}
    >
      {name}
    </span>
  );
}

export default function QuotesKanban({
  quotations,
  onOpenDetail,
  onStatusChange,
  onConvertToOrder,
  onDuplicate,
  onWhatsApp,
  onEdit,
}: QuotesKanbanProps) {
  const [draggedQuoteId, setDraggedQuoteId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<QuotationStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const haySolicitudes = quotations.some((q) => q.status === 'SOLICITUD');
  const lifecycleColumns = [
    ...(haySolicitudes ? [SOLICITUD_COLUMN] : []),
    ...LIFECYCLE_COLUMNS,
  ];

  // Agrupar cotizaciones por estado del ciclo de vida
  const columns = useMemo(() => {
    const res: Record<string, QuotationDTO[]> = {
      SOLICITUD: [],
      BORRADOR: [],
      ENVIADA: [],
      ACEPTADA: [],
      PRODUCCION: [],
      TERMINADO: [],
      ENTREGADA: [],
      RECHAZADA: [],
      CANCELADA: [],
    };

    for (const q of quotations) {
      if (res[q.status]) {
        res[q.status].push(q);
      } else {
        res.BORRADOR.push(q);
      }
    }
    return res;
  }, [quotations]);

  // Manejar el soltado de una tarjeta en una columna
  async function handleDrop(targetStatus: QuotationStatus) {
    if (!draggedQuoteId) return;
    const qt = quotations.find((q) => q.id === draggedQuoteId);
    if (!qt || qt.status === targetStatus) {
      setDraggedQuoteId(null);
      setDragOverStatus(null);
      return;
    }

    setIsUpdating(true);
    try {
      if (targetStatus === 'PRODUCCION' && !qt.orderCode) {
        // Al soltar en En Producción sin código de pedido: convertir en pedido
        await onConvertToOrder(qt);
      } else {
        // Cambio ordinario de estado
        await onStatusChange(qt, targetStatus);
      }
    } finally {
      setIsUpdating(false);
      setDraggedQuoteId(null);
      setDragOverStatus(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra superior de ayuda e información */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-xl border border-stone-200 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-stone-700">Tablero de Cotizaciones & Pedidos:</span>
          <span className="text-stone-500">
            Cocinas y maquilas en un mismo flujo. Al soltar en <strong>En Producción</strong> se
            asigna código de pedido automáticamente.
          </span>
        </div>
        {isUpdating && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Actualizando...
          </div>
        )}
      </div>

      {/* Tablero Kanban con scroll horizontal suave */}
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 min-h-[68vh] items-start">
        {lifecycleColumns.map((col) => {
          const colQuotes = columns[col.status] ?? [];
          const Icon = col.icon;
          const totalVal = colQuotes.reduce((acc, q) => acc + q.totalWithIva, 0);
          const isOver = dragOverStatus === col.status;

          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverStatus !== col.status) setDragOverStatus(col.status);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverStatus === col.status) setDragOverStatus(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                void handleDrop(col.status);
              }}
              className={cn(
                'flex flex-col w-72 shrink-0 rounded-xl border bg-stone-50 transition-colors',
                col.border,
                isOver ? 'ring-2 ring-amber-500 bg-amber-50/40' : ''
              )}
            >
              {/* Encabezado de Columna */}
              <div className={cn('p-2.5 rounded-t-xl border-b flex items-center justify-between', col.headerBg)}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', col.dot)} />
                  <Icon className={cn('w-3.5 h-3.5 shrink-0', col.text)} />
                  <div className="flex flex-col min-w-0">
                    <span className={cn('font-bold text-xs truncate', col.text)}>
                      {col.label}
                    </span>
                    <span className="text-[10px] text-stone-500 truncate -mt-0.5">
                      {col.sublabel}
                    </span>
                  </div>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-white text-stone-700 ml-1">
                    {colQuotes.length}
                  </Badge>
                </div>
                {totalVal > 0 && (
                  <span className="text-[11px] font-semibold text-stone-600 tabular-nums">
                    {money(totalVal)}
                  </span>
                )}
              </div>

              {/* Lista de Tarjetas */}
              <div className="p-2 space-y-2 flex-1 min-h-[500px] max-h-[75vh] overflow-y-auto">
                {colQuotes.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center border border-dashed border-stone-200 rounded-lg text-center p-3 text-stone-400">
                    <p className="text-xs italic">Sin cotizaciones</p>
                    <p className="text-[10px] mt-0.5">Arrastra una aquí</p>
                  </div>
                ) : (
                  colQuotes.map((qt) => {
                    const units = qt.items.reduce((acc, it) => acc + it.qty, 0);
                    const sheets = qt.maquilaLines.reduce((acc, ln) => acc + ln.sheetsQty, 0);
                    const esMaquila = qt.kind === 'MAQUILA';
                    const canWhatsApp = waPhone(qt.clientPhone);
                    const entrega = qt.estimatedDeliveryAt ? new Date(qt.estimatedDeliveryAt) : null;
                    const atrasada =
                      entrega &&
                      entrega.getTime() < Date.now() &&
                      !['ENTREGADA', 'CANCELADA'].includes(qt.status);

                    return (
                      <div
                        key={qt.id}
                        draggable={!isUpdating}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', qt.id);
                          setDraggedQuoteId(qt.id);
                        }}
                        onDragEnd={() => {
                          setDraggedQuoteId(null);
                          setDragOverStatus(null);
                        }}
                        className={cn(
                          'p-3 bg-white rounded-lg border border-stone-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-amber-300 hover:shadow transition-all space-y-2 select-none',
                          draggedQuoteId === qt.id ? 'opacity-40 scale-95' : ''
                        )}
                      >
                        {/* Cabecera de la tarjeta: Folio y Código de pedido */}
                        <div className="flex items-start justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(qt)}
                            className="text-left font-bold text-xs text-amber-700 hover:text-amber-800 hover:underline truncate block flex-1"
                          >
                            {qt.folio}
                          </button>
                          <span className="text-[10px] text-stone-400 whitespace-nowrap">
                            {formatDate(qt.createdAt)}
                          </span>
                        </div>

                        {qt.orderCode && (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                              Pedido {qt.orderCode}
                            </span>
                            {qt.rev > 1 && (
                              <span className="text-[10px] font-semibold text-stone-500">
                                Rev. {qt.rev}
                              </span>
                            )}
                          </div>
                        )}

                        {qt.title && (
                          <p className="text-[11px] text-stone-600 font-medium truncate" title={qt.title}>
                            {qt.title}
                          </p>
                        )}

                        {/* Cliente y Acabado */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 text-stone-700 font-medium truncate">
                            <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span className="truncate" title={qt.clientName}>
                              {qt.clientName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 pt-0.5">
                            {esMaquila ? (
                              <>
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border bg-sky-50 text-sky-800 border-sky-200">
                                  Maquila
                                </span>
                                <span className="text-[11px] text-stone-500">
                                  {sheets} {sheets === 1 ? 'tablero' : 'tableros'} · {num(qt.edgeBandMl)} m cintilla
                                </span>
                              </>
                            ) : (
                              <>
                                <FinishPill finish={qt.finish} />
                                <span className="text-[11px] text-stone-500">
                                  {units} {units === 1 ? 'módulo' : 'módulos'}
                                </span>
                              </>
                            )}
                          </div>
                          {entrega && (
                            <div
                              className={cn(
                                'flex items-center gap-1 pt-0.5 text-[11px]',
                                atrasada ? 'font-semibold text-red-600' : 'text-stone-500'
                              )}
                              title={atrasada ? 'Fecha estimada de entrega vencida' : 'Fecha estimada de entrega'}
                            >
                              <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                              <span>
                                Entrega {formatDate(qt.estimatedDeliveryAt!)}
                                {atrasada && ' · vencida'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Total con IVA */}
                        <div className="pt-1 border-t border-stone-100 flex items-center justify-between">
                          <span className="text-[11px] text-stone-500">Total c/ IVA</span>
                          <span className="text-xs font-bold text-stone-900 tabular-nums">
                            {money(qt.totalWithIva)}
                            {qt.cutsEstimated && (
                              <span
                                className="ml-1 align-middle inline-flex items-center rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300"
                                title="Cortes estimados (Σ hojas × promedio); la tienda debe capturar las pasadas reales"
                              >
                                estimado
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Acciones Rápidas */}
                        <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                          <div className="flex items-center gap-1">
                            {canWhatsApp && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onWhatsApp(qt);
                                }}
                                title="Enviar mensaje de WhatsApp"
                                className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <a
                              href={`/api/quotations/${qt.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Ver PDF"
                              className="inline-flex items-center justify-center h-6 w-6 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </a>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDuplicate(qt);
                              }}
                              title="Duplicar cotización"
                              className="h-6 w-6 text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(qt);
                              }}
                              title="Editar cotización"
                              className="h-6 w-6 text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDetail(qt);
                            }}
                            title="Ver desglose completo"
                            className="h-6 w-6 text-stone-400 hover:text-stone-700"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
