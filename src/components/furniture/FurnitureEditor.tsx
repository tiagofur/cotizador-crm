/* Modo edición del diálogo de mueble: datos generales, imagen, editor de despiece y herrajes */
'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy, ImageOff, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { money, num2 } from '@/lib/format';
import { pieceAreaM2, pieceEdgeMl } from '@/lib/pricing';
import type { CatalogData, FurnitureDTO, FurnitureInput, MaterialDTO } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { FurnitureImage } from './FurnitureImage';
import {
  NONE,
  draftFromFurniture,
  draftPieceCost,
  draftPieceLike,
  emptyDraft,
  emptyPiece,
  hardwareById,
  materialsById,
  thinScrollbar,
  uid,
  type DraftHardware,
  type DraftPiece,
  type FurnitureDraft,
} from './furniture-utils';

interface Props {
  furniture: FurnitureDTO | null;
  catalog: CatalogData;
  categories: string[];
  onSaved: (isNew: boolean) => void;
  onCancel: () => void;
}

const inputCls = 'h-8 text-xs';
const cellBtn = 'h-7 w-7 text-stone-400 hover:text-amber-700 focus-visible:ring-amber-500';

type FlagKey = 'grain' | 'bandLong1' | 'bandLong2' | 'bandShort1' | 'bandShort2';

const FLAG_LABELS: { key: FlagKey; label: string }[] = [
  { key: 'grain', label: 'Veta' },
  { key: 'bandLong1', label: 'Cintilla lado largo 1' },
  { key: 'bandLong2', label: 'Cintilla lado largo 2' },
  { key: 'bandShort1', label: 'Cintilla lado ancho 1' },
  { key: 'bandShort2', label: 'Cintilla lado ancho 2' },
];

function flagPatch(flag: FlagKey, value: boolean): Partial<DraftPiece> {
  switch (flag) {
    case 'grain':
      return { grain: value };
    case 'bandLong1':
      return { bandLong1: value };
    case 'bandLong2':
      return { bandLong2: value };
    case 'bandShort1':
      return { bandShort1: value };
    default:
      return { bandShort2: value };
  }
}

