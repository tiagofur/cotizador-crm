'use client';

import { useMemo, useState } from 'react';
import type { ClientDTO, QuotationDTO } from '@/lib/types';
import { CLIENT_KIND_LABELS, CLIENT_STAGE_LABELS } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { money, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import {
  MessageCircle,
  PhoneCall,
  CalendarClock,
  ChevronRight,
  Calculator,
  Building2,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  CalendarPlus,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { followUpStatus } from '@/lib/crm';
import { waPhone } from './whatsapp-template-dialog';

export type TaskColumnId = 'overdue' | 'today' | 'upcoming' | 'unscheduled' | 'completed';

interface TasksKanbanProps {
  clients: ClientDTO[];
  quotations: QuotationDTO[];
  onOpenDetail: (client: ClientDTO) => void;
  onLogInteraction: (client: ClientDTO) => void;
  onWhatsApp: (client: ClientDTO) => void;
  onNewQuotation: (client: ClientDTO) => void;
  onRefresh: () => Promise<void>;
}

const COLUMNS: { id: TaskColumnId; label: string; icon: React.ElementType; color: string; headerBg: string; border: string }[] = [
  {
    id: 'overdue',
    label: 'Atrasados / Urgentes',
    icon: AlertTriangle,
    color: 'text-red-700',
    headerBg: 'bg-red-50',
    border: 'border-red-200',
  },
  {
    id: 'today',
    label: 'Para Hoy',
    icon: Clock,
    color: 'text-amber-800',
    headerBg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    id: 'upcoming',
    label: 'Próximos 7 días',
    icon: Calendar,
    color: 'text-blue-800',
    headerBg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    id: 'unscheduled',
    label: 'Sin Seguimiento Agendado',
    icon: HelpCircle,
    color: 'text-stone-700',
    headerBg: 'bg-stone-100',
    border: 'border-stone-200',
  },
  {
    id: 'completed',
    label: 'Al día / Contactados',
    icon: CheckCircle2,
    color: 'text-emerald-800',
    headerBg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
];

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000));
}

function relativeDays(iso: string | null): string {
  if (!iso) return 'Sin contacto';
  const d = daysSince(iso);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 30) return `Hace ${d}d`;
  const m = Math.floor(d / 30);
  return `Hace ${m} ${m === 1 ? 'mes' : 'meses'}`;
}

