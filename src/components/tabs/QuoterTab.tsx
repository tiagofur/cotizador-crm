'use client';

/* ============================================================
 * QuoterTab — Cotizador en vivo
 * Izquierda: selector de muebles (búsqueda/categoría, carrito)
 * Derecha: panel de cotización (cliente, acabado, cubierta,
 * ajustes, partidas, totales en vivo y guardado)
 * ============================================================ */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TabProps } from '@/app/page';
import {
  useAppStore,
  settingsLike,
  profileOf,
  activeProfiles,
  toFurnitureLike,
  priceOf,
  computeQuoteTotals,
} from '@/lib/store';
import type { Finish, FurnitureDTO, QuotationInput, ClientDTO } from '@/lib/types';
import { money, num } from '@/lib/format';
import { toast } from 'sonner';
import {
  Armchair,
  Calculator,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/** Normaliza texto para búsqueda (minúsculas y sin acentos) */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface CartLine {
  furnitureId: string;
  qty: number;
}

const SCROLL_XS =
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300 hover:[&::-webkit-scrollbar-thumb]:bg-stone-400';

export default function QuoterTab({ onNavigate }: TabProps) {
  const catalog = useAppStore((s) => s.catalog);
  const fetchQuotations = useAppStore((s) => s.fetchQuotations);

  /* ----- filtros del catálogo ----- */
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  /* ----- carrito ----- */
  const [cart, setCart] = useState<CartLine[]>([]);

  /* ----- configuración de la cotización ----- */
  const [finish, setFinish] = useState<Finish>('BLANCO');
  const profiles = useMemo(() => activeProfiles(catalog), [catalog]);
  // Si el perfil guardado ya no existe o está inactivo, cae al primero activo
  const effectiveFinish = profiles.some((p) => p.id === finish) ? finish : (profiles[0]?.id ?? 'BLANCO');
  const profileSelected = useMemo(() => profileOf(catalog, effectiveFinish), [catalog, effectiveFinish]);
  const [countertopId, setCountertopId] = useState<string>('none');
  const [overrideStr, setOverrideStr] = useState('');
  const [factorStr, setFactorStr] = useState('');
  const [laborStr, setLaborStr] = useState('');
  const [applyDistributor, setApplyDistributor] = useState(false);

  const [title, setTitle] = useState('');

  /* ----- cliente ----- */
  const clients = useAppStore((s) => s.clients);
  const fetchClients = useAppStore((s) => s.fetchClients);
  const editingQuotation = useAppStore((st) => st.editingQuotation);
  const setEditingQuotation = useAppStore((st) => st.setEditingQuotation);
  const [clientId, setClientId] = useState<string>('none');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [extraOpen, setExtraOpen] = useState(false);

  const selectedClient = useMemo(
    () => (clientId !== 'none' ? (clients.find((c) => c.id === clientId) ?? null) : null),
    [clientId, clients]
  );

  /* Descuento del cliente: si tiene % propio se usa ese; si no, el base. Su presencia activa el switch. */
  const baseDiscount = settingsLike(catalog).distributorDiscount;
  const effectiveDiscount = selectedClient?.discountPercent != null ? selectedClient.discountPercent / 100 : baseDiscount;
  const clientHasOwnDiscount = selectedClient?.discountPercent != null;
  useEffect(() => {
    if (clientHasOwnDiscount) setApplyDistributor(true);
  }, [clientHasOwnDiscount]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);


  /** Al elegir un cliente registrado, autocompleta nombre/tel/correo */
  useEffect(() => {
    if (selectedClient) {
      setClientName(selectedClient.name);
      setClientPhone(selectedClient.phone ?? '');
      setClientEmail(selectedClient.email ?? '');
    }
  }, [selectedClient]);

  const [saving, setSaving] = useState(false);

  /* Inicializa factor / mano de obra con los valores de configuración (una sola vez) */
  const initialized = useRef(false);
  useEffect(() => {
    if (catalog && !initialized.current) {
      initialized.current = true;
      setFactorStr(String(catalog.settings.saleFactor));
      setLaborStr(String(catalog.settings.laborPerUnit));
    }
  }, [catalog]);

  const furnitureById = useMemo(() => {
    const map: Record<string, FurnitureDTO> = {};
    for (const f of catalog?.furniture ?? []) map[f.id] = f;
    return map;
  }, [catalog]);

  /* ----- modo edición: hidratar el formulario con la cotización a editar ----- */
  const hydratedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const eq = editingQuotation;
    if (!eq || hydratedIdRef.current === eq.id || !catalog) return;
    hydratedIdRef.current = eq.id;
    setTitle(eq.title ?? '');
    setClientId(eq.clientId ?? 'none');
    setClientName(eq.clientName);
    setClientPhone(eq.clientPhone ?? '');
    setClientEmail(eq.clientEmail ?? '');
    setNotes(eq.notes ?? '');
    setFinish(eq.finish);
    setCountertopId(eq.countertopMaterialId ?? 'none');
    setOverrideStr(eq.countertopMlOverride != null ? String(eq.countertopMlOverride) : '');
    setFactorStr(String(eq.factorSnapshot));
    setLaborStr(String(eq.laborSnapshot));
    setApplyDistributor(eq.applyDistributor);
    const lines: CartLine[] = [];
    let dropped = 0;
    for (const it of eq.items) {
      if (it.furnitureId && furnitureById[it.furnitureId]) {
        lines.push({ furnitureId: it.furnitureId, qty: it.qty });
      } else {
        dropped++;
      }
    }
    setCart(lines);
    if (dropped > 0) {
      toast.warning(`${dropped} partida(s) del documento ya no existen en el catálogo y se omitieron`);
    }
  }, [editingQuotation, furnitureById, catalog]);


  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of catalog?.furniture ?? []) set.add(f.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalog]);

  const filtered = useMemo(() => {
    const list = catalog?.furniture ?? [];
    const q = norm(search.trim());
    return list.filter((f) => {
      if (category !== 'all' && f.category !== category) return false;
      if (!q) return true;
      return norm(f.code).includes(q) || norm(f.name).includes(q);
    });
  }, [catalog, search, category]);

  const countertopOptions = useMemo(
    () =>
      (catalog?.materials ?? []).filter(
        (m) => m.type === 'CUBIERTA' && (m.costPerMl || 0) > 0
      ),
    [catalog]
  );

  /* ----- totales en vivo ----- */
  const totals = useMemo(() => {
    const settings = settingsLike(catalog);
    const profile = profileOf(catalog, effectiveFinish);
    const countertop =
      countertopId !== 'none'
        ? (catalog?.materials.find((m) => m.id === countertopId) ?? null)
        : null;
    const parsed = Number(overrideStr);
    const override = overrideStr.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    const factorNum = Number(factorStr);
    const laborNum = Number(laborStr);
    return computeQuoteTotals({
      items: cart
        .filter((c) => furnitureById[c.furnitureId])
        .map((c) => ({ furniture: toFurnitureLike(furnitureById[c.furnitureId]), qty: c.qty })),
      profile,
      countertop,
      countertopMlOverride: override,
      factor: Number.isFinite(factorNum) && factorNum > 0 ? factorNum : settings.saleFactor,
      laborPerUnit: Number.isFinite(laborNum) && laborNum >= 0 ? laborNum : settings.laborPerUnit,
      ivaRate: settings.ivaRate,
      distributorDiscount: effectiveDiscount,
      countertopFactor: settings.countertopFactor,
      countertopMultipleM: settings.countertopMultipleM,
    });
  }, [catalog, cart, furnitureById, effectiveFinish, countertopId, overrideStr, factorStr, laborStr, effectiveDiscount]);

  const countertop = useMemo(
    () =>
      countertopId !== 'none'
        ? (catalog?.materials.find((m) => m.id === countertopId) ?? null)
        : null,
    [catalog, countertopId]
  );

  /** Largo auto calculado (sin considerar el override del usuario) */
  const autoMl = useMemo(
    () =>
      cart.reduce((acc, c) => {
        const f = furnitureById[c.furnitureId];
        return acc + (f && f.appliesCountertop ? f.countertopWidthM * c.qty : 0);
      }, 0),
    [cart, furnitureById]
  );

  const countertopItemsInCart = useMemo(
    () => cart.filter((c) => furnitureById[c.furnitureId]?.appliesCountertop).length,
    [cart, furnitureById]
  );

  const settings = settingsLike(catalog);
  const ivaPct = settings.ivaRate * 100;
  const distPct = effectiveDiscount * 100;
  const pctLabel = (v: number) => `${v % 1 === 0 ? v : v.toFixed(1)}%`;

  const canSave = clientName.trim().length > 0 && cart.length > 0 && !saving;

  /* ----- operaciones del carrito ----- */
  function addToCart(id: string) {
    setCart((prev) =>
      prev.some((c) => c.furnitureId === id) ? prev : [...prev, { furnitureId: id, qty: 1 }]
    );
  }
  function changeQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.furnitureId === id ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  }
  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((c) => c.furnitureId !== id));
  }
  function resetForm() {
    setEditingQuotation(null);
    hydratedIdRef.current = null;
    setTitle('');
    setCart([]);
    setClientId('none');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setNotes('');
    setCountertopId('none');
    setOverrideStr('');
    setApplyDistributor(false);
    setExtraOpen(false);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const parsedOverride = Number(overrideStr);
      const parsedFactor = Number(factorStr);
      const parsedLabor = Number(laborStr);
      const payload: QuotationInput = {
        clientId: clientId !== 'none' ? clientId : null,
        clientName: clientName.trim(),
        title: title.trim() || null,
        clientPhone: clientPhone.trim() || null,
        clientEmail: clientEmail.trim() || null,
        notes: notes.trim() || null,
        finish: effectiveFinish,
        countertopMaterialId: countertopId !== 'none' ? countertopId : null,
        countertopMlOverride:
          overrideStr.trim() !== '' && Number.isFinite(parsedOverride) && parsedOverride > 0
            ? parsedOverride
            : null,
        applyDistributor,
        distributorDiscount: applyDistributor ? effectiveDiscount : undefined,
        factor:
          Number.isFinite(parsedFactor) && parsedFactor > 0 ? parsedFactor : undefined,
        laborPerUnit:
          Number.isFinite(parsedLabor) && parsedLabor >= 0 ? parsedLabor : undefined,
        items: cart.map((c) => ({ furnitureId: c.furnitureId, qty: c.qty })),
      };
      const isEdit = !!editingQuotation;
      const res = await fetch(isEdit ? `/api/quotations/${editingQuotation.id}` : '/api/quotations', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al guardar la cotización');
      toast.success(
        isEdit
          ? editingQuotation!.orderCode
            ? `Pedido ${editingQuotation!.orderCode} actualizado — Rev. ${data.rev}`
            : `Cotización ${data.folio} actualizada`
          : `Cotización ${data.folio} guardada`
      );
      resetForm();
      await fetchQuotations();
      onNavigate?.('cotizaciones');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la cotización');
    } finally {
      setSaving(false);
    }
  }

  if (!catalog) {
    return (
      <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" aria-hidden />
          <p className="text-sm">Cargando catálogo…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px] items-start">
      {editingQuotation && (
        <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-sm text-amber-900">
            Editando{' '}
            <strong>
              {editingQuotation.orderCode
                ? `pedido ${editingQuotation.orderCode} (Rev. ${editingQuotation.rev})`
                : editingQuotation.folio}
            </strong>
            {editingQuotation.orderCode && ' — al guardar se creará una revisión'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditingQuotation(null)}
          >
            Cancelar edición
          </Button>
        </div>
      )}
      {/* ================= Columna izquierda: selector de muebles ================= */}
      <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Armchair className="w-4 h-4 text-amber-600" aria-hidden />
                Catálogo de muebles
              </CardTitle>
              <CardDescription className="text-xs">
                Toca «+» para agregar muebles a la cotización
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-stone-100 text-stone-600 border border-stone-200 shrink-0">
              {filtered.length} de {catalog.furniture.length}
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código o nombre…"
                aria-label="Buscar muebles por código o nombre"
                className="pl-8 h-9 bg-white border-stone-300"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger
                size="sm"
                className="w-full sm:w-[210px] bg-white border-stone-300 h-9"
                aria-label="Filtrar por categoría"
              >
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div
            className={cn('max-h-[70vh] overflow-y-auto -mx-1 px-1 space-y-1', SCROLL_XS)}
            role="list"
            aria-label="Lista de muebles del catálogo"
          >
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                <Search className="w-8 h-8 text-stone-300" aria-hidden />
                <p className="text-sm text-stone-500">
                  Sin resultados para «{search.trim()}»
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setCategory('all');
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            )}

            {filtered.map((f) => {
              const inCart = cart.find((c) => c.furnitureId === f.id);
              return (
                <div
                  key={f.id}
                  role="listitem"
                  className="flex items-center gap-3 p-2 rounded-lg border border-transparent hover:border-stone-200 hover:bg-stone-50 transition-colors"
                >
                  {/* Miniatura */}
                  <div className="w-12 h-12 shrink-0 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center">
                    {f.imageUrl ? (
                      <img
                        src={f.imageUrl}
                        alt={`Imagen de ${f.name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Armchair className="w-6 h-6 text-stone-400" aria-hidden />
                    )}
                  </div>

                  {/* Código + nombre + precio del acabado actual */}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-stone-500 leading-tight">{f.code}</p>
                    <p className="text-sm font-medium leading-snug line-clamp-1" title={f.name}>
                      {f.name}
                    </p>
                    <p className="text-xs font-semibold text-amber-700 tabular-nums">
                      {money(priceOf(catalog, f, effectiveFinish))}
                      <span className="font-normal text-stone-400"> / unidad</span>
                    </p>
                  </div>

                  {/* Agregar / stepper */}
                  {!inCart ? (
                    <Button
                      size="icon"
                      aria-label={`Agregar ${f.name}`}
                      title="Agregar a la cotización"
                      onClick={() => addToCart(f.id)}
                      className="h-8 w-8 shrink-0 bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
                    >
                      <Plus className="w-4 h-4" aria-hidden />
                    </Button>
                  ) : (
                    <div
                      className="flex items-center shrink-0 rounded-lg border border-stone-300 bg-white overflow-hidden"
                      role="group"
                      aria-label={`Cantidad de ${f.name}`}
                    >
                      <button
                        type="button"
                        onClick={() => changeQty(f.id, -1)}
                        aria-label={
                          inCart.qty <= 1
                            ? `Eliminar ${f.name} de la cotización`
                            : `Quitar una unidad de ${f.name}`
                        }
                        title={inCart.qty <= 1 ? 'Eliminar de la cotización' : 'Quitar una unidad'}
                        className={cn(
                          'h-8 w-8 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                          inCart.qty <= 1
                            ? 'text-red-500 hover:bg-red-50 hover:text-red-600'
                            : 'text-stone-600 hover:bg-stone-100'
                        )}
                      >
                        <Minus className="w-3.5 h-3.5" aria-hidden />
                      </button>
                      <span className="w-7 text-center text-sm font-bold tabular-nums">
                        {inCart.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQty(f.id, 1)}
                        aria-label={`Agregar una unidad más de ${f.name}`}
                        className="h-8 w-8 flex items-center justify-center text-stone-600 hover:bg-stone-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ================= Columna derecha: panel de cotización ================= */}
      <Card className="bg-white rounded-xl border border-stone-200 shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4 text-amber-600" aria-hidden />
            Nueva cotización
          </CardTitle>
          <CardDescription className="text-xs">
            Los totales se recalculan en vivo
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Cliente */}
          <section className="space-y-2" aria-label="Datos del cliente">
            <div className="space-y-1.5">
              <Label htmlFor="quote-title" className="text-xs text-stone-600">
                Nombre de la cotización (opcional)
              </Label>
              <Input
                id="quote-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Cocina Depto Roma — isla + entrepaños"
                className="h-9 border-stone-300"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-registered" className="text-xs text-stone-600">
                Cliente del CRM
              </Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger
                  id="client-registered"
                  size="sm"
                  className="w-full bg-white border-stone-300"
                  aria-label="Seleccionar cliente registrado"
                >
                  <SelectValue placeholder="Cliente ocasional (sin registro)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Cliente ocasional (sin registro)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClient && (selectedClient.phone || selectedClient.email) && (
                <p className="text-[11px] text-stone-500">
                  Contacto: {[selectedClient.phone, selectedClient.email].filter(Boolean).join(' · ')}
                </p>
              )}
              {clientHasOwnDiscount && (
                <p className="text-[11px] font-medium text-emerald-700">
                  Descuento propio del cliente: −{pctLabel(selectedClient!.discountPercent!)} (se aplica al activar
                  precio distribuidor)
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-name" className="text-xs text-stone-600">
                Nombre <span className="text-red-600" aria-hidden>*</span>
              </Label>
              <Input
                id="client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={selectedClient ? 'Nombre del cliente' : 'Nombre del cliente ocasional'}
                required
                aria-required="true"
                readOnly={!!selectedClient}
                className={cn('h-9 border-stone-300', selectedClient && 'bg-stone-50 text-stone-500')}
              />
              {!selectedClient && (
                <p className="text-[11px] text-stone-400">
                  Cliente nuevo o de una sola vez — no queda en el CRM. Regístralo para dar
                  seguimiento.
                </p>
              )}
            </div>

            <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                  aria-expanded={extraOpen}
                >
                  <ChevronDown
                    className={cn('w-3.5 h-3.5 transition-transform', extraOpen && 'rotate-180')}
                    aria-hidden
                  />
                  Teléfono, correo y notas (opcional)
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2.5 pt-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="client-phone" className="text-xs text-stone-600">
                    Teléfono
                  </Label>
                  <Input
                    id="client-phone"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ej. 55 1234 5678"
                    type="tel"
                    readOnly={!!selectedClient}
                    className={cn('h-9 border-stone-300', selectedClient && 'bg-stone-50 text-stone-500')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-email" className="text-xs text-stone-600">
                    Correo electrónico
                  </Label>
                  <Input
                    id="client-email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="cliente@correo.com"
                    type="email"
                    readOnly={!!selectedClient}
                    className={cn('h-9 border-stone-300', selectedClient && 'bg-stone-50 text-stone-500')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quote-notes" className="text-xs text-stone-600">
                    Notas
                  </Label>
                  <Textarea
                    id="quote-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observaciones para esta cotización…"
                    rows={2}
                    className="border-stone-300 min-h-0"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>

          <Separator />

          {/* Acabado */}
          <section className="space-y-2" aria-label="Acabado">
            <Label htmlFor="finish-select" className="text-xs text-stone-600">
              Acabado / color de frentes
            </Label>
            <Select
              value={effectiveFinish}
              onValueChange={(v) => setFinish(v)}
            >
              <SelectTrigger id="finish-select" aria-label="Seleccionar acabado">
                <SelectValue placeholder="Acabado" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {profileSelected?.frontMaterial && (
              <p className="text-[11px] text-stone-500">
                Frentes: {profileSelected.frontMaterial.name} · Interior:{' '}
                {profileSelected.usePieceMaterials
                  ? 'según despiece'
                  : profileSelected.bodyMaterial?.name ?? '—'}
              </p>
            )}
          </section>

          {/* Cubierta */}
          <section className="space-y-2" aria-label="Cubierta">
            <Label htmlFor="countertop-select" className="text-xs text-stone-600">
              Cubierta
            </Label>
            <Select value={countertopId} onValueChange={setCountertopId}>
              <SelectTrigger
                id="countertop-select"
                size="sm"
                className="w-full bg-white border-stone-300"
                aria-label="Seleccionar material de cubierta"
              >
                <SelectValue placeholder="Sin cubierta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">SIN CUBIERTA</SelectItem>
                {countertopOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} — {money(m.costPerMl || 0)}/ML
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {countertop && (
              <div className="rounded-lg bg-stone-50 border border-stone-200 p-2.5 space-y-2">
                {autoMl > 0 ? (
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Largo calculado: <span className="font-semibold">{num(autoMl)} m</span> →
                    cobrable: <span className="font-semibold text-amber-700">{num(totals.countertopMlBillable)} m</span>{' '}
                    <span className="text-stone-400">
                      (múltiplos de {num(catalog.settings.countertopMultipleM)} m)
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-stone-500">
                    Ninguno de los muebles seleccionados aplica cubierta.
                  </p>
                )}
                <div className="space-y-1">
                  <Label htmlFor="ml-override" className="text-xs text-stone-600">
                    Sobrescribir ML (opcional)
                  </Label>
                  <Input
                    id="ml-override"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={overrideStr}
                    onChange={(e) => setOverrideStr(e.target.value)}
                    placeholder="Automático"
                    aria-label="Sobrescribir metros lineales de cubierta"
                    className="h-8 border-stone-300"
                  />
                </div>
              </div>
            )}
            {!countertop && countertopItemsInCart > 0 && (
              <p className="text-xs text-stone-500">
                {countertopItemsInCart}{' '}
                {countertopItemsInCart === 1 ? 'mueble aplica' : 'muebles aplican'} cubierta en tu
                selección.
              </p>
            )}
          </section>

          <Separator />

          {/* Ajustes de precios */}
          <section className="space-y-3" aria-label="Ajustes de precios">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="factor-input" className="text-xs text-stone-600">
                  Factor de venta
                </Label>
                <Input
                  id="factor-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.1}
                  value={factorStr}
                  onChange={(e) => setFactorStr(e.target.value)}
                  className="h-9 border-stone-300"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="labor-input" className="text-xs text-stone-600">
                  Mano de obra / unidad
                </Label>
                <Input
                  id="labor-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={laborStr}
                  onChange={(e) => setLaborStr(e.target.value)}
                  className="h-9 border-stone-300"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <div className="min-w-0">
                <Label htmlFor="dist-switch" className="text-sm font-medium cursor-pointer">
                  Precio distribuidor (−{pctLabel(distPct)})
                </Label>
                <p className="text-[11px] text-stone-500">Aplica descuento a venta e IVA</p>
              </div>
              <Switch
                id="dist-switch"
                checked={applyDistributor}
                onCheckedChange={setApplyDistributor}
                aria-label="Aplicar precio distribuidor"
                className="data-[state=checked]:bg-brand-600"
              />
            </div>
          </section>

          <Separator />

          {/* Partidas del carrito */}
          <section className="space-y-1" aria-label="Partidas de la cotización">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-stone-600">Partidas</Label>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="bg-stone-100 text-stone-600 border border-stone-200">
                  {cart.length} {cart.length === 1 ? 'línea' : 'líneas'}
                </Badge>
                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCart([])}
                    aria-label="Vaciar todas las partidas"
                    title="Quitar todos los muebles"
                    className="h-7 px-2 text-xs text-stone-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3 mr-1" aria-hidden />
                    Vaciar
                  </Button>
                )}
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <ShoppingCart className="w-8 h-8 text-stone-300" aria-hidden />
                <p className="text-sm text-stone-500">Selecciona muebles del catálogo</p>
              </div>
            ) : (
              <div className={cn('max-h-56 overflow-y-auto divide-y divide-stone-100', SCROLL_XS)}>
                {cart.map((c, idx) => {
                  const f = furnitureById[c.furnitureId];
                  const per = totals.perItem[idx];
                  if (!f || !per) return null;
                  return (
                    <div key={c.furnitureId} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight line-clamp-1" title={f.name}>
                          {f.name}
                        </p>
                        <p className="font-mono text-[11px] text-stone-500">
                          {f.code} · {money(per.unitPrice)} c/u
                        </p>
                      </div>
                      <div
                        className="flex items-center shrink-0 rounded-md border border-stone-300 bg-white overflow-hidden"
                        role="group"
                        aria-label={`Cantidad de ${f.name}`}
                      >
                        <button
                          type="button"
                          onClick={() => changeQty(c.furnitureId, -1)}
                          aria-label={
                            c.qty <= 1
                              ? `Eliminar ${f.name} de la cotización`
                              : `Quitar una unidad de ${f.name}`
                          }
                          title={c.qty <= 1 ? 'Eliminar de la cotización' : 'Quitar una unidad'}
                          className={cn(
                            'h-7 w-7 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                            c.qty <= 1
                              ? 'text-red-500 hover:bg-red-50 hover:text-red-600'
                              : 'text-stone-600 hover:bg-stone-100'
                          )}
                        >
                          <Minus className="w-3 h-3" aria-hidden />
                        </button>
                        <span className="w-6 text-center text-xs font-bold tabular-nums">
                          {c.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQty(c.furnitureId, 1)}
                          aria-label={`Agregar una unidad más de ${f.name}`}
                          className="h-7 w-7 flex items-center justify-center text-stone-600 hover:bg-stone-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          <Plus className="w-3 h-3" aria-hidden />
                        </button>
                      </div>
                      <span className="w-24 text-right text-sm font-semibold tabular-nums shrink-0">
                        {money(per.total)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(c.furnitureId)}
                        aria-label={`Eliminar ${f.name} de la cotización`}
                        title="Eliminar de la cotización"
                        className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          {/* Totales en vivo */}
          <section className="space-y-1" aria-label="Totales de la cotización" aria-live="polite">
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">Costo directo</span>
              <span className="tabular-nums">{money(totals.furnitureCost)}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">Unidades</span>
              <span className="tabular-nums">{num(totals.totalUnits, 0)}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">Mano de obra</span>
              <span className="tabular-nums">{money(totals.laborTotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-stone-900 py-1">
              <span>Venta de muebles</span>
              <span className="tabular-nums">{money(totals.furnitureSale)}</span>
            </div>

            {countertop && totals.countertopSale > 0 && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-stone-500 truncate mr-2" title={countertop.name}>
                  Cubierta {countertop.name} · {num(totals.countertopMlBillable)} m ×{' '}
                  {money(countertop.costPerMl || 0)}
                </span>
                <span className="tabular-nums shrink-0 font-semibold">
                  {money(totals.countertopSale)}
                </span>
              </div>
            )}

            <Separator className="my-1.5" />
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">Subtotal</span>
              <span className="tabular-nums">{money(totals.subtotalSale)}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">IVA ({pctLabel(ivaPct)})</span>
              <span className="tabular-nums">{money(totals.ivaAmount)}</span>
            </div>
            <div className="flex justify-between items-baseline py-1.5">
              <span className="text-sm font-bold text-stone-900">TOTAL (CON IVA)</span>
              <span className="text-xl font-bold text-amber-700 tabular-nums">
                {money(totals.totalWithIva)}
              </span>
            </div>

            {applyDistributor && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Precio distribuidor (−{pctLabel(distPct)})
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Venta distribuidor</span>
                  <span className="tabular-nums">{money(totals.distributorFurniture)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">IVA ({pctLabel(ivaPct)})</span>
                  <span className="tabular-nums">{money(totals.distributorIva)}</span>
                </div>
                <Separator className="bg-emerald-200" />
                <div className="flex justify-between text-sm font-bold text-emerald-700">
                  <span>Total distribuidor</span>
                  <span className="tabular-nums">{money(totals.distributorTotal)}</span>
                </div>
              </div>
            )}
          </section>

          {/* Guardar */}
          <Button
            onClick={handleSave}
            disabled={!canSave}
            aria-label="Guardar cotización"
            className="w-full h-11 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" aria-hidden />
                {editingQuotation ? 'Guardar cambios' : 'Guardar cotización'}
              </>
            )}
          </Button>
          {!clientName.trim() && (
            <p className="text-[11px] text-center text-stone-400">
              Escribe el nombre del cliente para habilitar el guardado
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
