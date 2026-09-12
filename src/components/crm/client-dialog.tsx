'use client';

/* ============================================================
 * ClientDialog — Crear / editar cliente del CRM
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
import type { ClientDTO, ClientInput } from '@/lib/types';
import { CLIENT_KINDS, CLIENT_KIND_LABELS, CLIENT_STAGES, CLIENT_STAGE_LABELS } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientDTO | null; // null = crear
  onSaved: (client: ClientDTO) => void;
}

interface FormState {
  name: string;
  kind: string;
  stage: string;
  company: string;
  phone: string;
  email: string;
  discountPercent: string;
  city: string;
  address: string;
  notes: string;
  nextFollowUpAt: string; // yyyy-MM-dd o ''
}

const emptyForm: FormState = {
  name: '',
  kind: 'PROSPECTO',
  stage: 'NUEVO',
  company: '',
  phone: '',
  email: '',
  discountPercent: '',
  city: '',
  address: '',
  notes: '',
  nextFollowUpAt: '',
};

function toForm(c: ClientDTO): FormState {
  return {
    name: c.name,
    kind: c.kind,
    stage: c.stage,
    company: c.company ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    discountPercent: c.discountPercent != null ? String(c.discountPercent) : '',
    city: c.city ?? '',
    address: c.address ?? '',
    notes: c.notes ?? '',
    nextFollowUpAt: c.nextFollowUpAt ? c.nextFollowUpAt.slice(0, 10) : '',
  };
}

export default function ClientDialog({ open, onOpenChange, client, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const isEdit = !!client;

  useEffect(() => {
    if (open) setForm(client ? toForm(client) : emptyForm);
  }, [open, client]);

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload: ClientInput = {
        name: form.name.trim(),
        kind: form.kind as ClientInput['kind'],
        stage: form.stage as ClientInput['stage'],
        company: form.company.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        discountPercent:
          form.discountPercent.trim() === ''
            ? null
            : Math.max(0, Math.min(100, Number(form.discountPercent.replace(',', '.')) || 0)),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        notes: form.notes.trim() || null,
        nextFollowUpAt: form.nextFollowUpAt || null,
      };
      const res = await fetch(isEdit ? `/api/clients/${client!.id}` : '/api/clients', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al guardar el cliente');
      toast.success(isEdit ? 'Cliente actualizado' : `Cliente «${data.name}» registrado`);
      onSaved(data as ClientDTO);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar el cliente');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza los datos de contacto y seguimiento.'
              : 'Registra un prospecto o cliente para dar seguimiento a la comunicación.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="cl-name">
              Nombre / razón social <span className="text-red-600" aria-hidden>*</span>
            </Label>
            <Input
              id="cl-name"
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
              placeholder="Ej. Mueblería La Unión o Juan Pérez"
              className="border-stone-300"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cl-kind" className="text-xs text-stone-600">
                Tipo
              </Label>
              <Select value={form.kind} onValueChange={set('kind')}>
                <SelectTrigger id="cl-kind" className="border-stone-300" aria-label="Tipo de cliente">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {CLIENT_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cl-stage" className="text-xs text-stone-600">
                Etapa
              </Label>
              <Select value={form.stage} onValueChange={set('stage')}>
                <SelectTrigger id="cl-stage" className="border-stone-300" aria-label="Etapa del cliente">
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cl-phone" className="text-xs text-stone-600">
                Teléfono / WhatsApp
              </Label>
              <Input
                id="cl-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone')(e.target.value)}
                placeholder="55 1234 5678"
                className="border-stone-300"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cl-email" className="text-xs text-stone-600">
                Correo
              </Label>
              <Input
                id="cl-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email')(e.target.value)}
                placeholder="cliente@correo.com"
                className="border-stone-300"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cl-discount" className="text-xs text-stone-600">
                Descuento % (opcional)
              </Label>
              <Input
                id="cl-discount"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="1"
                value={form.discountPercent}
                onChange={(e) => set('discountPercent')(e.target.value)}
                placeholder="Ej. 40 — vacío usa el base"
                className="border-stone-300"
              />
              <p className="text-[11px] text-stone-500">
                Se aplica como precio distribuidor al cotizar. Si lo dejas vacío se usa el descuento base de
                Configuración.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cl-company" className="text-xs text-stone-600">
                Empresa (opcional)
              </Label>
              <Input
                id="cl-company"
                value={form.company}
                onChange={(e) => set('company')(e.target.value)}
                placeholder="Taller o negocio"
                className="border-stone-300"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cl-city" className="text-xs text-stone-600">
                Ciudad (opcional)
              </Label>
              <Input
                id="cl-city"
                value={form.city}
                onChange={(e) => set('city')(e.target.value)}
                placeholder="Ej. Guadalajara"
                className="border-stone-300"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cl-address" className="text-xs text-stone-600">
              Dirección (opcional)
            </Label>
            <Input
              id="cl-address"
              value={form.address}
              onChange={(e) => set('address')(e.target.value)}
              placeholder="Calle, número, colonia"
              className="border-stone-300"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cl-followup" className="text-xs text-stone-600">
              Próximo seguimiento (opcional)
            </Label>
            <Input
              id="cl-followup"
              type="date"
              value={form.nextFollowUpAt}
              onChange={(e) => set('nextFollowUpAt')(e.target.value)}
              className="border-stone-300"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cl-notes" className="text-xs text-stone-600">
              Notas
            </Label>
            <Textarea
              id="cl-notes"
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              placeholder="Preferencias, qué interesa, cómo llegó…"
              rows={2}
              className="border-stone-300 min-h-0"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="bg-brand-600 hover:bg-brand-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : isEdit ? (
              'Guardar cambios'
            ) : (
              'Registrar cliente'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
