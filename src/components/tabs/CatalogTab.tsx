'use client';

/* Catálogo de materiales (tableros y cubiertas) y herrajes */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown,
  EyeOff,
  Info,
  Layers,
  Loader2,
  PackageOpen,
  Pencil,
  Plus,
  Ruler,
  Scissors,
  Trash2,
} from 'lucide-react';
import type { TabProps } from '@/app/page';
import { useAppStore } from '@/lib/store';
import type { HardwareDTO, MaterialDTO } from '@/lib/types';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import MaterialDialog from '@/components/catalog/material-dialog';
import HardwareDialog from '@/components/catalog/hardware-dialog';

type MaterialFilter = 'TODOS' | 'TABLERO' | 'CUBIERTA';

const MATERIAL_FILTERS: { value: MaterialFilter; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'TABLERO', label: 'Tableros' },
  { value: 'CUBIERTA', label: 'Cubiertas' },
];

/** Columna "Hoja": dimensiones y costo de la hoja completa (solo tableros) */
function sheetInfo(m: MaterialDTO): string | null {
  if (m.type !== 'TABLERO') return null;
  const parts: string[] = [];
  if (m.sheetWidth != null && m.sheetLength != null) parts.push(`${m.sheetWidth}×${m.sheetLength} mm`);
  else if (m.sheetWidth != null || m.sheetLength != null) parts.push(`${m.sheetWidth ?? m.sheetLength} mm`);
  if (m.sheetCost != null) parts.push(money(m.sheetCost));
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function CatalogTab({ onNavigate }: TabProps) {
  void onNavigate;

  const catalog = useAppStore((s) => s.catalog);
  const loadingCatalog = useAppStore((s) => s.loadingCatalog);
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);

  const [materialFilter, setMaterialFilter] = useState<MaterialFilter>('TODOS');
  const [materialDialog, setMaterialDialog] = useState<{ open: boolean; editing: MaterialDTO | null }>({
    open: false,
    editing: null,
  });
  const [hardwareDialog, setHardwareDialog] = useState<{ open: boolean; editing: HardwareDTO | null }>({
    open: false,
    editing: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'material' | 'hardware';
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(true);

  const materials = useMemo(() => catalog?.materials ?? [], [catalog]);
  const hardware = useMemo(() => catalog?.hardware ?? [], [catalog]);

  const filteredMaterials = useMemo(
    () => (materialFilter === 'TODOS' ? materials : materials.filter((m) => m.type === materialFilter)),
    [materials, materialFilter]
  );

  const hardwareSorted = useMemo(
    () =>
      [...hardware].sort((a, b) =>
        a.active === b.active ? a.name.localeCompare(b.name, 'es') : a.active ? -1 : 1
      ),
    [hardware]
  );

  /* Materiales usados en piezas de algún mueble (para bloquear el cambio de tipo) */
  const materialsInUse = useMemo(() => {
    const set = new Set<string>();
    for (const f of catalog?.furniture ?? []) {
      for (const p of f.pieces) {
        if (p.materialId) set.add(p.materialId);
      }
    }
    return set;
  }, [catalog]);

  const tablerosCount = useMemo(() => materials.filter((m) => m.type === 'TABLERO').length, [materials]);
  const cubiertasCount = useMemo(() => materials.filter((m) => m.type === 'CUBIERTA').length, [materials]);
  const hardwareActivos = useMemo(() => hardware.filter((h) => h.active).length, [hardware]);
  const isLoading = loadingCatalog && !catalog;

  /* ---- Acciones ---- */

  async function toggleActive(kind: 'material' | 'hardware', id: string, checked: boolean) {
    setBusyId(id);
    try {
      const url = kind === 'material' ? `/api/materials/${id}` : `/api/hardware/${id}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: checked }),
      });
      if (!res.ok) {
        const body: { error?: string } | null = await res.json().catch(() => null);
        toast.error(body?.error || 'No se pudo actualizar el estado');
        return;
      }
      await fetchCatalog();
    } catch {
      toast.error('Error de conexión al actualizar el estado');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { kind, id, name } = deleteTarget;
    setDeleting(true);
    try {
      const url = kind === 'material' ? `/api/materials/${id}` : `/api/hardware/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const body: { ok?: boolean; deactivated?: boolean; message?: string; error?: string } | null =
        await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error || `Error al eliminar ${kind === 'material' ? 'el material' : 'el herraje'}`);
      } else if (body?.deactivated) {
        toast.warning(body?.message || `«${name}» está en uso; se desactivó en lugar de eliminarse.`);
      } else {
        toast.success(
          `${kind === 'material' ? 'Material' : 'Herraje'} «${name}» eliminado correctamente`
        );
      }
    } catch {
      toast.error('Error de conexión al eliminar');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      fetchCatalog();
    }
  }

  /* ---- Render ---- */

  return (
    <div className="space-y-4">
      {/* Card informativa colapsable */}
      <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
              aria-hidden
            >
              <Info className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium">¿Cómo funciona el catálogo?</p>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8 w-8 p-0 text-stone-500"
                aria-label={infoOpen ? 'Ocultar información' : 'Mostrar información'}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', infoOpen && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <ul className="space-y-2.5 px-4 pb-4 text-sm text-stone-600">
              <li className="flex items-start gap-2.5">
                <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
                <span>
                  El costo de cintilla se aplica <strong className="font-medium text-stone-800">por metro
                  lineal</strong> según las bandas marcadas en cada pieza del despiece (L1/L2 = canto largo,
                  A1/A2 = canto ancho).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
                <span>
                  Los materiales <strong className="font-medium text-stone-800">inactivos</strong> no aparecen
                  en los selects del despiece ni del cotizador.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
                <span>
                  Las cubiertas se venden por <strong className="font-medium text-stone-800">ML ×
                  multiplicador</strong> (ver Configuración).
                </span>
              </li>
            </ul>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Tabs defaultValue="materiales" className="gap-4">
        <TabsList className="h-auto w-fit bg-white border border-stone-200 shadow-sm p-1">
          <TabsTrigger
            value="materiales"
            className="data-[state=active]:text-amber-700 data-[state=active]:bg-amber-50 px-3 sm:px-4 py-1.5"
          >
            <Layers className="h-4 w-4" aria-hidden />
            Tableros y Cubiertas
          </TabsTrigger>
          <TabsTrigger
            value="herrajes"
            className="data-[state=active]:text-amber-700 data-[state=active]:bg-amber-50 px-3 sm:px-4 py-1.5"
          >
            <Ruler className="h-4 w-4" aria-hidden />
            Herrajes
          </TabsTrigger>
        </TabsList>

        {/* ============ Pestaña Materiales ============ */}
        <TabsContent value="materiales" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div
              role="group"
              aria-label="Filtrar materiales por tipo"
              className="inline-flex w-fit rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm"
            >
              {MATERIAL_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={materialFilter === f.value}
                  onClick={() => setMaterialFilter(f.value)}
                  className={cn(
                    'min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                    materialFilter === f.value
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-stone-500 order-3 sm:order-none">
              {tablerosCount} tableros · {cubiertasCount} cubiertas
              {materialFilter !== 'TODOS' && ` · mostrando ${filteredMaterials.length}`}
            </p>

            <Button
              onClick={() => setMaterialDialog({ open: true, editing: null })}
              className="sm:ml-auto bg-brand-600 hover:bg-brand-700 text-white min-h-[40px]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo material
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
            <div className="max-h-[65vh] overflow-auto rounded-xl">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.stone.200)]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Costo m²</TableHead>
                    <TableHead>Cintilla</TableHead>
                    <TableHead>Hoja</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="text-center">Activo</TableHead>
                    <TableHead className="pr-4 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-stone-500">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Cargando catálogo…
                        </span>
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading && filteredMaterials.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-1.5 text-stone-500">
                          <PackageOpen className="h-8 w-8 text-stone-300" aria-hidden />
                          <p className="text-sm">
                            {materials.length === 0
                              ? 'Aún no hay materiales en el catálogo.'
                              : `No hay materiales ${materialFilter === 'TABLERO' ? 'de tipo tablero' : 'de tipo cubierta'}.`}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading &&
                    filteredMaterials.map((m) => {
                      const hoja = sheetInfo(m);
                      return (
                        <TableRow key={m.id} className={cn(!m.active && 'opacity-60')}>
                          <TableCell className="pl-4 font-semibold whitespace-normal">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>{m.name}</span>
                              {m.isMaderado && (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium"
                                >
                                  Maderado
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                'font-medium',
                                m.type === 'TABLERO'
                                  ? 'bg-stone-100 text-stone-700 border-stone-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                              )}
                            >
                              {m.type === 'TABLERO' ? 'Tablero' : 'Cubierta'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.type === 'TABLERO' && m.costPerM2 != null ? money(m.costPerM2) : '—'}
                          </TableCell>
                          <TableCell>
                            {m.edgeBandCostMl != null ? (
                              <div>
                                <span className="tabular-nums">
                                  {money(m.edgeBandCostMl)}
                                  <span className="text-xs text-stone-400"> /ML</span>
                                </span>
                                {m.edgeBandName && (
                                  <p className="text-xs text-stone-500">{m.edgeBandName}</p>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums">{hoja ?? '—'}</TableCell>
                          <TableCell className="max-w-[220px]">
                            {m.notes ? (
                              <span className="block truncate text-stone-600" title={m.notes}>
                                {m.notes}
                              </span>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={m.active}
                              disabled={busyId === m.id}
                              onCheckedChange={(v) => toggleActive('material', m.id, v)}
                              aria-label={`Activar o desactivar ${m.name}`}
                            />
                          </TableCell>
                          <TableCell className="pr-4">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-stone-500 hover:text-amber-700 hover:bg-amber-50"
                                aria-label={`Editar ${m.name}`}
                                onClick={() => setMaterialDialog({ open: true, editing: m })}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-stone-500 hover:text-red-600 hover:bg-red-50"
                                aria-label={`Eliminar ${m.name}`}
                                onClick={() => setDeleteTarget({ kind: 'material', id: m.id, name: m.name })}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ============ Pestaña Herrajes ============ */}
        <TabsContent value="herrajes" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-xs text-stone-500">
              {hardwareActivos} activos · {hardware.length - hardwareActivos} de referencia
            </p>
            <Button
              onClick={() => setHardwareDialog({ open: true, editing: null })}
              className="sm:ml-auto bg-brand-600 hover:bg-brand-700 text-white min-h-[40px]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo herraje
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
            <div className="max-h-[65vh] overflow-auto rounded-xl">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.stone.200)]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Nombre</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Costo unitario</TableHead>
                    <TableHead className="text-center">Activo</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="pr-4 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-stone-500">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Cargando catálogo…
                        </span>
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading && hardwareSorted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-1.5 text-stone-500">
                          <PackageOpen className="h-8 w-8 text-stone-300" aria-hidden />
                          <p className="text-sm">Aún no hay herrajes en el catálogo.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading &&
                    hardwareSorted.map((h) => (
                      <TableRow key={h.id} className={cn(!h.active && 'opacity-60')}>
                        <TableCell className="pl-4 font-semibold whitespace-normal">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{h.name}</span>
                            {!h.active && (
                              <Badge
                                variant="outline"
                                className="bg-stone-100 text-stone-500 border-stone-200 text-[10px] font-medium"
                              >
                                Referencia
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{h.unit || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(h.unitCost)}</TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={h.active}
                            disabled={busyId === h.id}
                            onCheckedChange={(v) => toggleActive('hardware', h.id, v)}
                            aria-label={`Activar o desactivar ${h.name}`}
                          />
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          {h.notes ? (
                            <span className="block truncate text-stone-600" title={h.notes}>
                              {h.notes}
                            </span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-stone-500 hover:text-amber-700 hover:bg-amber-50"
                              aria-label={`Editar ${h.name}`}
                              onClick={() => setHardwareDialog({ open: true, editing: h })}
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-stone-500 hover:text-red-600 hover:bg-red-50"
                              aria-label={`Eliminar ${h.name}`}
                              onClick={() => setDeleteTarget({ kind: 'hardware', id: h.id, name: h.name })}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <MaterialDialog
        open={materialDialog.open}
        onOpenChange={(open) => setMaterialDialog((s) => ({ ...s, open }))}
        material={materialDialog.editing}
        typeLocked={materialDialog.editing != null && materialsInUse.has(materialDialog.editing.id)}
      />
      <HardwareDialog
        open={hardwareDialog.open}
        onOpenChange={(open) => setHardwareDialog((s) => ({ ...s, open }))}
        hardware={hardwareDialog.editing}
      />

      {/* Confirmación de eliminación (materiales y herrajes) */}
      <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {deleteTarget?.kind === 'material' ? 'material' : 'herraje'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deleteTarget?.name}» del catálogo. Si está en uso por piezas, muebles o
              cotizaciones, el sistema lo desactivará en lugar de eliminarlo para conservar el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
