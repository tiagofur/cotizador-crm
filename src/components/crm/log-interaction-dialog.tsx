'use client';

/* ============================================================
 * LogInteractionDialog — Registrar llamada, WhatsApp, correo,
 * visita o nota en el historial del cliente
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
  onLogged: (interaction: InteractionDTO, client: ClientDTO) => void;
}

interface FormState {
  type: string;
  subject: string;
  content: string;
  stage: string; // '' = dejar igual
  nextFollowUpAt: string; // yyyy-MM-dd o ''
}

export default function LogInteractionDialog({ open, onOpenChange, client, onLogged }: Props) {
  const [form, setForm] = useState<FormState>({
    type: 'WHATSAPP',
    subject: '',
    content: '',
    stage: '',
    nextFollowUpAt: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ type: 'WHATSAPP', subject: '', content: '', stage: '', nextFollowUpAt: '' });
    }
  }, [open, client.id]);

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.content.trim()) {
      toast.error('Describe lo que se habló o envió');
      return;
    }
    setSaving(true);
    try {
      const payload: InteractionInput = {
        type: form.type as InteractionInput['type'],
        subject: form.subject.trim() || null,
        content: form.content.trim(),
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
      onLogged(data.interaction as InteractionDTO, data.client as ClientDTO);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar la interacción');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar interacción</DialogTitle>
          <DialogDescription>
            Quedará en el historial de <span className="font-medium text-stone-700">{client.name}</span> y
            actualizará su último contacto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="li-type">Tipo</Label>
            <Select value={form.type} onValueChange={set('type')}>
              <SelectTrigger id="li-type" className="border-stone-300" aria-label="Tipo de interacción">
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
            <Label htmlFor="li-subject" className="text-xs text-stone-600">
              Asunto (opcional)
            </Label>
            <Input
              id="li-subject"
              value={form.subject}
              onChange={(e) => set('subject')(e.target.value)}
              placeholder="Ej. Envió catálogo y lista de precios"
              className="border-stone-300"
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
              className="border-stone-300 min-h-0"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="li-stage" className="text-xs text-stone-600">
                Cambiar etapa
              </Label>
              <Select value={form.stage} onValueChange={set('stage')}>
                <SelectTrigger id="li-stage" className="border-stone-300" aria-label="Cambiar etapa del cliente">
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
                className="border-stone-300"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.content.trim()}
            className="bg-brand-600 hover:bg-brand-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              'Registrar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
