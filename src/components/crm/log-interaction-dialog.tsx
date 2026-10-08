'use client';

/* ============================================================
 * LogInteractionDialog — Registrar o editar llamada, WhatsApp,
 * correo, visita o nota en el historial del cliente
 * ============================================================ */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ClientDTO, InteractionDTO, InteractionInput } from '@/lib/types';
import { INTERACTION_TYPES, INTERACTION_TYPE_LABELS, CLIENT_STAGES, CLIENT_STAGE_LABELS } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientDTO;
  /** Solo modo registro: recibe la interacción y el cliente actualizados */
  onLogged?: (interaction: InteractionDTO, client: ClientDTO) => void;
  /** Si existe, el diálogo entra en modo edición de esa interacción */
  interaction?: InteractionDTO;
  /** Solo modo edición: recibe la interacción y el cliente actualizados */
  onSaved?: (interaction: InteractionDTO, client: ClientDTO) => void;
}

interface FormState {
  type: string;
  occurredAt: string; // yyyy-MM-dd
  subject: string;
  content: string;
  stage: string; // '' = dejar igual (solo al registrar)
  nextFollowUpAt: string; // yyyy-MM-dd o '' (solo al registrar)
}

/** yyyy-MM-dd según el huso horario local */
function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Hora local del día en formato HH:MM:SS */
function localTimeOfDay(d: Date): string {
  return d.toTimeString().slice(0, 8);
}

export default function LogInteractionDialog({
  open,
  onOpenChange,
  client,
  onLogged,
  interaction,
  onSaved,
}: Props) {
  const editing = !!interaction;
  const [form, setForm] = useState<FormState>({
    type: 'WHATSAPP',
    occurredAt: toDateInputValue(new Date()),
    subject: '',
    content: '',
    stage: '',
    nextFollowUpAt: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (interaction) {
        setForm({
          type: interaction.type,
          occurredAt: toDateInputValue(new Date(interaction.occurredAt)),
          subject: interaction.subject ?? '',
          content: interaction.content,
          stage: '',
          nextFollowUpAt: '',
        });
      } else {
        setForm({
          type: 'WHATSAPP',
          occurredAt: toDateInputValue(new Date()),
          subject: '',
          content: '',
          stage: '',
          nextFollowUpAt: '',
        });
      }
    }
  }, [open, client.id, interaction?.id]);

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.content.trim()) {
      toast.error('Describe lo que se habló o envió');
      return;
    }
    if (!form.occurredAt) {
      toast.error('La fecha de la interacción es obligatoria');
      return;
    }
    setSaving(true);
    try {
      if (interaction) {
        // Editar: conserva la hora original del registro y actualiza solo la fecha
        const res = await fetch(`/api/interactions/${interaction.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: form.type,
            subject: form.subject.trim() || null,
            content: form.content.trim(),
            occurredAt: `${form.occurredAt}T${localTimeOfDay(new Date(interaction.occurredAt))}`,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Error al actualizar la interacción');
        toast.success('Interacción actualizada');
        onSaved?.(data.interaction as InteractionDTO, data.client as ClientDTO);
        onOpenChange(false);
      } else {
        const payload: InteractionInput = {
          type: form.type as InteractionInput['type'],
          subject: form.subject.trim() || null,
          content: form.content.trim(),
          // yyyy-MM-dd + hora local actual; evita que Date() interprete la fecha como UTC (día anterior)
          occurredAt: form.occurredAt ? `${form.occurredAt}T${localTimeOfDay(new Date())}` : undefined,
          stage: form.stage ? (form.stage as InteractionInput['stage']) : undefined,
          nextFollowUpAt: form.nextFollowUpAt || null,
        };
        const res = await fetch(`/api/clients/${client.id}/interactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Error al registrar la interacción');
        toast.success('Interacción registrada');
        onLogged?.(data.interaction as InteractionDTO, data.client as ClientDTO);
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la interacción');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar interacción' : 'Registrar interacción'}</DialogTitle>
          <DialogDescription>
            {editing ? (
              <>
                Los cambios se guardarán en el historial de{' '}
                <span className="font-medium text-stone-700">{client.name}</span>.
              </>
            ) : (
              <>
                Quedará en el historial de <span className="font-medium text-stone-700">{client.name}</span> y
                actualizará su último contacto.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="li-type">Tipo</Label>
            <Select value={form.type} onValueChange={set('type')}>
              <SelectTrigger id="li-type" className="border-stone-200" aria-label="Tipo de interacción">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.filter((t) => t !== 'COTIZACION').map((t) => (
                  <SelectItem key={t} value={t}>
                    {INTERACTION_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="li-date">
              Fecha de la interacción <span className="text-red-600" aria-hidden>*</span>
            </Label>
            <Input
              id="li-date"
              type="date"
              required
              aria-required="true"
              value={form.occurredAt}
              onChange={(e) => set('occurredAt')(e.target.value)}
              className="border-stone-200"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="li-subject" className="text-xs text-stone-600">
              Asunto (opcional)
            </Label>
            <Input
              id="li-subject"
              value={form.subject}
              onChange={(e) => set('subject')(e.target.value)}
              placeholder="Ej. Envió catálogo y lista de precios"
              className="border-stone-200"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="li-content">
              Descripción <span className="text-red-600" aria-hidden>*</span>
            </Label>
            <Textarea
              id="li-content"
              value={form.content}
              onChange={(e) => set('content')(e.target.value)}
              placeholder="Qué se envió o habló, respuesta del cliente, acuerdos…"
              rows={3}
              className="border-stone-200 min-h-0"
              autoFocus
            />
          </div>

          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="li-stage" className="text-xs text-stone-600">
                  Cambiar etapa
                </Label>
                <Select value={form.stage} onValueChange={set('stage')}>
                  <SelectTrigger id="li-stage" className="border-stone-200" aria-label="Cambiar etapa del cliente">
                    <SelectValue placeholder="Sin cambio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cambio</SelectItem>
                    {CLIENT_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CLIENT_STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="li-followup" className="text-xs text-stone-600">
                  Próximo seguimiento
                </Label>
                <Input
                  id="li-followup"
                  type="date"
                  value={form.nextFollowUpAt}
                  onChange={(e) => set('nextFollowUpAt')(e.target.value)}
                  className="border-stone-200"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.content.trim() || !form.occurredAt}
            className="bg-brand-600 hover:bg-brand-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : editing ? (
              'Guardar cambios'
            ) : (
              'Registrar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