export function FurnitureEditor({ furniture, catalog, categories, onSaved, onCancel }: Props) {
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);
  const isNew = !furniture;

  const [draft, setDraft] = useState<FurnitureDraft>(() =>
    furniture ? draftFromFurniture(furniture) : emptyDraft()
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const matById = useMemo(() => materialsById(catalog), [catalog]);
  const hwById = useMemo(() => hardwareById(catalog), [catalog]);
  const boardMaterials = useMemo(
    () => catalog.materials.filter((m) => m.type === 'TABLERO' && m.active),
    [catalog]
  );
  const activeHardware = useMemo(
    () => catalog.hardware.filter((h) => h.active).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [catalog]
  );
  const inactiveHardware = useMemo(
    () => catalog.hardware.filter((h) => !h.active).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [catalog]
  );

  /* ---------- mutadores de draft ---------- */
  const patchDraft = (patch: Partial<FurnitureDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const updatePiece = (key: string, patch: Partial<DraftPiece>) =>
    setDraft((d) => ({
      ...d,
      pieces: d.pieces.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    }));
  const updateHardware = (key: string, patch: Partial<DraftHardware>) =>
    setDraft((d) => ({
      ...d,
      hardware: d.hardware.map((h) => (h.key === key ? { ...h, ...patch } : h)),
    }));

  const addPiece = () => setDraft((d) => ({ ...d, pieces: [...d.pieces, emptyPiece()] }));
  const duplicatePiece = (p: DraftPiece) =>
    setDraft((d) => {
      const idx = d.pieces.findIndex((x) => x.key === p.key);
      const copy: DraftPiece = { ...p, key: uid() };
      const pieces = [...d.pieces];
      pieces.splice(idx + 1, 0, copy);
      return { ...d, pieces };
    });
  const removePiece = (key: string) =>
    setDraft((d) => ({ ...d, pieces: d.pieces.filter((p) => p.key !== key) }));

  const addHardware = () =>
    setDraft((d) => ({ ...d, hardware: [...d.hardware, { key: uid(), hardwareId: '', qty: '1' }] }));
  const removeHardware = (key: string) =>
    setDraft((d) => ({ ...d, hardware: d.hardware.filter((h) => h.key !== key) }));

  /* ---------- totales en vivo ---------- */
  const totals = useMemo(() => {
    let m2 = 0;
    let ml = 0;
    let cost = 0;
    for (const p of draft.pieces) {
      m2 += pieceAreaM2(draftPieceLike(p));
      ml += pieceEdgeMl(draftPieceLike(p));
      const mat = p.materialId ? matById.get(p.materialId) ?? null : null;
      cost += draftPieceCost(p, mat);
    }
    let hwCost = 0;
    for (const h of draft.hardware) {
      const hw = h.hardwareId ? hwById.get(h.hardwareId) : undefined;
      if (hw) hwCost += (Number(h.qty) || 0) * hw.unitCost;
    }
    return { m2, ml, cost, hwCost };
  }, [draft, matById, hwById]);

  /* ---------- imagen ---------- */
  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        toast.error(data?.error || 'No se pudo subir la imagen');
        return;
      }
      const url = data.url;
      patchDraft({ imageUrl: url });
      toast.success('Imagen cargada');
    } catch {
      toast.error('No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  /* ---------- guardar ---------- */
  async function handleSave() {
    if (!draft.code.trim() || !draft.name.trim()) {
      toast.error('El código y el nombre del mueble son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const input: FurnitureInput = {
        code: draft.code.trim(),
        name: draft.name.trim(),
        category: draft.category.trim() || 'Otro',
        width: Number(draft.width) || 0,
        height: Number(draft.height) || 0,
        depth: Number(draft.depth) || 0,
        imageUrl: draft.imageUrl.trim() || null,
        notes: draft.notes.trim() || null,
        appliesCountertop: draft.appliesCountertop,
        countertopWidthM: draft.appliesCountertop ? Number(draft.countertopWidthM) || 0 : 0,
        pieces: draft.pieces.map((p) => ({
          name: p.name.trim() || 'Pieza',
          code: p.code.trim() || null,
          qty: Math.max(1, Number(p.qty) || 1),
          length: Number(p.length) || 0,
          width: Number(p.width) || 0,
          materialId: p.materialId || null,
          isFront: p.isFront,
          grain: p.grain,
          bandLong1: p.bandLong1,
          bandLong2: p.bandLong2,
          bandShort1: p.bandShort1,
          bandShort2: p.bandShort2,
        })),
        hardware: draft.hardware
          .filter((h) => h.hardwareId && h.hardwareId !== NONE)
          .map((h) => ({ hardwareId: h.hardwareId, qty: Math.max(1, Number(h.qty) || 1) })),
      };
      const res = await fetch(isNew ? '/api/furniture' : `/api/furniture/${furniture?.id ?? ''}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error || 'No se pudo guardar el mueble');
        return;
      }
      toast.success(isNew ? `Mueble "${input.code}" creado` : `Cambios en "${input.code}" guardados`);
      await fetchCatalog();
      onSaved(isNew);
    } catch {
      toast.error('No se pudo guardar el mueble');
    } finally {
      setSaving(false);
    }
  }

  const sectionTitle =
    'text-sm font-semibold uppercase tracking-wide text-stone-500';

  return (
    <div className="space-y-6">
      {/* Datos generales */}
      <section aria-labelledby="ed-general" className="space-y-4">
        <h3 id="ed-general" className={sectionTitle}>
          Datos generales
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="ed-code">Código *</Label>
            <Input
              id="ed-code"
              value={draft.code}
              onChange={(e) => patchDraft({ code: e.target.value })}
              placeholder="ALA-01"
              className="font-mono"
              required
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ed-name">Nombre *</Label>
            <Input
              id="ed-name"
              value={draft.name}
              onChange={(e) => patchDraft({ name: e.target.value })}
              placeholder="Alacena recta 600 × 680 × 320 mm"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-cat">Categoría</Label>
            <Input
              id="ed-cat"
              list="ed-cat-list"
              value={draft.category}
              onChange={(e) => patchDraft({ category: e.target.value })}
              placeholder="Alacena"
            />
            <datalist id="ed-cat-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="ed-w">Ancho</Label>
              <Input
                id="ed-w"
                type="number"
                min="0"
                value={draft.width}
                onChange={(e) => patchDraft({ width: e.target.value })}
                className="text-right"
                aria-label="Ancho en milímetros"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-h">Alto</Label>
              <Input
                id="ed-h"
                type="number"
                min="0"
                value={draft.height}
                onChange={(e) => patchDraft({ height: e.target.value })}
                className="text-right"
                aria-label="Alto en milímetros"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-d">Fondo</Label>
              <Input
                id="ed-d"
                type="number"
                min="0"
                value={draft.depth}
                onChange={(e) => patchDraft({ depth: e.target.value })}
                className="text-right"
                aria-label="Fondo en milímetros"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-stone-200 p-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <Switch
              id="ed-cubierta"
              checked={draft.appliesCountertop}
              onCheckedChange={(v) => patchDraft({ appliesCountertop: v })}
            />
            <Label htmlFor="ed-cubierta" className="cursor-pointer text-sm font-normal">
              Lleva cubierta
            </Label>
          </div>
          {draft.appliesCountertop && (
            <div className="flex items-center gap-2">
              <Label htmlFor="ed-cw" className="whitespace-nowrap text-sm font-normal">
                Ancho de cubierta
              </Label>
              <Input
                id="ed-cw"
                type="number"
                min="0"
                step="0.01"
                value={draft.countertopWidthM}
                onChange={(e) => patchDraft({ countertopWidthM: e.target.value })}
                className="w-24 text-right"
                aria-label="Ancho de cubierta en metros"
              />
              <span className="text-xs text-stone-500">m</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ed-notes">Notas</Label>
          <Textarea
            id="ed-notes"
            rows={2}
            value={draft.notes}
            onChange={(e) => patchDraft({ notes: e.target.value })}
            placeholder="Notas internas de fabricación…"
          />
        </div>
      </section>

      {/* Imagen */}
      <section aria-labelledby="ed-image" className="space-y-3">
        <h3 id="ed-image" className={sectionTitle}>
          Imagen
        </h3>
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <FurnitureImage
            url={draft.imageUrl}
            alt="Vista previa de la imagen del mueble"
            className="h-32 w-full shrink-0 overflow-hidden rounded-lg border border-stone-200 sm:w-48"
            iconClassName="h-9 w-9"
          />
          <div className="w-full flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden />
                )}
                {uploading ? 'Subiendo…' : 'Subir archivo'}
              </Button>
              {draft.imageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => patchDraft({ imageUrl: '' })}
                >
                  <ImageOff className="h-4 w-4" aria-hidden />
                  Quitar imagen
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              aria-label="Seleccionar archivo de imagen"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
            <div className="space-y-1.5">
              <Label htmlFor="ed-imgurl">…o pega una URL</Label>
              <Input
                id="ed-imgurl"
                value={draft.imageUrl}
                onChange={(e) => patchDraft({ imageUrl: e.target.value })}
                placeholder="/uploads/alacena.png o https://…"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Editor de piezas */}
      <section aria-labelledby="ed-pieces" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="ed-pieces" className={sectionTitle}>
            Despiece <span className="font-normal normal-case text-stone-400">({draft.pieces.length})</span>
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-500">
              Costo blanco:{' '}
              <strong className="text-sm font-semibold text-stone-900">{money(totals.cost)}</strong>
            </span>
            <Button
              type="button"
              size="sm"
              onClick={addPiece}
              className="bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-amber-500"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Agregar pieza
            </Button>
          </div>
        </div>
        <div className={`rounded-lg border border-stone-200 max-h-80 overflow-y-auto overflow-x-auto ${thinScrollbar}`}>
          <Table>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead className="text-xs">Cant.</TableHead>
                <TableHead className="text-xs">Pieza</TableHead>
                <TableHead className="text-xs">Código</TableHead>
                <TableHead className="text-xs text-right">Largo</TableHead>
                <TableHead className="text-xs text-right">Ancho</TableHead>
                <TableHead className="text-xs">Material</TableHead>
                <TableHead className="text-center text-xs" title="Es frente (usa el color elegido en el acabado)">Fte.</TableHead>
                <TableHead className="text-center text-xs" title="Veta">Veta</TableHead>
                <TableHead className="text-center text-xs" title="Cintilla lado largo 1">L1</TableHead>
                <TableHead className="text-center text-xs" title="Cintilla lado largo 2">L2</TableHead>
                <TableHead className="text-center text-xs" title="Cintilla lado ancho 1">A1</TableHead>
                <TableHead className="text-center text-xs" title="Cintilla lado ancho 2">A2</TableHead>
                <TableHead className="text-xs text-right">Costo</TableHead>
                <TableHead className="text-right text-xs">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.pieces.map((p, i) => {
                const mat: MaterialDTO | null = p.materialId ? matById.get(p.materialId) ?? null : null;
                const cost = draftPieceCost(p, mat);
                return (
                  <TableRow key={p.key}>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={p.qty}
                        onChange={(e) => updatePiece(p.key, { qty: e.target.value })}
                        className={`${inputCls} w-14`}
                        aria-label={`Cantidad de la pieza ${i + 1}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={p.name}
                        onChange={(e) => updatePiece(p.key, { name: e.target.value })}
                        className={`${inputCls} w-36 min-w-28`}
                        placeholder="Panel frontal"
                        aria-label={`Nombre de la pieza ${i + 1}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={p.code}
                        onChange={(e) => updatePiece(p.key, { code: e.target.value })}
                        className={`${inputCls} w-24 font-mono`}
                        placeholder="PF-01"
                        aria-label={`Código de la pieza ${i + 1}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={p.length}
                        onChange={(e) => updatePiece(p.key, { length: e.target.value })}
                        className={`${inputCls} w-20 text-right`}
                        aria-label={`Largo en mm de la pieza ${i + 1}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={p.width}
                        onChange={(e) => updatePiece(p.key, { width: e.target.value })}
                        className={`${inputCls} w-20 text-right`}
                        aria-label={`Ancho en mm de la pieza ${i + 1}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.materialId || NONE}
                        onValueChange={(v) => updatePiece(p.key, { materialId: v === NONE ? '' : v })}
                      >
                        <SelectTrigger className={`${inputCls} w-40`} aria-label={`Material de la pieza ${i + 1}`}>
                          <SelectValue placeholder="Material" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>— sin material —</SelectItem>
                          {boardMaterials.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-1">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={p.isFront}
                          onCheckedChange={(v) => updatePiece(p.key, { isFront: v === true })}
                          aria-label={`La pieza ${i + 1} es frente`}
                          title="Es frente: cambia de material según el color del acabado"
                          className="size-3.5"
                        />
                      </div>
                    </TableCell>
                    {FLAG_LABELS.map(({ key, label }) => (
                      <TableCell key={key} className="px-1">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={p[key]}
                            onCheckedChange={(v) => updatePiece(p.key, flagPatch(key, v === true))}
                            aria-label={`${label} de la pieza ${i + 1}`}
                            title={label}
                            className="size-3.5"
                          />
                        </div>
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-xs tabular-nums">
                      {mat ? (
                        money(cost)
                      ) : (
                        <span className="text-stone-300" title="Sin material asignado">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cellBtn}
                          onClick={() => duplicatePiece(p)}
                          aria-label={`Duplicar pieza ${i + 1}`}
                          title="Duplicar"
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={`${cellBtn} hover:text-red-600`}
                          onClick={() => removePiece(p.key)}
                          aria-label={`Eliminar pieza ${i + 1}`}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={10} className="text-xs text-stone-500">
                  Totales ({draft.pieces.length} piezas)
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums" title="Suma de metros cuadrados">
                  Σ {num2(totals.m2)} m²
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums" title="Suma de metros lineales de cintilla">
                  Σ {num2(totals.ml)} ML
                </TableCell>
                <TableCell className="text-right text-xs font-semibold tabular-nums">{money(totals.cost)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>

      {/* Editor de herrajes */}
      <section aria-labelledby="ed-hardware" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="ed-hardware" className={sectionTitle}>
            Herrajes <span className="font-normal normal-case text-stone-400">({draft.hardware.length})</span>
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-500">
              Total:{' '}
              <strong className="text-sm font-semibold text-stone-900">{money(totals.hwCost)}</strong>
            </span>
            <Button type="button" size="sm" variant="outline" onClick={addHardware}>
              <Plus className="h-4 w-4" aria-hidden />
              Agregar herraje
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Herraje</TableHead>
                <TableHead className="text-xs">Cant.</TableHead>
                <TableHead className="text-xs text-right">Costo unit.</TableHead>
                <TableHead className="text-xs text-right">Subtotal</TableHead>
                <TableHead className="text-right text-xs">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.hardware.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-stone-400">
                    Sin herrajes. Agrega bisagras, Kit Minifixx, jaladeras, etc.
                  </TableCell>
                </TableRow>
              )}
              {draft.hardware.map((h, i) => {
                const hw = h.hardwareId && h.hardwareId !== NONE ? hwById.get(h.hardwareId) : undefined;
                const subtotal = hw ? (Number(h.qty) || 0) * hw.unitCost : 0;
                return (
                  <TableRow key={h.key}>
                    <TableCell>
                      <Select
                        value={h.hardwareId || NONE}
                        onValueChange={(v) => updateHardware(h.key, { hardwareId: v === NONE ? '' : v })}
                      >
                        <SelectTrigger className={`${inputCls} w-56`} aria-label={`Herraje ${i + 1}`}>
                          <SelectValue placeholder="Selecciona herraje…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>— ninguno —</SelectItem>
                          <SelectGroup>
                            <SelectLabel>Activos</SelectLabel>
                            {activeHardware.map((hw2) => (
                              <SelectItem key={hw2.id} value={hw2.id}>
                                {hw2.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          {inactiveHardware.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Inactivos (referencia)</SelectLabel>
                              {inactiveHardware.map((hw2) => (
                                <SelectItem key={hw2.id} value={hw2.id}>
                                  {hw2.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={h.qty}
                        onChange={(e) => updateHardware(h.key, { qty: e.target.value })}
                        className={`${inputCls} w-16`}
                        aria-label={`Cantidad del herraje ${i + 1}`}
                      />
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {hw ? money(hw.unitCost) : <span className="text-stone-300">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium tabular-nums">
                      {hw ? money(subtotal) : <span className="text-stone-300">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={`${cellBtn} hover:text-red-600`}
                          onClick={() => removeHardware(h.key)}
                          aria-label={`Eliminar herraje ${i + 1}`}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-xs text-stone-500">
                  Total herrajes
                </TableCell>
                <TableCell className="text-right text-xs font-semibold tabular-nums">{money(totals.hwCost)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>

      {/* Acciones */}
      <div className="flex flex-col-reverse gap-2 border-t border-stone-200 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-amber-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {isNew ? 'Crear mueble' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
