'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TabProps } from '@/app/page';
import { useAppStore } from '@/lib/store';
import type { SettingsDTO } from '@/lib/types';
import { toast } from 'sonner';
import { money } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  SlidersHorizontal,
  TreePine,
  Calculator,
  Info,
  Save,
  Loader2,
} from 'lucide-react';

interface FormState {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  saleFactor: string;
  ivaPercent: string;
  distributorPercent: string;
  laborPerUnit: string;
  countertopFactor: string;
  countertopMultipleM: string;
  maderadoMaterialId: string;
}

function toForm(s: SettingsDTO): FormState {
  return {
    companyName: s.companyName ?? '',
    companyPhone: s.companyPhone ?? '',
    companyEmail: s.companyEmail ?? '',
    companyAddress: s.companyAddress ?? '',
    saleFactor: String(s.saleFactor ?? 6.7),
    ivaPercent: String(Math.round((s.ivaRate ?? 0.16) * 10000) / 100),
    distributorPercent: String(Math.round((s.distributorDiscount ?? 0.35) * 10000) / 100),
    laborPerUnit: String(s.laborPerUnit ?? 0),
    countertopFactor: String(s.countertopFactor ?? 4),
    countertopMultipleM: String(s.countertopMultipleM ?? 1.2),
    maderadoMaterialId: s.maderadoMaterialId ?? '',
  };
}

