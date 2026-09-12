'use client';

/* ============================================================
 * WhatsAppTemplateDialog — Plantillas de WhatsApp con envío
 * y registro automático en el historial del cliente
 * ============================================================ */

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import type { ClientDTO, InteractionDTO, QuotationDTO } from '@/lib/types';
import { formatDate, money } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientDTO;
  quotations: QuotationDTO[];
  /** Se ejecuta tras registrar el envío en el historial */
  onLogged: (interaction: InteractionDTO, client: ClientDTO) => void;
  /** Plantilla preseleccionada al abrir (ej. «cotizacion» desde Cotizaciones) */
  initialTemplate?: TemplateId;
  /** Cotización preseleccionada (requiere initialTemplate='cotizacion') */
  initialQuotationId?: string;
}

type TemplateId = 'catalogo' | 'cotizacion' | 'seguimiento' | 'libre';

const TEMPLATES: { id: TemplateId; label: string; hint: string }[] = [
  { id: 'catalogo', label: 'Catálogo', hint: 'Comparte el enlace o archivo del catálogo' },
  { id: 'cotizacion', label: 'Cotización', hint: 'Envía el folio, detalle y total de una cotización' },
  { id: 'seguimiento', label: 'Seguimiento', hint: 'Retoma el contacto sin presionar' },
  { id: 'libre', label: 'Mensaje libre', hint: 'Escríbelo desde cero' },
];

/** Teléfono a formato internacional para wa.me (México por defecto) */
export function waPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('52')) return digits;
  return `52${digits}`;
}

function buildMessage(
  template: TemplateId,
  client: ClientDTO,
  quotation: QuotationDTO | null,
  settings: { companyName: string }
): string {
  const firstName = client.name.split(' ')[0];
  const company = settings.companyName || 'nosotros';

  if (template === 'catalogo') {
    return (
      `¡Hola, ${firstName}! 👋 Soy de *${company}*.\n\n` +
      `Te comparto nuestro catálogo de muebles con los acabados blanco y maderado. ` +
      `Cualquier duda o cotización, con gusto te apoyamos.\n\n` +
      `📎 [Adjunta aquí el PDF del catálogo]`
    );
  }

  if (template === 'cotizacion') {
    if (!quotation) return '';
    const lines = quotation.items
      .map((it) => `• ${it.qty} × ${it.name}`)
      .join('\n');
    const dist = quotation.applyDistributor
      ? `\n\n*Precio distribuidor:* ${money(quotation.distributorTotal)}`
      : '';
    return (
      `¡Hola, ${firstName}! 👋 Te comparto la cotización *${quotation.folio}*.\n\n` +
      `${lines}\n` +
      (quotation.countertopMaterialId
        ? `• Cubierta ${quotation.countertopMaterial?.name ?? ''}\n`
        : '') +
      `\n*Total (IVA incluido):* ${money(quotation.totalWithIva)}${dist}\n\n` +
      `📎 [Adjunta aquí el PDF de la cotización]\n\n` +
      `Quedo atento a cualquier ajuste. ¡Saludos!`
    );
  }

  if (template === 'seguimiento') {
    return (
      `¡Hola, ${firstName}! 👋 Soy de *${company}*.\n\n` +
      `Retomo tu contacto por si tienes algún proyecto de muebles en mente o quieres ` +
      `repasar alguna cotización. Estoy para servirte.\n\n¡Saludos!`
    );
  }

  return '';
}

