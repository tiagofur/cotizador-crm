/* Card de administración de acabados (perfiles cuerpo/frentes) en Configuración */
'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { FinishProfileDTO } from '@/lib/types';
import { money } from '@/lib/format';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Palette, Pencil, Plus, Trash2 } from 'lucide-react';

const NONE = '__none__';

interface Draft {
  id: string | null;
  name: string;
  usePieceMaterials: boolean;
  bodyMaterialId: string;
  frontMaterialId: string;
}

function emptyDraft(): Draft {
  return { id: null, name: '', usePieceMaterials: false, bodyMaterialId: '', frontMaterialId: '' };
}

export function FinishProfilesCard() {
  const catalog = useAppStore((s) => s.catalog);
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FinishProfileDTO | null>(null);

  const boardMaterials = (catalog?.materials ?? []).filter((m) => m.type === 'TABLERO');
  const profiles = catalog?.finishProfiles ?? [];

  useEffect(() => {
    if (!catalog) void fetchCatalog();
  }, [catalog, fetchCatalog]);

  function openNew() {
    setDraft({ ...emptyDraft(), bodyMaterialId: '', frontMaterialId: '' });
    setOpen(true);
  }

  function openEdit(p: FinishProfileDTO) {
    setDraft({
      id: p.id,
      name: p.name,
      usePieceMaterials: p.usePieceMaterials,
      bodyMaterialId: p.bodyMaterialId ?? '',
      frontMaterialId: p.frontMaterialId ?? '',
    });
    setOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error('Escribe el nombre del acabado');
      return;
    }
    if (!draft.usePieceMaterials && !draft.frontMaterialId) {
      toast.error('Elige el material de los frentes');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        usePieceMaterials: draft.usePieceMaterials,
        bodyMaterialId: draft.usePieceMaterials ? null : draft.bodyMaterialId || null,
        frontMaterialId: draft.usePieceMaterials ? null : draft.frontMaterialId || null,
        ...(draft.id ? {} : {}),
      };
      const res = await fetch(draft.id ? '/api/finish-profiles' : '/api/finish-profiles', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft.id ? { ...payload, id: draft.id } : payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error((data as { error?: string })?.error || 'No se pudo guardar el acabado');
        return;
      }
      toast.success(draft.id ? 'Acabado actualizado' : 'Acabado creado');
      setOpen(false);
      await fetchCatalog();
    } catch {
      toast.error('No se pudo guardar el acabado');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: FinishProfileDTO, active: boolean) {
    setToggleBusyId(p.id);
    try {
      const res = await fetch('/api/finish-profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, active }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error((data as { error?: string })?.error || 'No se pudo cambiar el estado');
        return;
      }
      await fetchCatalog();
    } finally {
      setToggleBusyId(null);
    }
  }

  async function doDelete(p: FinishProfileDTO) {
    setBusy(true);
    try {
      const res = await fetch(`/api/finish-profiles?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { error?: string; deactivated?: boolean; message?: string } | null;
      if (!res.ok) {
        toast.error(data?.error || 'No se pudo eliminar el acabado');
        return;
      }
      if (data?.deactivated) toast.warning(data.message || 'Se desactivó en lugar de eliminarse');
      else toast.success('Acabado eliminado');
      setConfirmDelete(null);
      await fetchCatalog();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-amber-600" aria-hidden="true" />
            Acabados y colores de frentes
          </CardTitle>
          <CardDescription>
            Cada acabado define el material del cuerpo y el color de los frentes. Se elige al cotizar.
          </CardDescription>
        </div>
        <Button type="button" size="sm" onClick={openNew} className="bg-brand-600 text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo acabado
        </Button>
      </CardHeader>
      <CardContent>
        <div className={`rounded-lg border border-stone-200 overflow-x-auto ${'max-h-72 overflow-y-auto'}`}>
          <Table>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead className="text-xs">Acabado</TableHead>
                <TableHead className="text-xs">Cuerpo</TableHead>
                <TableHead className="text-xs">Frentes</TableHead>
                <TableHead className="text-xs text-center">Activo</TableHead>
                <TableHead className="text-xs text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id} className={!p.active ? 'opacity-60' : undefined}>
                  <TableCell className="text-sm font-medium text-stone-800">
                    {p.name}
                    {p.id === 'BLANCO' || p.id === 'MADERADO' ? (
                      <Badge variant="outline" className="ml-1.5 text-[10px] text-stone-400">
                        base
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-stone-600">
                    {p.usePieceMaterials ? 'Según despiece' : p.bodyMaterial?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-stone-600">
                    {p.usePieceMaterials ? 'Según despiece' : p.frontMaterial?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {toggleBusyId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-stone-400" aria-hidden />
                      ) : (
                        <Switch
                          checked={p.active}
                          onCheckedChange={(v) => void toggleActive(p, v === true)}
                          disabled={p.id === 'BLANCO' || p.id === 'MADERADO'}
                          aria-label={`Acabado ${p.name} activo`}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-stone-400 hover:text-amber-700"
                        onClick={() => openEdit(p)}
                        aria-label={`Editar acabado ${p.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      {p.id !== 'BLANCO' && p.id !== 'MADERADO' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-stone-400 hover:text-red-600"
                          onClick={() => setConfirmDelete(p)}
                          aria-label={`Eliminar acabado ${p.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Diálogo crear/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Editar acabado' : 'Nuevo acabado'}</DialogTitle>
            <DialogDescription>
              Define qué material se usa en el cuerpo y en los frentes al cotizar con este acabado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="finish-name">Nombre</Label>
              <Input
                id="finish-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Ej. Frente Gris Grafito"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
              <div>
                <Label htmlFor="finish-own" className="text-sm">
                  Usar el material de cada pieza
                </Label>
                <p className="text-xs text-stone-500">
                  (Así funciona el acabado Blanco: cada pieza usa su tablero del despiece)
                </p>
              </div>
              <Switch
                id="finish-own"
                checked={draft.usePieceMaterials}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, usePieceMaterials: v === true }))}
              />
            </div>
            {!draft.usePieceMaterials && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="finish-body">Material del cuerpo / interior</Label>
                  <Select
                    value={draft.bodyMaterialId || NONE}
                    onValueChange={(v) => setDraft((d) => ({ ...d, bodyMaterialId: v === NONE ? '' : v }))}
                  >
                    <SelectTrigger id="finish-body" aria-label="Material del cuerpo">
                      <SelectValue placeholder="Selecciona un tablero…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— sin material —</SelectItem>
                      {boardMaterials.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} — {money(m.costPerM2)}/m²
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="finish-front">Material de los frentes (color)</Label>
                  <Select
                    value={draft.frontMaterialId || NONE}
                    onValueChange={(v) => setDraft((d) => ({ ...d, frontMaterialId: v === NONE ? '' : v }))}
                  >
                    <SelectTrigger id="finish-front" aria-label="Material de los frentes">
                      <SelectValue placeholder="Selecciona un tablero…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— sin material —</SelectItem>
                      {boardMaterials.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} — {money(m.costPerM2)}/m²
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-stone-500">
                    Las piezas marcadas como «frente» en el despiece se calculan con este material.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="bg-brand-600 text-white hover:bg-brand-700"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el acabado {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Si hay cotizaciones que lo usan, solo se desactivará para no perder su historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) void doDelete(confirmDelete);
              }}
              disabled={busy}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Eliminando…
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