/** Acepta coma o punto decimal (formato es-MX) */
function parseNum(value: string, fallback: number): number {
  const n = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

const FORMULAS: { label: string; formula: string }[] = [
  {
    label: 'Costo de una pieza',
    formula: 'm² × costo del tablero + ML de cintilla × costo de cintilla',
  },
  { label: 'Costo del mueble', formula: 'Σ costo de piezas + Σ herrajes' },
  { label: 'Precio de venta', formula: '(Costo + mano de obra por unidad) × Factor de venta' },
  {
    label: 'Cubierta',
    formula: 'ML redondeados al múltiplo × costo/ML × multiplicador de venta',
  },
  { label: 'Subtotal', formula: 'Venta de muebles + venta de cubierta' },
  { label: 'Total con IVA', formula: 'Subtotal × (1 + IVA)' },
  { label: 'Precio distribuidor', formula: 'Total × (1 − descuento distribuidor)' },
];

export default function SettingsTab({ onNavigate }: TabProps) {
  void onNavigate;
  const catalog = useAppStore((s) => s.catalog);
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!catalog) return;
    // Inicializa solo la primera vez; conserva los edits del usuario si el catálogo se refresca
    setForm((prev) => prev ?? toForm(catalog.settings));
  }, [catalog]);

  const boardMaterials = useMemo(
    () => (catalog ? catalog.materials.filter((m) => m.type === 'TABLERO' && m.active) : []),
    [catalog]
  );

  const selectedMaderado = useMemo(
    () =>
      catalog && form?.maderadoMaterialId
        ? catalog.materials.find((m) => m.id === form.maderadoMaterialId) ?? null
        : null,
    [catalog, form]
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!form) return;

    const saleFactor = parseNum(form.saleFactor, 0);
    const ivaPercent = parseNum(form.ivaPercent, 16);
    const distributorPercent = parseNum(form.distributorPercent, 35);
    const laborPerUnit = parseNum(form.laborPerUnit, 0);
    const countertopFactor = parseNum(form.countertopFactor, 4);
    const countertopMultipleM = parseNum(form.countertopMultipleM, 1.2);

    if (!(saleFactor > 0)) {
      toast.error('El factor de venta debe ser mayor a 0.');
      return;
    }
    if (ivaPercent < 0 || ivaPercent > 100) {
      toast.error('El IVA debe estar entre 0% y 100%.');
      return;
    }
    if (distributorPercent < 0 || distributorPercent > 100) {
      toast.error('El descuento distribuidor debe estar entre 0% y 100%.');
      return;
    }
    if (countertopMultipleM <= 0) {
      toast.error('El múltiplo de redondeo de cubierta debe ser mayor a 0.');
      return;
    }
    if (form.companyEmail.trim() && !/^\S+@\S+\.\S+$/.test(form.companyEmail.trim())) {
      toast.error('El correo de la empresa no es válido.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName.trim() || 'Cotizador de Muebles',
          companyPhone: form.companyPhone.trim(),
          companyEmail: form.companyEmail.trim(),
          companyAddress: form.companyAddress.trim(),
          saleFactor,
          ivaRate: ivaPercent / 100,
          distributorDiscount: distributorPercent / 100,
          laborPerUnit,
          countertopFactor,
          countertopMultipleM,
          maderadoMaterialId: form.maderadoMaterialId || null,
        }),
      });
      if (!res.ok) throw new Error('No se pudo guardar la configuración.');
      toast.success('Configuración guardada');
      await fetchCatalog();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando configuración">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Configuración</h2>
          <p className="text-sm text-stone-500">
            Datos de la empresa y parámetros que alimentan todas las cotizaciones.
          </p>
        </div>
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="w-full bg-amber-600 text-white hover:bg-amber-700 sm:w-auto"
          aria-label="Guardar configuración"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="w-4 h-4" aria-hidden="true" />
          )}
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Columna de formularios */}
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          {/* Datos de la empresa */}
          <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-4 h-4 text-amber-600" aria-hidden="true" />
                Datos de la empresa
              </CardTitle>
              <CardDescription>Aparecen en las cotizaciones impresas.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="companyName">Nombre de la empresa</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(e) => set('companyName', e.target.value)}
                  placeholder="Muebles y Cocinas Integrales"
                  className="bg-white"
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="companyPhone">Teléfono</Label>
                <Input
                  id="companyPhone"
                  type="tel"
                  value={form.companyPhone}
                  onChange={(e) => set('companyPhone', e.target.value)}
                  placeholder="477 123 4567"
                  className="bg-white"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="companyEmail">Correo electrónico</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={form.companyEmail}
                  onChange={(e) => set('companyEmail', e.target.value)}
                  placeholder="contacto@empresa.mx"
                  className="bg-white"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="companyAddress">Dirección</Label>
                <Textarea
                  id="companyAddress"
                  rows={2}
                  value={form.companyAddress}
                  onChange={(e) => set('companyAddress', e.target.value)}
                  placeholder="Calle, número, ciudad, estado"
                  className="resize-none bg-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Parámetros de precio */}
          <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="w-4 h-4 text-amber-600" aria-hidden="true" />
                Parámetros de precio
              </CardTitle>
              <CardDescription>
                Se aplican en el cotizador y en todas las cotizaciones nuevas.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="saleFactor">Factor de venta</Label>
                <Input
                  id="saleFactor"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={form.saleFactor}
                  onChange={(e) => set('saleFactor', e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-stone-500">Precio = (Costo + MO) × Factor</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ivaRate">IVA (%)</Label>
                <Input
                  id="ivaRate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="1"
                  value={form.ivaPercent}
                  onChange={(e) => set('ivaPercent', e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-stone-500">Se aplica al subtotal de la cotización</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="distributorDiscount">Descuento distribuidor (%)</Label>
                <Input
                  id="distributorDiscount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="1"
                  value={form.distributorPercent}
                  onChange={(e) => set('distributorPercent', e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-stone-500">Precio preferente para distribuidores</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="laborPerUnit">Mano de obra por unidad (MXN)</Label>
                <Input
                  id="laborPerUnit"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="10"
                  value={form.laborPerUnit}
                  onChange={(e) => set('laborPerUnit', e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-stone-500">Se suma al costo de cada mueble</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="countertopFactor">Multiplicador de cubierta</Label>
                <Input
                  id="countertopFactor"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={form.countertopFactor}
                  onChange={(e) => set('countertopFactor', e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-stone-500">
                  Venta de cubierta = costo × multiplicador (predeterminado 4)
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="countertopMultipleM">Múltiplo de cubierta (m)</Label>
                <Input
                  id="countertopMultipleM"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="0.1"
                  value={form.countertopMultipleM}
                  onChange={(e) => set('countertopMultipleM', e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-stone-500">
                  La cubierta se cobra por ML redondeado a este múltiplo (predeterminado 1.20 m)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Acabado maderado */}
          <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TreePine className="w-4 h-4 text-amber-600" aria-hidden="true" />
                Acabado maderado
              </CardTitle>
              <CardDescription>
                Material con el que se calculan todas las piezas en el acabado MADERADO.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="maderadoMaterialId">Material maderado</Label>
                <Select
                  value={form.maderadoMaterialId}
                  onValueChange={(v) => set('maderadoMaterialId', v)}
                >
                  <SelectTrigger
                    id="maderadoMaterialId"
                    className="w-full bg-white"
                    aria-label="Material para el acabado maderado"
                  >
                    <SelectValue placeholder="Selecciona un tablero…" />
                  </SelectTrigger>
                  <SelectContent>
                    {boardMaterials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                        {m.thickness ? ` · ${m.thickness}` : ''} — {money(m.costPerM2)}/m²
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-stone-500">
                  En el acabado MADERADO todas las piezas se calculan con este material, sin importar
                  el tablero original del despiece.
                </p>
              </div>
              {selectedMaderado && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="text-sm font-medium text-stone-800">{selectedMaderado.name}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {money(selectedMaderado.costPerM2)} / m²
                    {selectedMaderado.edgeBandCostMl != null && (
                      <> · cintilla {money(selectedMaderado.edgeBandCostMl)} / ML</>
                    )}
                    {selectedMaderado.thickness && <> · {selectedMaderado.thickness}</>}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lateral: cómo se calcula */}
        <Card className="h-fit bg-white rounded-xl border border-stone-200 shadow-sm lg:sticky lg:top-24 lg:self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="w-4 h-4 text-amber-600" aria-hidden="true" />
              Cómo se calcula
            </CardTitle>
            <CardDescription>Fórmulas que aplican en cotizador y cotizaciones.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {FORMULAS.map((f) => (
                <li key={f.label}>
                  <p className="text-sm font-medium text-stone-800">{f.label}</p>
                  <p className="mt-0.5 font-mono text-xs leading-relaxed text-stone-500">
                    {f.formula}
                  </p>
                </li>
              ))}
            </ul>
            <Separator className="my-4" />
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-amber-800">
                Los precios se calculan en vivo desde los despieces: al guardar, el cotizador y las
                cotizaciones nuevas reflejan los cambios de inmediato.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
