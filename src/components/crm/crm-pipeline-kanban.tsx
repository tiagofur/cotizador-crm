'use client';

import { useMemo, useState } from 'react';
import type { ClientDTO, ClientStage, QuotationDTO } from '@/lib/types';
import {
  CLIENT_STAGES,
  CLIENT_STAGE_LABELS,
  CLIENT_KIND_LABELS,
} from '@/lib/types';
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
  User,
  Building2,
  FileText,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { followUpStatus } from '@/lib/crm';
import { waPhone } from './whatsapp-template-dialog';

interface CrmPipelineKanbanProps {
  clients: ClientDTO[];
  quotations: QuotationDTO[];
  onOpenDetail: (client: ClientDTO) => void;
  onLogInteraction: (client: ClientDTO) => void;
  onWhatsApp: (client: ClientDTO) => void;
  onNewQuotation: (client: ClientDTO) => void;
  onNewClient: () => void;
  onRefresh: () => Promise<void>;
}

const STAGE_COLORS: Record<ClientStage, { border: string; headerBg: string; text: string; dot: string }> = {
  NUEVO: { border: 'border-stone-200', headerBg: 'bg-stone-100', text: 'text-stone-700', dot: 'bg-stone-400' },
  PROSPECTANDO: { border: 'border-amber-300', headerBg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500' },
  CONTACTADO: { border: 'border-orange-300', headerBg: 'bg-orange-50', text: 'text-orange-800', dot: 'bg-orange-500' },
  COTIZADO: { border: 'border-blue-300', headerBg: 'bg-blue-50', text: 'text-blue-800', dot: 'bg-blue-500' },
  NEGOCIACION: { border: 'border-purple-300', headerBg: 'bg-purple-50', text: 'text-purple-800', dot: 'bg-purple-500' },
  GANADO: { border: 'border-emerald-300', headerBg: 'bg-emerald-50', text: 'text-emerald-800', dot: 'bg-emerald-600' },
  PERDIDO: { border: 'border-red-300', headerBg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500' },
};

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000));
}

function relativeContact(iso: string | null): string {
  if (!iso) return 'Sin contacto';
  const d = daysSince(iso);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 30) return `Hace ${d}d`;
  const m = Math.floor(d / 30);
  return `Hace ${m} ${m === 1 ? 'mes' : 'meses'}`;
}

