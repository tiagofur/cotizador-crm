/* Tab "Muebles": catálogo con búsqueda/filtros, precios en vivo y editor de despiece */
'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Search, SearchX } from 'lucide-react';
import type { TabProps } from '@/app/page';
import { useAppStore, priceOf } from '@/lib/store';
import { money, dims } from '@/lib/format';
import type { FurnitureDTO } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FurnitureDetail } from '@/components/furniture/FurnitureDetail';
import { FurnitureEditor } from '@/components/furniture/FurnitureEditor';
import { FurnitureImage } from '@/components/furniture/FurnitureImage';
import { normalizeText } from '@/components/furniture/furniture-utils';

type SortId = 'original' | 'name' | 'price';

const SORTS: { id: SortId; label: string }[] = [
  { id: 'original', label: 'Orden original' },
  { id: 'name', label: 'Nombre (A–Z)' },
  { id: 'price', label: 'Precio (menor a mayor)' },
];

export default function FurnitureTab({ onNavigate }: TabProps) {
  void onNavigate;

  const catalog = useAppStore((s) => s.catalog);
  const loadingCatalog = useAppStore((s) => s.loadingCatalog);
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const [sort, setSort] = useState<SortId>('original');

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of catalog?.furniture ?? []) set.add(f.category);
    if (set.size === 0) set.add('Otro');
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalog]);

  const filtered = useMemo(() => {
    const all: FurnitureDTO[] = catalog?.furniture ?? [];
    const q = normalizeText(search.trim());
    let list = all;
    if (q) {
      list = list.filter((f) => normalizeText(f.code).includes(q) || normalizeText(f.name).includes(q));
    }
    if (category !== 'ALL') {
      list = list.filter((f) => f.category === category);
    }
    if (sort === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    } else if (sort === 'price' && catalog) {
      list = [...list].sort((a, b) => priceOf(catalog, a, 'BLANCO') - priceOf(catalog, b, 'BLANCO'));
    }
    return list;
  }, [catalog, search, category, sort]);

  const selected: FurnitureDTO | null = catalog?.furniture.find((f) => f.id === selectedId) ?? null;
  const showEditor = open && mode === 'edit';

  function openDetail(f: FurnitureDTO) {
    setSelectedId(f.id);
    setMode('read');
    setOpen(true);
  }

  function openNew() {
    setSelectedId(null);
    setMode('edit');
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setConfirmDelete(false);
  }

  async function handleDelete() {
    if (!selected) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/furniture/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'No se pudo eliminar el mueble');
        return;
      }
      toast.success(`Mueble ${selected.code} eliminado`);
      closeDialog();
      setSelectedId(null);
      await fetchCatalog();
    } catch {
      toast.error('No se pudo eliminar el mueble');
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!catalog) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-stone-500" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" aria-hidden />
        <p className="text-sm">{loadingCatalog ? 'Cargando catálogo…' : 'Sin datos del catálogo'}</p>
      </div>
    );
  }

  /* Vista de pantalla completa: detalle o editor del mueble */
  if (open) {
    return (
      <div className="-mx-4 -my-6 px-4 py-6">
        {showEditor ? (
          <FurnitureEditor
            furniture={selected}
            catalog={catalog}
            categories={categories}
            onSaved={(isNew) => {
              if (isNew) {
                closeDialog();
              } else {
                setMode('read');
              }
            }}
            onCancel={() => {
              if (selected) {
                setMode('read');
              } else {
                closeDialog();
              }
            }}
          />
        ) : selected ? (
          <FurnitureDetail
            furniture={selected}
            onEdit={() => setMode('edit')}
            onDelete={() => setConfirmDelete(true)}
            onClose={closeDialog}
          />
        ) : null}

        {/* Confirmación de eliminación */}
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar el mueble {selected?.code}?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminarán también sus piezas y herrajes. Esta acción no se puede deshacer. Si el mueble está usado
                en cotizaciones, el sistema no permitirá eliminarlo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteBusy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleDelete();
                }}
                disabled={deleteBusy}
                className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
              >
                {deleteBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Eliminando…
                  </>
                ) : (
                  'Sí, eliminar'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar sticky */}
      <div className="sticky top-24 z-30 -mx-4 mb-4 border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código o nombre…"
              aria-label="Buscar muebles por código o nombre"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por categoría">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortId)}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Ordenar resultados">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={openNew}
              className="bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-amber-500"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo mueble
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500" role="status" aria-live="polite">
          Mostrando <strong className="text-stone-700">{filtered.length}</strong> de {catalog.furniture.length} muebles
        </p>
      </div>

      {/* Grid de tarjetas */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center shadow-sm">
          <SearchX className="mx-auto h-10 w-10 text-stone-300" aria-hidden />
          <p className="mt-3 font-semibold text-stone-700">Sin resultados</p>
          <p className="mt-1 text-sm text-stone-500">
            No hay muebles que coincidan con la búsqueda o los filtros aplicados.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearch('');
              setCategory('ALL');
              setSort('original');
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => openDetail(f)}
                aria-label={`Ver detalle de ${f.name} (${f.code})`}
                className="group block w-full overflow-hidden rounded-xl border border-stone-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <div className="relative">
                  <FurnitureImage url={f.imageUrl} alt={`Imagen de ${f.name}`} className="h-40 w-full" />
                  {f.appliesCountertop && (
                    <Badge className="absolute right-2 top-2 border-transparent bg-amber-500 text-white">
                      Cubierta
                    </Badge>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {f.code}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] text-stone-500">
                      {f.category}
                    </Badge>
                  </div>
                  <h3 className="line-clamp-2 min-h-10 font-semibold leading-snug text-stone-900">{f.name}</h3>
                  <p className="text-xs text-stone-500">{dims(f.width, f.height, f.depth)}</p>
                  <div className="grid grid-cols-2 gap-2 border-t border-stone-100 pt-2">
                    <div>
                      <p className="text-[11px] text-stone-500">Blanco</p>
                      <p className="text-sm font-bold tabular-nums text-stone-900">
                        {money(priceOf(catalog, f, 'BLANCO'))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500">Maderado</p>
                      <p className="text-sm font-bold tabular-nums text-amber-700">
                        {money(priceOf(catalog, f, 'MADERADO'))}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    {f.pieces.length} piezas · {f.hardwareItems.length} herrajes
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Confirmación de eliminación */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el mueble {selected?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también sus piezas y herrajes. Esta acción no se puede deshacer. Si el mueble está usado en
              cotizaciones, el sistema no permitirá eliminarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleteBusy}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
            >
              {deleteBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Eliminando…
                </>
              ) : (
                'Sí, eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
