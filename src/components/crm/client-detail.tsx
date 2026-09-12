'use client';

/* ============================================================
 * ClientDetail — Ficha del cliente con historial de comunicación
 * ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import {
  Phone,
  Mail,
  MapPin,
  Building2,
  MessageCircle,
  PhoneCall,
  Footprints,
  StickyNote,
  FileText,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Calculator,
  Trash2,
  CalendarClock,
  History,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ClientDTO, ClientStage, InteractionDTO } from '@/lib/types';
import {
  CLIENT_KIND_LABELS,
  CLIENT_STAGES,
  CLIENT_STAGE_LABELS,
  INTERACTION_TYPE_LABELS,
  type InteractionType,
} from '@/lib/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientDTO;
  onClientUpdated: (client: ClientDTO) => void;
  onLogInteraction: () => void;
  onEdit: () => void;
  onNewQuotation: () => void;
  /** Si existe, muestra el botón «WhatsApp» con plantillas */
  onWhatsApp?: () => void;
}

const TYPE_ICON: Record<InteractionType, React.ElementType> = {
  LLAMADA: PhoneCall,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  VISITA: Footprints,
  COTIZACION: FileText,
  NOTA: StickyNote,
};

const TYPE_STYLE: Record<InteractionType, string> = {
  LLAMADA: 'bg-stone-100 text-stone-600',
  WHATSAPP: 'bg-emerald-100 text-emerald-700',
  EMAIL: 'bg-orange-100 text-orange-700',
  VISITA: 'bg-amber-100 text-amber-700',
  COTIZACION: 'bg-amber-600/15 text-amber-800',
  NOTA: 'bg-stone-100 text-stone-500',
};

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
  if (!iso) return 'Sin contacto registrado';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000));
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

export default function ClientDetail({
  open,
  onOpenChange,
  client,
  onClientUpdated,
  onLogInteraction,
  onEdit,
  onNewQuotation,
  onWhatsApp,
}: Props) {
  const [history, setHistory] = useState<InteractionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<InteractionDTO | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/interactions`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Error al cargar el historial');
      setHistory(await res.json());
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  async function changeStage(stage: string) {
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al actualizar la etapa');
      onClientUpdated(data as ClientDTO);
      toast.success(`Etapa: ${CLIENT_STAGE_LABELS[stage as ClientStage]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar la etapa');
    }
  }

  async function deleteInteraction() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      const res = await fetch(`/api/interactions/${deleting.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || 'Error al eliminar');
      }
      setHistory((h) => h.filter((i) => i.id !== deleting.id));
      toast.success('Interacción eliminada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeletingBusy(false);
      setDeleting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-2 pr-6">
            <div className="min-w-0">
              <DialogTitle className="text-lg leading-tight">{client.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                <span>{CLIENT_KIND_LABELS[client.kind]}</span>
                {client.company && (
                  <span className="inline-flex items-center gap-1">
                    · <Building2 className="w-3 h-3" aria-hidden /> {client.company}
                  </span>
                )}
                {client.city && (
                  <span className="inline-flex items-center gap-1">
                    · <MapPin className="w-3 h-3" aria-hidden /> {client.city}
                  </span>
                )}
              </DialogDescription>
            </div>
            <Select value={client.stage} onValueChange={changeStage}>
              <SelectTrigger
                size="sm"
                className={cn('w-[150px] border', STAGE_BADGE[client.stage], 'bg-white')}
                aria-label="Cambiar etapa del cliente"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CLIENT_STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        {/* Datos de contacto */}
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {client.phone && (onWhatsApp ? (
            <button
              type="button"
              onClick={onWhatsApp}
              className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
              <span className="truncate">{client.phone}</span>
              <Send className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden />
            </button>
          ) : (
            <a
              href={`https://wa.me/52${client.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
              <span className="truncate">{client.phone}</span>
            </a>
          ))}
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 hover:border-amber-300 hover:bg-amber-50 transition-colors"
            >
              <Mail className="w-4 h-4 text-amber-600 shrink-0" aria-hidden />
              <span className="truncate">{client.email}</span>
            </a>
          )}
          {client.address && (
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 sm:col-span-2">
              <MapPin className="w-4 h-4 text-stone-400 shrink-0" aria-hidden />
              <span className="truncate text-stone-600">{client.address}</span>
            </div>
          )}
        </div>

        {client.discountPercent != null && (
          <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-800">
            Descuento propio: −{client.discountPercent}% (precio distribuidor)
          </p>
        )}
        {client.notes && (
          <p className="text-xs text-stone-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
            {client.notes}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
          <span className="inline-flex items-center gap-1">
            <History className="w-3.5 h-3.5" aria-hidden />
            Último contacto: <strong className="text-stone-700">{relativeDays(client.lastContactAt)}</strong>
          </span>
          {client.nextFollowUpAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" aria-hidden />
              Seguimiento: <strong className="text-stone-700">{formatDate(client.nextFollowUpAt)}</strong>
            </span>
          )}
          <span>
            {client.quotationsCount} cotización{client.quotationsCount === 1 ? '' : 'es'}
          </span>
        </div>

        <Separator />

        {/* Historial */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Historial de comunicación</h3>
          <Badge variant="secondary" className="bg-stone-100 text-stone-600 border border-stone-200">
            {history.length} registro{history.length === 1 ? '' : 's'}
          </Badge>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-stone-500">
              <Loader2 className="w-5 h-5 animate-spin text-amber-600" aria-hidden />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <History className="w-8 h-8 text-stone-300" aria-hidden />
              <p className="text-sm text-stone-500">
                Aún no hay interacciones registradas con este cliente.
              </p>
            </div>
          ) : (
            history.map((it) => {
              const Icon = TYPE_ICON[it.type] ?? StickyNote;
              return (
                <div
                  key={it.id}
                  className="group flex gap-3 rounded-lg border border-stone-200 bg-white p-3"
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
                      TYPE_STYLE[it.type] ?? 'bg-stone-100 text-stone-500'
                    )}
                  >
                    <Icon className="w-4 h-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">
                        {it.subject || INTERACTION_TYPE_LABELS[it.type]}
                      </p>
                      <span className="text-[11px] text-stone-400 shrink-0">
                        {formatDate(it.occurredAt)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5 whitespace-pre-wrap leading-relaxed">
                      {it.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleting(it)}
                    aria-label="Eliminar interacción"
                    title="Eliminar interacción"
                    className="self-start h-7 w-7 flex items-center justify-center rounded-md text-stone-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            onClick={onLogInteraction}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white"
          >
            <MessageSquarePlus className="w-4 h-4" aria-hidden />
            Registrar interacción
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="w-4 h-4" aria-hidden />
            Editar
          </Button>
          {onWhatsApp && client.phone && (
            <Button
              variant="outline"
              onClick={onWhatsApp}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              WhatsApp
            </Button>
          )}
          <Button variant="outline" onClick={onNewQuotation}>
            <Calculator className="w-4 h-4" aria-hidden />
            Cotizar
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta interacción?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará del historial del cliente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteInteraction();
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
