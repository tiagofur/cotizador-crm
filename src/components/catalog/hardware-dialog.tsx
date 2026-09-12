'use client';

/* Dialog de creación/edición de herrajes */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { HardwareDTO } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

interface HardwareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Herraje en edición o null para nuevo */
  hardware: HardwareDTO | null;
}

interface HardwareForm {
  name: string;
  unit: string;
  unitCost: string;
  notes: string;
  active: boolean;
}

const BASE_UNITS = ['Pieza', 'Juego', 'Par', 'Metro'];

const EMPTY_FORM: HardwareForm = {
  name: '',
  unit: 'Pieza',
  unitCost: '',
  notes: '',
  active: true,
};

function fromHardware(h: HardwareDTO): HardwareForm {
  return {
    name: h.name,
    unit: h.unit || 'Pieza',
    unitCost: h.unitCost != null ? String(h.unitCost) : '',
    notes: h.notes ?? '',
    active: h.active,
  };
}

export default function HardwareDialog({ open, onOpenChange, hardware }: HardwareDialogProps) {
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);
  const [form, setForm] = useState<HardwareForm>(EMPTY_FORM);
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(hardware ? fromHardware(hardware) : EMPTY_FORM);
      setNameError(false);
      setSaving(false);
    }
  }, [open, hardware]);

  const set = <K extends keyof HardwareForm>(key: K, value: HardwareForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /* Si el herraje existente trae una unidad fuera del catálogo base (p. ej. datos
     heredados del Excel), se conserva como opción para no perder el valor. */
  const unitOptions = BASE_UNITS.includes(form.unit) ? BASE_UNITS : [...BASE_UNITS, form.unit];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError(true);
      toast.error('El nombre del herraje es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit.trim() || 'Pieza',
        unitCost: Number(form.unitCost) || 0,
        notes: form.notes.trim() || null,
        active: form.active,
      };
      const res = await fetch(hardware ? `/api/hardware/${hardware.id}` : '/api/hardware', {
        method: hardware ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body: { error?: string } | null = await res.json().catch(() => null);
        toast.error(body?.error || 'Error al guardar el herraje');
        return;
      }
      toast.success(hardware ? 'Herraje actualizado' : 'Herraje creado');
      onOpenChange(false);
      await fetchCatalog();
    } catch {
      toast.error('Error de conexión al guardar el herraje');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{hardware ? 'Editar herraje' : 'Nuevo herraje'}</DialogTitle>
          <DialogDescription>
            {hardware
              ? 'Actualiza los datos del herraje.'
              : 'Agrega un herraje al catálogo (bisagras, rieles, jaladeras, etc.).'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="hardware-name">
                Nombre <span className="text-red-600">*</span>
              </Label>
              <Input
                id="hardware-name"
                value={form.name}
                onChange={(e) => {
                  set('name', e.target.value);
                  if (nameError) setNameError(false);
                }}
                placeholder="Ej. Bisagra c/hidro Soft Close"
                aria-invalid={nameError}
                aria-describedby={nameError ? 'hardware-name-error' : undefined}
                required
              />
              {nameError && (
                <p id="hardware-name-error" className="text-xs text-red-600">
                  El nombre es obligatorio.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="hardware-unit">Unidad</Label>
                <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                  <SelectTrigger id="hardware-unit" className="w-full">
                    <SelectValue placeholder="Selecciona la unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="hardware-cost">Costo unitario (MXN)</Label>
                <Input
                  id="hardware-cost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => set('unitCost', e.target.value)}
                  placeholder="45.00"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-1.5">
            <Label htmlFor="hardware-notes">Notas</Label>
            <Textarea
              id="hardware-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Ej. Incluye tornillería de montaje"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="hardware-active">Activo</Label>
              <p className="text-xs text-stone-500">
                Los herrajes inactivos quedan como referencia y no se pueden asignar a nuevos muebles.
              </p>
            </div>
            <Switch id="hardware-active" checked={form.active} onCheckedChange={(v) => set('active', v)} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {hardware ? 'Guardar cambios' : 'Crear herraje'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