export default function TasksKanban({
  clients,
  quotations,
  onOpenDetail,
  onLogInteraction,
  onWhatsApp,
  onNewQuotation,
  onRefresh,
}: TasksKanbanProps) {
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskColumnId | null>(null);
  const [updating, setUpdating] = useState(false);

  // Clasificar clientes en las columnas
  const categorized = useMemo(() => {
    const res: Record<TaskColumnId, ClientDTO[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      unscheduled: [],
      completed: [],
    };

    const now = Date.now();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const in7Days = new Date(now + 7 * 24 * 3600 * 1000);

    for (const c of clients) {
      if (c.stage === 'PERDIDO') continue;

      const fu = followUpStatus(c);
      const dContact = daysSince(c.lastContactAt);

      if (fu === 'overdue') {
        res.overdue.push(c);
      } else if (fu === 'today') {
        res.today.push(c);
      } else if (c.nextFollowUpAt && new Date(c.nextFollowUpAt) <= in7Days) {
        res.upcoming.push(c);
      } else if (!c.nextFollowUpAt) {
        if (dContact > 21) {
          // Cliente activo sin seguimiento y sin contacto hace más de 21 días -> urgente
          res.overdue.push(c);
        } else {
          res.unscheduled.push(c);
        }
      } else {
        res.completed.push(c);
      }
    }

    // Ordenar urgentes primero
    res.overdue.sort((a, b) => {
      const ta = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : 0;
      const tb = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : 0;
      return ta - tb;
    });

    return res;
  }, [clients]);

  // Manejar soltar en una columna (reprogramar fecha rápida)
  async function handleDropOnColumn(clientId: string, col: TaskColumnId) {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    if (col === 'completed') {
      // Abre el registro de interacción directamente
      onLogInteraction(client);
      return;
    }

    let nextDate: Date | null = null;
    if (col === 'today') {
      nextDate = new Date();
      nextDate.setHours(12, 0, 0, 0);
    } else if (col === 'upcoming') {
      nextDate = new Date(Date.now() + 3 * 24 * 3600 * 1000);
      nextDate.setHours(10, 0, 0, 0);
    } else if (col === 'unscheduled') {
      nextDate = null;
    } else if (col === 'overdue') {
      // Reprogramar para hoy
      nextDate = new Date();
    }

    setUpdating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextFollowUpAt: nextDate ? nextDate.toISOString() : null }),
      });
      if (!res.ok) throw new Error();

      toast.success(
        nextDate
          ? `Seguimiento de ${client.name} agendado para ${formatDate(nextDate.toISOString())}`
          : `Seguimiento de ${client.name} limpiado`
      );
      await onRefresh();
    } catch {
      toast.error('No se pudo reprogramar el seguimiento');
    } finally {
      setUpdating(false);
      setDraggedClientId(null);
      setDragOverColumn(null);
    }
  }

  // Agendar rápidamente para +1 día o +3 días
  async function quickSchedule(client: ClientDTO, daysAhead: number) {
    const d = new Date(Date.now() + daysAhead * 24 * 3600 * 1000);
    d.setHours(11, 0, 0, 0);

    setUpdating(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextFollowUpAt: d.toISOString() }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Seguimiento de ${client.name} pospuesto +${daysAhead}d`);
      await onRefresh();
    } catch {
      toast.error('Error al posponer');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de ayuda */}
      <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-sm text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-stone-700">Mesa de Control de Seguimientos:</span>
          <span className="text-stone-500">
            Tus pendientes del día organizados por urgencia. Arrastra una tarjeta para reprogramarla o registrar llamada.
          </span>
        </div>
      </div>

      {/* Tablero Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 min-h-[68vh] items-start">
        {COLUMNS.map((col) => {
          const items = categorized[col.id];
          const Icon = col.icon;
          const isOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverColumn !== col.id) setDragOverColumn(col.id);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverColumn === col.id) setDragOverColumn(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const clientId = e.dataTransfer.getData('text/plain') || draggedClientId;
                if (clientId) {
                  void handleDropOnColumn(clientId, col.id);
                }
              }}
              className={cn(
                'flex flex-col w-72 shrink-0 rounded-xl border bg-stone-50 transition-colors',
                col.border,
                isOver ? 'ring-2 ring-amber-500 bg-amber-50/40' : ''
              )}
            >
              {/* Encabezado */}
              <div className={cn('p-2.5 rounded-t-xl border-b flex items-center justify-between', col.headerBg)}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={cn('w-4 h-4 shrink-0', col.color)} />
                  <span className={cn('font-bold text-xs truncate', col.color)}>{col.label}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-white text-stone-700">
                    {items.length}
                  </Badge>
                </div>
              </div>

              {/* Lista */}
              <div className="p-2 space-y-2 flex-1 min-h-[500px] max-h-[75vh] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center border border-dashed border-stone-200 rounded-lg text-center p-3 text-stone-400">
                    <p className="text-xs italic">Sin pendientes aquí</p>
                    <p className="text-[10px] mt-0.5">¡Estás al día!</p>
                  </div>
                ) : (
                  items.map((client) => {
                    const dContact = daysSince(client.lastContactAt);
                    const fu = followUpStatus(client);

                    return (
                      <div
                        key={client.id}
                        draggable={!updating}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', client.id);
                          setDraggedClientId(client.id);
                        }}
                        onDragEnd={() => {
                          setDraggedClientId(null);
                          setDragOverColumn(null);
                        }}
                        className={cn(
                          'p-3 bg-white rounded-lg border border-stone-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-amber-300 hover:shadow transition-all space-y-2 select-none',
                          draggedClientId === client.id ? 'opacity-40 scale-95' : ''
                        )}
                      >
                        {/* Cabecera */}
                        <div className="flex items-start justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(client)}
                            className="text-left font-bold text-xs text-stone-900 hover:text-amber-700 truncate block flex-1"
                          >
                            {client.name}
                          </button>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-stone-200 text-stone-600 shrink-0">
                            {CLIENT_STAGE_LABELS[client.stage]}
                          </Badge>
                        </div>

                        {/* Empresa / Tel */}
                        <div className="text-[11px] text-stone-500 space-y-0.5">
                          {client.company && (
                            <p className="flex items-center gap-1 truncate text-stone-600 font-medium">
                              <Building2 className="w-3 h-3 text-stone-400 shrink-0" />
                              {client.company}
                            </p>
                          )}
                          {client.phone && <p className="truncate">{client.phone}</p>}
                        </div>

                        {/* Último contacto e interacción */}
                        <div className="text-[10px] text-stone-500 bg-stone-50 p-1.5 rounded border border-stone-100 flex items-center justify-between">
                          <span>Último contacto:</span>
                          <span className={cn('font-semibold', dContact > 21 ? 'text-red-600' : 'text-stone-700')}>
                            {relativeDays(client.lastContactAt)}
                          </span>
                        </div>

                        {/* Fecha programada */}
                        <div className="flex items-center justify-between text-[10px] pt-1">
                          {client.nextFollowUpAt ? (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 font-semibold',
                                fu === 'overdue' ? 'text-red-600' : fu === 'today' ? 'text-amber-700' : 'text-blue-700'
                              )}
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                              {formatDate(client.nextFollowUpAt)}
                            </span>
                          ) : (
                            <span className="text-stone-400 italic">Sin fecha asignada</span>
                          )}

                          {/* Atajo posponer +1d / +3d */}
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void quickSchedule(client, 1)}
                              title="Posponer para mañana"
                              className="h-5 px-1 text-[10px] text-stone-500 hover:text-amber-700 hover:bg-amber-50"
                            >
                              +1d
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void quickSchedule(client, 3)}
                              title="Posponer +3 días"
                              className="h-5 px-1 text-[10px] text-stone-500 hover:text-amber-700 hover:bg-amber-50"
                            >
                              +3d
                            </Button>
                          </div>
                        </div>

                        {/* Botones de acción directa */}
                        <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-stone-100">
                          {waPhone(client.phone) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onWhatsApp(client)}
                              title="Enviar WhatsApp"
                              className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onLogInteraction(client)}
                            title="Registrar llamada / nota"
                            className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onNewQuotation(client)}
                            title="Nueva cotización"
                            className="h-6 w-6 text-stone-500 hover:text-stone-800"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onOpenDetail(client)}
                            title="Ficha completa"
                            className="h-6 w-6 text-stone-400 hover:text-stone-700"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
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