export default function CrmPipelineKanban({
  clients,
  quotations,
  onOpenDetail,
  onLogInteraction,
  onWhatsApp,
  onNewQuotation,
  onNewClient,
  onRefresh,
}: CrmPipelineKanbanProps) {
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ClientStage | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Mapear monto total cotizado por cliente
  const clientQuoteTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of quotations) {
      if (q.clientId && q.status !== 'CANCELADA' && q.status !== 'RECHAZADA') {
        const current = map.get(q.clientId) ?? 0;
        map.set(q.clientId, current + q.totalWithIva);
      }
    }
    return map;
  }, [quotations]);

  // Agrupar clientes por etapa
  const columns = useMemo(() => {
    const res: Record<ClientStage, ClientDTO[]> = {
      NUEVO: [],
      PROSPECTANDO: [],
      CONTACTADO: [],
      COTIZADO: [],
      NEGOCIACION: [],
      GANADO: [],
      PERDIDO: [],
    };

    for (const c of clients) {
      if (res[c.stage]) {
        res[c.stage].push(c);
      } else {
        res.NUEVO.push(c);
      }
    }
    return res;
  }, [clients]);

  // Mover cliente a nueva etapa
  async function handleMoveStage(clientId: string, newStage: ClientStage) {
    const client = clients.find((c) => c.id === clientId);
    if (!client || client.stage === newStage) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error();

      toast.success(`${client.name} movido a ${CLIENT_STAGE_LABELS[newStage]}`);
      await onRefresh();
    } catch {
      toast.error(`No se pudo mover a ${client.name}`);
    } finally {
      setIsUpdating(false);
      setDraggedClientId(null);
      setDragOverStage(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra superior de información del pipeline */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-xl border border-stone-200 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-stone-700">Pipeline de Ventas:</span>
          <span className="text-stone-500">
            Arrastra las tarjetas para avanzar prospectos hacia el cierre de pedidos.
          </span>
        </div>
        <Button
          size="sm"
          onClick={onNewClient}
          className="bg-brand-600 hover:bg-brand-700 text-white h-7 text-xs gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo prospecto
        </Button>
      </div>

      {/* Tablero Kanban con scroll horizontal suave */}
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 min-h-[68vh] items-start">
        {CLIENT_STAGES.map((stage) => {
          const stageClients = columns[stage] ?? [];
          const color = STAGE_COLORS[stage];
          const totalVal = stageClients.reduce((acc, c) => acc + (clientQuoteTotals.get(c.id) ?? 0), 0);
          const isOver = dragOverStage === stage;

          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverStage !== stage) setDragOverStage(stage);
              }}
              onDragLeave={(e) => {
                // Verificar si salimos del contenedor real
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverStage === stage) setDragOverStage(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const clientId = e.dataTransfer.getData('text/plain') || draggedClientId;
                if (clientId) {
                  void handleMoveStage(clientId, stage);
                }
              }}
              className={cn(
                'flex flex-col w-72 shrink-0 rounded-xl border bg-stone-50 transition-colors',
                color.border,
                isOver ? 'ring-2 ring-amber-500 bg-amber-50/40' : ''
              )}
            >
              {/* Encabezado de Columna */}
              <div className={cn('p-2.5 rounded-t-xl border-b flex items-center justify-between', color.headerBg)}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', color.dot)} />
                  <span className={cn('font-bold text-xs truncate', color.text)}>
                    {CLIENT_STAGE_LABELS[stage]}
                  </span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-white text-stone-700">
                    {stageClients.length}
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
                {stageClients.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center border border-dashed border-stone-200 rounded-lg text-center p-3 text-stone-400">
                    <p className="text-xs italic">Sin clientes en esta etapa</p>
                    <p className="text-[10px] mt-0.5">Arrastra uno aquí</p>
                  </div>
                ) : (
                  stageClients.map((client) => {
                    const quoteTotal = clientQuoteTotals.get(client.id) ?? 0;
                    const fu = followUpStatus(client);
                    const dContact = daysSince(client.lastContactAt);

                    return (
                      <div
                        key={client.id}
                        draggable={!isUpdating}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', client.id);
                          setDraggedClientId(client.id);
                        }}
                        onDragEnd={() => {
                          setDraggedClientId(null);
                          setDragOverStage(null);
                        }}
                        className={cn(
                          'p-3 bg-white rounded-lg border border-stone-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-amber-300 hover:shadow transition-all space-y-2 select-none',
                          draggedClientId === client.id ? 'opacity-40 scale-95' : ''
                        )}
                      >
                        {/* Cabecera de la tarjeta */}
                        <div className="flex items-start justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(client)}
                            className="text-left font-bold text-xs text-stone-900 hover:text-amber-700 truncate block flex-1"
                          >
                            {client.name}
                          </button>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-stone-200 text-stone-500 shrink-0">
                            {CLIENT_KIND_LABELS[client.kind]}
                          </Badge>
                        </div>

                        {/* Empresa / Teléfono / Ciudad */}
                        <div className="space-y-0.5 text-[11px] text-stone-500">
                          {client.company && (
                            <p className="flex items-center gap-1 truncate text-stone-600 font-medium">
                              <Building2 className="w-3 h-3 text-stone-400 shrink-0" />
                              {client.company}
                            </p>
                          )}
                          {client.phone && (
                            <p className="truncate">{client.phone}</p>
                          )}
                        </div>

                        {/* Valor cotizado */}
                        {quoteTotal > 0 && (
                          <div className="flex items-center justify-between text-[11px] bg-stone-50 p-1.5 rounded border border-stone-100">
                            <span className="text-stone-500 flex items-center gap-1">
                              <FileText className="w-3 h-3 text-amber-600" /> Cotizado:
                            </span>
                            <span className="font-bold text-stone-900 tabular-nums">
                              {money(quoteTotal)}
                            </span>
                          </div>
                        )}

                        {/* Último contacto y Seguimiento */}
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-stone-100">
                          <span
                            className={cn(
                              'flex items-center gap-1',
                              dContact > 21 ? 'text-red-600 font-medium' : dContact > 7 ? 'text-amber-600' : 'text-stone-400'
                            )}
                            title={`Último contacto: ${client.lastContactAt ? formatDate(client.lastContactAt) : 'Nunca'}`}
                          >
                            <span
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                dContact > 21 ? 'bg-red-500' : dContact > 7 ? 'bg-amber-500' : 'bg-emerald-500'
                              )}
                            />
                            {relativeContact(client.lastContactAt)}
                          </span>

                          {client.nextFollowUpAt ? (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 font-semibold',
                                fu === 'overdue' ? 'text-red-600' : fu === 'today' ? 'text-amber-700' : 'text-stone-500'
                              )}
                            >
                              <CalendarClock className="w-3 h-3" />
                              {formatDate(client.nextFollowUpAt)}
                            </span>
                          ) : (
                            <span className="text-stone-300 italic">Sin fecha</span>
                          )}
                        </div>

                        {/* Botones de acción rápida */}
                        <div className="flex items-center justify-end gap-1 pt-1">
                          {waPhone(client.phone) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onWhatsApp(client);
                              }}
                              title="Enviar WhatsApp"
                              className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLogInteraction(client);
                            }}
                            title="Registrar llamada / nota"
                            className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNewQuotation(client);
                            }}
                            title="Nueva cotización"
                            className="h-6 w-6 text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDetail(client);
                            }}
                            title="Ver ficha completa"
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