export default function WhatsAppTemplateDialog({
  open,
  onOpenChange,
  client,
  quotations,
  onLogged,
  initialTemplate = 'catalogo',
  initialQuotationId,
}: Props) {
  const companyName = useAppStore((s) => s.catalog?.settings.companyName ?? 'Cotizador de Muebles');
  const [template, setTemplate] = useState<TemplateId>(initialTemplate);
  const [quotationId, setQuotationId] = useState<string>(initialQuotationId ?? 'none');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);

  const clientQuotations = useMemo(
    () =>
      quotations
        .filter((q) => q.clientId === client.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [quotations, client.id]
  );

  const quotation = quotationId !== 'none' ? (clientQuotations.find((q) => q.id === quotationId) ?? null) : null;

  /* Regenera el mensaje al cambiar plantilla / cotización, salvo edición manual */
  const autoMessage = useMemo(
    () => buildMessage(template, client, quotation, { companyName }),
    [template, client, quotation, companyName]
  );

  const effectiveMessage = touched ? message : autoMessage;

  function switchTemplate(t: string) {
    setTemplate(t as TemplateId);
    setTouched(false);
    if (t !== 'cotizacion') setQuotationId('none');
  }

  const phone = waPhone(client.phone);
  const canSend = !!phone && effectiveMessage.trim().length > 0;

  async function handleSend() {
    if (!canSend || sending) return;
    setSending(true);
    try {
      /* 1. Registrar en el historial (el API actualiza lastContactAt) */
      const res = await fetch(`/api/clients/${client.id}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'WHATSAPP',
          subject:
            template === 'cotizacion' && quotation
              ? `Envío de WhatsApp: ${quotation.folio}`
              : `Envío de WhatsApp: ${TEMPLATES.find((t) => t.id === template)?.label}`,
          content: effectiveMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al registrar el envío');

      /* 2. Abrir WhatsApp con el mensaje prellenado */
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(effectiveMessage.trim())}`;
      window.open(url, '_blank', 'noopener');

      toast.success('WhatsApp abierto y envío registrado en el historial');
      onLogged(data.interaction as InteractionDTO, data.client as ClientDTO);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar por WhatsApp');
    } finally {
      setSending(false);
    }
  }

  if (!client.phone) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>WhatsApp no disponible</DialogTitle>
            <DialogDescription>
              {client.name} no tiene teléfono registrado. Edita el cliente para agregarlo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" aria-hidden />
            Enviar por WhatsApp
          </DialogTitle>
          <DialogDescription>
            A <span className="font-medium text-stone-700">{client.name}</span> · {client.phone}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 py-1">
          <div className="grid gap-1.5">
            <Label className="text-xs text-stone-600">Plantilla</Label>
            <Select value={template} onValueChange={switchTemplate}>
              <SelectTrigger className="border-stone-300" aria-label="Elegir plantilla">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-stone-400">
              {TEMPLATES.find((t) => t.id === template)?.hint}
            </p>
          </div>

          {template === 'cotizacion' && (
            <div className="grid gap-1.5">
              <Label htmlFor="wa-quotation" className="text-xs text-stone-600">
                Cotización a enviar
              </Label>
              {clientQuotations.length === 0 ? (
                <p className="text-xs rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-3 py-2">
                  Este cliente aún no tiene cotizaciones vinculadas.
                </p>
              ) : (
                <Select value={quotationId} onValueChange={setQuotationId}>
                  <SelectTrigger id="wa-quotation" className="border-stone-300" aria-label="Elegir cotización">
                    <SelectValue placeholder="Elige una cotización" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientQuotations.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.folio} · {formatDate(q.createdAt)} · {money(q.totalWithIva)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="wa-message">Mensaje</Label>
              {touched && (
                <button
                  type="button"
                  onClick={() => setTouched(false)}
                  className="text-[11px] text-amber-700 hover:text-amber-800 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                >
                  Restaurar plantilla
                </button>
              )}
            </div>
            <Textarea
              id="wa-message"
              value={effectiveMessage}
              onChange={(e) => {
                setMessage(e.target.value);
                setTouched(true);
              }}
              rows={8}
              className={cn('border-stone-300 min-h-0 text-sm', template === 'cotizacion' && !quotation && 'opacity-60')}
              aria-label="Mensaje de WhatsApp"
            />
            <p className="text-[11px] text-stone-400">
              {template === 'cotizacion' && !quotation
                ? 'Elige una cotización para generar el mensaje.'
                : 'Puedes editar el mensaje antes de enviarlo.'}
            </p>
          </div>

          {template === 'cotizacion' && quotation && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <Badge variant="outline" className="bg-white font-mono">
                {quotation.folio}
              </Badge>
              <span className="text-xs text-stone-600">
                {quotation.items.length} {quotation.items.length === 1 ? 'partida' : 'partidas'} ·{' '}
                <strong>{money(quotation.totalWithIva)}</strong>
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || sending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Registrando…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" aria-hidden />
                Abrir WhatsApp y registrar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
