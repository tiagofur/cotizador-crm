'use client';

/* Dialog de creación/edición de materiales (tableros y cubiertas) */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, TriangleAlert } from 'lucide-react';
import type { MaterialDTO } from '@/lib/types';
import { useAppStore, sheetCostPerM2 } from '@/lib/store';
import { money, num2 } from '@/lib/format';
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

interface MaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Material en edición o null para nuevo */
  material: MaterialDTO | null;
  /** true si el material ya está usado en piezas (no se puede cambiar el tipo) */
  typeLocked: boolean;
}

interface MaterialForm {
  name: string;
  type: 'TABLERO' | 'CUBIERTA';
  costPerM2: string;
  costPerMl: string;
  edgeBandCostMl: string;
  edgeBandName: string;
  sheetWidth: string;
  sheetLength: string;
  sheetCost: string;
  thickness: string;
  notes: string;
  isMaderado: boolean;
  active: boolean;
}

const EMPTY_FORM: MaterialForm = {
  name: '',
  type: 'TABLERO',
  costPerM2: '',
  costPerMl: '',
  edgeBandCostMl: '',
  edgeBandName: '',
  sheetWidth: '',
  sheetLength: '',
  sheetCost: '',
  thickness: '',
  notes: '',
  isMaderado: false,
  active: true,
};

function fromMaterial(m: MaterialDTO): MaterialForm {
  return {
    name: m.name,
    type: m.type === 'CUBIERTA' ? 'CUBIERTA' : 'TABLERO',
    costPerM2: m.costPerM2 != null ? String(m.costPerM2) : '',
    costPerMl: m.costPerMl != null ? String(m.costPerMl) : '',
    edgeBandCostMl: m.edgeBandCostMl != null ? String(m.edgeBandCostMl) : '',
    edgeBandName: m.edgeBandName ?? '',
    sheetWidth: m.sheetWidth != null ? String(m.sheetWidth) : '',
    sheetLength: m.sheetLength != null ? String(m.sheetLength) : '',
    sheetCost: m.sheetCost != null ? String(m.sheetCost) : '',
    thickness: m.thickness ?? '',
    notes: m.notes ?? '',
    isMaderado: m.isMaderado,
    active: m.active,
  };
}

function orNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function MaterialDialog({ open, onOpenChange, material, typeLocked }: MaterialDialogProps) {
  const catalog = useAppStore((st) => st.catalog);
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);
  const [form, setForm] = useState<MaterialForm>(EMPTY_FORM);
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(material ? fromMaterial(material) : EMPTY_FORM);
      setNameError(false);
      setSaving(false);
    }
  }, [open, material]);

  const set = <K extends keyof MaterialForm>(key: K, value: MaterialForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const computed = useMemo(() => {
    const sc = Number(String(form.sheetCost).replace(',', '.'));
    const w = Number(String(form.sheetWidth).replace(',', '.'));
    const l = Number(String(form.sheetLength).replace(',', '.'));
    if (!Number.isFinite(sc) || sc <= 0 || !Number.isFinite(w) || w <= 0 || !Number.isFinite(l) || l <= 0) return null;
    return sheetCostPerM2(
      { sheetCost: sc, sheetWidth: w, sheetLength: l, isMaderado: form.isMaderado },
      catalog
    );
  }, [form.sheetCost, form.sheetWidth, form.sheetLength, form.isMaderado, catalog]);

  // Automático: si hay datos de hoja, el costo/m² se llena solo (sin paso manual)
  useEffect(() => {
    if (!computed) return;
    setForm((f) => {
      const v = String(Math.round(computed.cost * 100) / 100);
      return f.costPerM2 === v ? f : { ...f, costPerM2: v };
    });
  }, [computed]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError(true);
      toast.error('El nombre del material es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        costPerM2: form.type === 'TABLERO' ? orNull(form.costPerM2) : null,
        costPerMl: form.type === 'CUBIERTA' ? orNull(form.costPerMl) : null,
        edgeBandCostMl: form.type === 'TABLERO' ? orNull(form.edgeBandCostMl) : null,
        edgeBandName: form.type === 'TABLERO' ? form.edgeBandName.trim() || null : null,
        sheetWidth: form.type === 'TABLERO' ? orNull(form.sheetWidth) : null,
        sheetLength: form.type === 'TABLERO' ? orNull(form.sheetLength) : null,
        sheetCost: form.type === 'TABLERO' ? orNull(form.sheetCost) : null,
        thickness: form.type === 'TABLERO' ? form.thickness.trim() || null : null,
        notes: form.notes.trim() || null,
        isMaderado: form.isMaderado,
        active: form.active,
      };
      const res = await fetch(material ? `/api/materials/${material.id}` : '/api/materials', {
        method: material ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body: { error?: string } | null = await res.json().catch(() => null);
        toast.error(body?.error || 'Error al guardar el material');
        return;
      }
      toast.success(material ? 'Material actualizado' : 'Material creado');
      onOpenChange(false);
      await fetchCatalog();
    } catch {
      toast.error('Error de conexión al guardar el material');
    } finally {
      setSaving(false);
    }
  }

  const isTablero = form.type === 'TABLERO';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{material ? 'Editar material' : 'Nuevo material'}</DialogTitle>
          <DialogDescription>
            {material
              ? 'Actualiza los datos del tablero o cubierta.'
              : 'Agrega un tablero o cubierta al catálogo.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="material-name">
                Nombre <span className="text-red-600">*</span>
              </Label>
              <Input
                id="material-name"
                value={form.name}
                onChange={(e) => {
                  set('name', e.target.value);
                  if (nameError) setNameError(false);
                }}
                placeholder="Ej. ARAUCO BLANCO"
                aria-invalid={nameError}
                aria-describedby={nameError ? 'material-name-error' : undefined}
                required
              />
              {nameError && (
                <p id="material-name-error" className="text-xs text-red-600">
                  El nombre es obligatorio.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="material-type">Tipo de material</Label>
              <Select
                value={form.type}
                onValueChange={(v) => set('type', v === 'CUBIERTA' ? 'CUBIERTA' : 'TABLERO')}
                disabled={material != null && typeLocked}
              >
                <SelectTrigger id="material-type" className="w-full">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TABLERO">Tablero</SelectItem>
                  <SelectItem value="CUBIERTA">Cubierta</SelectItem>
                </SelectContent>
              </Select>
              {material != null && typeLocked && (
                <p className="flex items-start gap-1 text-xs text-amber-700">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Este material ya está usado en piezas del despiece; el tipo no se puede cambiar.
                </p>
              )}
            </div>
          </div>

          {isTablero ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="material-cost-m2">Costo por m² (MXN)</Label>
                <Input
                  id="material-cost-m2"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.costPerM2}
                  onChange={(e) => set('costPerM2', e.target.value)}
                  placeholder="239.84"
                  disabled={!!computed}
                  title={computed ? 'Calculado automáticamente desde el costo de hoja × merma' : undefined}
                />
                <p className="text-[11px] text-stone-500">
                  {computed
                    ? 'Calculado desde la hoja (edita el costo de hoja para cambiarlo)'
                    : 'Captura la hoja para calcularlo automáticamente, o escríbelo a mano'}
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="material-thickness">Espesor</Label>
                <Input
                  id="material-thickness"
                  value={form.thickness}
                  onChange={(e) => set('thickness', e.target.value)}
                  placeholder="Ej. 18 mm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="material-edge-cost">Cintilla — costo por ML (MXN)</Label>
                <Input
                  id="material-edge-band-cost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.edgeBandCostMl}
                  onChange={(e) => set('edgeBandCostMl', e.target.value)}
                  placeholder="6.00"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="material-edge-name">Cintilla — nombre</Label>
                <Input
                  id="material-edge-band-name"
                  value={form.edgeBandName}
                  onChange={(e) => set('edgeBandName', e.target.value)}
                  placeholder="Ej. Canto PVC 1mm Blanco"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="material-sheet-w">Ancho de hoja (mm)</Label>
                <Input
                  id="material-sheet-width"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={form.sheetWidth}
                  onChange={(e) => set('sheetWidth', e.target.value)}
                  placeholder="2500"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="material-sheet-l">Largo de hoja (mm)</Label>
                <Input
                  id="material-sheet-length"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={form.sheetLength}
                  onChange={(e) => set('sheetLength', e.target.value)}
                  placeholder="1830"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="material-sheet-cost">Costo por hoja (MXN)</Label>
                <Input
                  id="material-sheet-cost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.sheetCost}
                  onChange={(e) => set('sheetCost', e.target.value)}
                  placeholder="1016.00"
                />
                <p className="text-xs text-stone-500">
                  Referencia: {form.sheetWidth || '—'}×{form.sheetLength || '—'} mm por hoja completa.
                </p>
              </div>
              {computed && (
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-stone-700">
                    Costo/m² calculado: <strong className="tabular-nums">{money(computed.cost)}</strong>{' '}
                    <span className="text-stone-500">
                      (${num2(Number(String(form.sheetCost).replace(',', '.')))} por hoja ÷ {num2(computed.sheetM2)} m² × merma{' '}
                      {computed.merma === 1 ? '0%' : `+${Math.round((computed.merma - 1) * 1000) / 10}%`})
                    </span>
                  </p>
                  <span className="text-[11px] text-stone-500">
                    Se aplica automáticamente
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="material-cost-ml">Costo por ML (MXN)</Label>
              <Input
                id="material-cost-ml"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.costPerMl}
                onChange={(e) => set('costPerMl', e.target.value)}
                placeholder="450.00"
              />
              <p className="text-xs text-stone-500">
                Las cubiertas se venden por metro lineal × multiplicador (ver Configuración).
              </p>
            </div>
          )}

          <Separator />

          <div className="grid gap-1.5">
            <Label htmlFor="material-notes">Notas</Label>
            <Textarea
              id="material-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Ej. Melamina blanca estándar 15/18mm"
              rows={2}
            />
          </div>

          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="material-active">Activo</Label>
                <p className="text-xs text-stone-500">
                  Los materiales inactivos no aparecen en el despiece ni en el cotizador.
                </p>
              </div>
              <Switch
                id="material-active"
                checked={form.active}
                onCheckedChange={(v) => set('active', v)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="material-maderado">Material MADERADO</Label>
                <p className="text-xs text-stone-500">Usar como material del acabado MADERADO.</p>
              </div>
              <Switch
                id="material-maderado"
                checked={form.isMaderado}
                onCheckedChange={(v) => set('isMaderado', v)}
              />
            </div>
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
              {material ? 'Guardar cambios' : 'Crear material'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
