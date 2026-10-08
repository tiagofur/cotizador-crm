'use client';

/* ============================================================
 * MaquilaTab — Cotizador de maquila para carpinteros
 * Dos modos de captura:
 *  · Despiece (predeterminado): el cliente registra pieza por pieza
 *    (cantidad, mm, material, veta, cantos L1/L2/A1/A2) o importa el
 *    Excel de formato; el sistema estima hojas por material y cortes.
 *  · Tableros: venta directa de tableros completos al costo de hoja
 *    con ml de cintilla capturados a mano.
 * Derecha: cliente, materiales estimados/directos, servicios
 * (corte por pasada, encintado sobre la Σ de cintilla) y totales.
 * Guarda documentos kind='MAQUILA' (folio MAQ-) que entran al mismo
 * flujo de pedidos.
 * ============================================================ */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TabProps } from '@/app/page';
import { useAppStore, settingsLike } from '@/lib/store';
import { computeMaquilaTotals, planFromPieces, type MaquilaLineLike, type MaquilaPieceLike } from '@/lib/maquila-pricing';
import type { QuotationInput, ClientDTO, MaterialDTO } from '@/lib/types';
import { money, num, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import {
  Calculator,
  ChevronDown,
  FileDown,
  FileUp,
  Layers,
  Loader2,
  Package,
  Plus,
  Scissors,
  Search,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import PiecesEditor, { emptyPiece, type PieceDraft } from '@/components/maquila/pieces-editor';
import { cn } from '@/lib/utils';

/** Normaliza texto para búsqueda (minúsculas y sin acentos) */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Línea del modo tableros: strings para permitir captura intermedia */
interface LineDraft {
  materialId: string;
  sheets: string; // tableros completos
  ml: string; // metros de cintilla
}

function parsePositive(s: string): number {
  const n = Number(s.replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function MaquilaTab({ onNavigate }: TabProps) {
  const catalog = useAppStore((s) => s.catalog);
  const fetchQuotations = useAppStore((s) => s.fetchQuotations);
  const editingQuotation = useAppStore((st) => st.editingQuotation);
  const setEditingQuotation = useAppStore((st) => st.setEditingQuotation);

  /* ----- cliente ----- */
  const clients = useAppStore((s) => s.clients);
  const fetchClients = useAppStore((s) => s.fetchClients);
  const [clientId, setClientId] = useState<string>('none');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');
  const [extraOpen, setExtraOpen] = useState(false);

  const selectedClient = useMemo(
    () => (clientId !== 'none' ? (clients.find((c) => c.id === clientId) ?? null) : null),
    [clientId, clients]
  );

  /* ----- modo de captura y datos ----- */
  const [mode, setMode] = useState<'despiece' | 'tableros'>('despiece');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [pieces, setPieces] = useState<PieceDraft[]>([]);

  /* ----- servicios y tarifas ----- */
  const [cutQty, setCutQty] = useState('');
  const [cutRateStr, setCutRateStr] = useState('');
  const [bandRateStr, setBandRateStr] = useState('');
  const [ratesOpen, setRatesOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /* Tarifas iniciales desde Configuración (una sola vez) */
  const initialized = useRef(false);
  useEffect(() => {
    if (catalog && !initialized.current) {
      initialized.current = true;
      setCutRateStr(String(catalog.settings.cutCostPerPass ?? 0));
      setBandRateStr(String(catalog.settings.edgeBandServiceCostMl ?? 0));
    }
  }, [catalog]);

  const boardMaterials: MaterialDTO[] = useMemo(
    () => (catalog?.materials ?? []).filter((m) => m.type === 'TABLERO' && m.active),
    [catalog]
  );

  const materialById = useMemo(() => {
    const map: Record<string, MaterialDTO> = {};
    for (const m of boardMaterials) map[m.id] = m;
    return map;
  }, [boardMaterials]);

  const filteredMaterials = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return boardMaterials;
    return boardMaterials.filter((m) => norm(m.name).includes(q) || norm(m.thickness ?? '').includes(q));
  }, [boardMaterials, search]);

  /* ----- modo edición: hidratar con la cotización de maquila a editar ----- */
  const hydratedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const eq = editingQuotation;
    if (!eq || eq.kind !== 'MAQUILA' || hydratedIdRef.current === eq.id || !catalog) return;
    hydratedIdRef.current = eq.id;
    setTitle(eq.title ?? '');
    setClientId(eq.clientId ?? 'none');
    setClientName(eq.clientName);
    setClientPhone(eq.clientPhone ?? '');
    setClientEmail(eq.clientEmail ?? '');
    setNotes(eq.notes ?? '');
    setCutRateStr(String(eq.cutUnitCost));
    setBandRateStr(String(eq.edgeBandUnitCost));

    // Las líneas derivadas/estimadas se hidratan SIEMPRE: al cambiar a Tableros
    // la tienda encuentra las hojas estimadas precargadas y solo ajusta a las reales
    let dropped = 0;
    const drafts: LineDraft[] = [];
    for (const ln of eq.maquilaLines) {
      if (materialById[ln.materialId]) {
        drafts.push({
          materialId: ln.materialId,
          sheets: String(ln.sheetsQty),
          ml: String(ln.edgeBandMl),
        });
      } else {
        dropped++;
      }
    }
    setLines(drafts);
    if (dropped > 0) {
      toast.warning(`${dropped} línea(s) usan materiales que ya no existen en el catálogo y se omitieron`);
    }

    if (eq.maquilaPieces?.length) {
      // Documento con despiece: hojas/pasadas son estimadas hasta que la tienda las ajuste
      setMode('despiece');
      setPieces(
        eq.maquilaPieces.map((p) => ({
          name: p.name,
          qty: String(p.qty),
          length: String(p.length),
          width: String(p.width),
          materialId: p.materialId ?? '',
          grain: p.grain,
          bandL1: p.bandL1,
          bandL2: p.bandL2,
          bandA1: p.bandA1,
          bandA2: p.bandA2,
          notes: p.notes ?? '',
        }))
      );
      // cutQty vacío si es estimado: en despiece, vacío = usar el estimado
      setCutQty(eq.cutQty > 0 && !eq.cutsEstimated ? String(eq.cutQty) : '');
      return;
    }

    setMode('tableros');
    setPieces([]);
    setCutQty(eq.cutQty > 0 ? String(eq.cutQty) : '');
  }, [editingQuotation, materialById, catalog]);

  /* Puente despiece → tableros: precarga pasadas estimadas y avisa qué ajustar */
  const bridgeCutRef = useRef<string>('');
  function switchMode(next: 'despiece' | 'tableros') {
    if (next === mode) return;
    if (next === 'tableros' && editingQuotation?.kind === 'MAQUILA' && editingQuotation.maquilaPieces.length) {
      if (!cutQty.trim() && (editingQuotation.cutQty ?? 0) > 0) {
        bridgeCutRef.current = String(editingQuotation.cutQty);
        setCutQty(bridgeCutRef.current);
      }
      toast.info('Hojas y pasadas estimadas precargadas — reemplázalas por las reales del optimizador');
    } else if (next === 'despiece' && bridgeCutRef.current && cutQty === bridgeCutRef.current) {
      // Volvió sin tocar: quita el estimado precargado para no marcarlo como real
      bridgeCutRef.current = '';
      setCutQty('');
    }
    setMode(next);
  }

  /* ----- despiece: plan de materiales estimado en vivo ----- */
  const plan = useMemo(() => {
    if (mode !== 'despiece') return null;
    const settings = settingsLike(catalog);
    const pieceLikes: MaquilaPieceLike[] = pieces.map((p) => ({
      name: p.name,
      qty: parsePositive(p.qty) || 0,
      length: parsePositive(p.length),
      width: parsePositive(p.width),
      materialId: p.materialId || null,
      grain: p.grain,
      bandL1: p.bandL1,
      bandL2: p.bandL2,
      bandA1: p.bandA1,
      bandA2: p.bandA2,
      material: p.materialId ? materialById[p.materialId] ?? null : null,
    }));
    return planFromPieces(pieceLikes, {
      wasteFactorStandard: settings.wasteFactorStandard,
      wasteFactorMaderado: settings.wasteFactorMaderado,
      avgCutsPerSheet: catalog?.settings.avgCutsPerSheet ?? 0,
    });
  }, [mode, pieces, materialById, catalog]);

  /* ----- totales en vivo ----- */
  const totals = useMemo(() => {
    const settings = settingsLike(catalog);
    const parsedCut = Number(cutRateStr.replace(',', '.'));
    const parsedBand = Number(bandRateStr.replace(',', '.'));

    let maquilaLines: MaquilaLineLike[];
    if (mode === 'despiece') {
      maquilaLines = (plan?.perMaterial ?? []).map((m) => ({
        materialId: m.materialId,
        sheetsQty: m.sheetsQty,
        edgeBandMl: m.edgeBandMl,
        material: m.material,
      }));
    } else {
      maquilaLines = lines
        .filter((l) => materialById[l.materialId])
        .map((l) => ({
          materialId: l.materialId,
          sheetsQty: parsePositive(l.sheets),
          edgeBandMl: parsePositive(l.ml),
          material: materialById[l.materialId],
        }));
    }

    const cutEffective = parsePositive(cutQty) || (mode === 'despiece' ? (plan?.estimatedCuts ?? 0) : 0);
    return computeMaquilaTotals({
      lines: maquilaLines,
      cutQty: cutEffective,
      cutCostPerPass: Number.isFinite(parsedCut) && parsedCut >= 0 ? parsedCut : (settings.cutCostPerPass ?? 0),
      edgeBandServiceCostMl:
        Number.isFinite(parsedBand) && parsedBand >= 0 ? parsedBand : (settings.edgeBandServiceCostMl ?? 0),
      ivaRate: settings.ivaRate,
    });
  }, [catalog, mode, lines, plan, materialById, cutQty, cutRateStr, bandRateStr]);

  const settings = settingsLike(catalog);
  const ivaPct = settings.ivaRate * 100;
  const cutsFromPlan = mode === 'despiece' && !cutQty.trim() && (plan?.estimatedCuts ?? 0) > 0;

  const canSave =
    clientName.trim().length > 0 &&
    totals.perLine.length > 0 &&
    !saving &&
    (mode === 'tableros' || pieces.some((p) => p.name.trim() && p.materialId && parsePositive(p.length) > 0 && parsePositive(p.width) > 0));

  /* ----- operaciones de líneas (modo tableros) ----- */
  function addMaterial(id: string) {
    setLines((prev) =>
      prev.some((l) => l.materialId === id) ? prev : [...prev, { materialId: id, sheets: '1', ml: '' }]
    );
  }
  function setLine(materialId: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.materialId === materialId ? { ...l, ...patch } : l)));
  }
  function removeLine(materialId: string) {
    setLines((prev) => prev.filter((l) => l.materialId !== materialId));
  }

  /* ----- importación del Excel de formato ----- */
  async function handleImport(file: File) {
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/maquila/excel', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo importar el archivo');
      const imported = (data.pieces as {
        name: string; qty: number; length: number; width: number; materialId: string;
        grain?: boolean; bandL1?: boolean; bandL2?: boolean; bandA1?: boolean; bandA2?: boolean; notes?: string | null;
      }[]).map((p) => ({
        name: p.name,
        qty: String(p.qty),
        length: String(p.length),
        width: String(p.width),
        materialId: p.materialId,
        grain: !!p.grain,
        bandL1: !!p.bandL1,
        bandL2: !!p.bandL2,
        bandA1: !!p.bandA1,
        bandA2: !!p.bandA2,
        notes: p.notes ?? '',
      }));
      let replace = pieces.length === 0;
      if (!replace) {
        replace = window.confirm(
          `Ya hay ${pieces.length} pieza(s) capturadas.\n\nAceptar: reemplazarlas con las ${imported.length} del archivo.\nCancelar: agregarlas al final.`
        );
      }
      setPieces((prev) => (replace ? imported : [...prev, ...imported]));
      if (data.errors?.length) {
        toast.warning(`${imported.length} pieza(s) importadas · ${data.errors.length} fila(s) con problema: ${data.errors.slice(0, 2).join(' · ')}`);
      } else {
        toast.success(`${imported.length} pieza(s) importadas del Excel`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al importar el archivo');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function resetForm() {
    setEditingQuotation(null);
    hydratedIdRef.current = null;
    setTitle('');
    setMode('despiece');
    setPieces([]);
    setLines([]);
    setCutQty('');
    setClientId('none');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setNotes('');
    setExtraOpen(false);
    if (catalog) {
      setCutRateStr(String(catalog.settings.cutCostPerPass ?? 0));
      setBandRateStr(String(catalog.settings.edgeBandServiceCostMl ?? 0));
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const esDespiece = mode === 'despiece';
      const cutCapturado = cutQty.trim() !== '';
      const payload: QuotationInput = {
        clientId: clientId !== 'none' ? clientId : null,
        clientName: clientName.trim(),
        title: title.trim() || null,
        clientPhone: clientPhone.trim() || null,
        clientEmail: clientEmail.trim() || null,
        notes: notes.trim() || null,
        kind: 'MAQUILA',
        finish: 'BLANCO',
        applyDistributor: false,
        items: [],
        ...(esDespiece
          ? {
              maquilaPieces: pieces
                .filter((p) => p.name.trim() && p.materialId)
                .map((p) => ({
                  name: p.name.trim(),
                  qty: Math.max(1, Math.round(parsePositive(p.qty) || 1)),
                  length: parsePositive(p.length),
                  width: parsePositive(p.width),
                  materialId: p.materialId,
                  grain: p.grain,
                  bandL1: p.bandL1,
                  bandL2: p.bandL2,
                  bandA1: p.bandA1,
                  bandA2: p.bandA2,
                  notes: p.notes.trim() || null,
                })),
              cutQty: cutCapturado ? parsePositive(cutQty) : undefined,
              cutsAreReal: cutCapturado,
            }
          : {
              maquilaLines: lines.map((l) => ({
                materialId: l.materialId,
                sheetsQty: parsePositive(l.sheets),
                edgeBandMl: parsePositive(l.ml),
              })),
              cutQty: parsePositive(cutQty),
            }),
        cutCostPerPass: parsePositive(cutRateStr),
        edgeBandServiceCostMl: parsePositive(bandRateStr),
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
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" aria-hidden />
          <p className="text-sm">Cargando catálogo…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px] items-start">
      {editingQuotation?.kind === 'MAQUILA' && (
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

      {/* ================= Columna izquierda: despiece o selector de tableros ================= */}
      <Card className="lg:max-h-[calc(100vh-12rem)]">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                {mode === 'despiece' ? (
                  <>
                    <Scissors className="w-4 h-4 text-amber-600" aria-hidden />
                    Despiece del cliente
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 text-amber-600" aria-hidden />
                    Tableros del catálogo
                  </>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {mode === 'despiece'
                  ? 'Pieza por pieza o importando el Excel · las hojas las estima el sistema'
                  : 'Venta directa de tableros al costo de hoja'}
              </CardDescription>
            </div>

            {/* Switch de modo de captura */}
            <div className="flex gap-1 rounded-lg bg-stone-100 p-1 border border-stone-200 shrink-0">
              {([
                { id: 'despiece', label: 'Despiece' },
                { id: 'tableros', label: 'Tableros' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => switchMode(t.id)}
                  aria-pressed={mode === t.id}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                    mode === t.id
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'despiece' ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open('/api/maquila/excel', '_blank')}
                className="border-stone-200"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-600" aria-hidden />
                Plantilla Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="border-stone-200"
              >
                {importing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                ) : (
                  <FileUp className="w-3.5 h-3.5 text-amber-600" aria-hidden />
                )}
                Importar Excel
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                aria-label="Archivo de Excel del cliente"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImport(f);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar tablero por nombre o espesor…"
                  aria-label="Buscar tablero por nombre o espesor"
                  className="pl-8 h-9 bg-white border-stone-200"
                />
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
          {mode === 'despiece' ? (
            <PiecesEditor pieces={pieces} materials={boardMaterials} onChange={setPieces} />
          ) : (
            <div
              className={cn('max-h-[70vh] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto -mx-1 px-1 space-y-1')}
              role="list"
              aria-label="Lista de tableros del catálogo"
            >
              {filteredMaterials.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                  <Search className="w-8 h-8 text-stone-300" aria-hidden />
                  <p className="text-sm text-stone-500">
                    Sin resultados para «{search.trim()}»
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearch('')}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              )}

              {filteredMaterials.map((m) => {
                const inLines = lines.find((l) => l.materialId === m.id);
                return (
                  <div
                    key={m.id}
                    role="listitem"
                    className="flex items-center gap-3 p-2 rounded-lg border border-transparent hover:border-stone-200 hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-12 h-12 shrink-0 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center">
                      <Package className="w-6 h-6 text-stone-400" aria-hidden />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug line-clamp-1" title={m.name}>
                        {m.name}
                      </p>
                      <p className="text-[11px] text-stone-500 leading-tight">
                        {[m.thickness, m.sheetWidth && m.sheetLength ? `${num(m.sheetWidth, 0)}×${num(m.sheetLength, 0)} mm` : null]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                      <p className="text-xs font-semibold text-amber-700 tabular-nums">
                        {money(m.sheetCost || 0)}
                        <span className="font-normal text-stone-400"> / tablero</span>
                        {(m.edgeBandCostMl || 0) > 0 && (
                          <span className="font-normal text-stone-500">
                            {' '}
                            · cintilla {money(m.edgeBandCostMl || 0)}/m
                          </span>
                        )}
                      </p>
                    </div>

                    {!inLines ? (
                      <Button
                        size="icon"
                        aria-label={`Agregar ${m.name}`}
                        title="Agregar a la cotización"
                        onClick={() => addMaterial(m.id)}
                        className="h-8 w-8 shrink-0 bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
                      >
                        <Plus className="w-4 h-4" aria-hidden />
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="shrink-0 bg-brand-50 text-brand-700 border border-brand-200">
                        Agregado
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================= Columna derecha: panel de cotización ================= */}
      <Card className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4 text-amber-600" aria-hidden />
            {editingQuotation?.kind === 'MAQUILA' ? 'Editar maquila' : 'Nueva cotización de maquila'}
          </CardTitle>
          <CardDescription className="text-xs">
            Tableros y cintilla al costo · servicios por corte y encintado
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Cliente */}
          <section className="space-y-2" aria-label="Datos del cliente">
            <div className="space-y-1.5">
              <Label htmlFor="maquila-title" className="text-xs text-stone-600">
                Nombre de la cotización (opcional)
              </Label>
              <Input
                id="maquila-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Despiece closet Carlos — 5 tableros"
                className="h-9 border-stone-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maquila-client-registered" className="text-xs text-stone-600">
                Cliente del CRM
              </Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger
                  id="maquila-client-registered"
                  size="sm"
                  className="w-full bg-white border-stone-200"
                  aria-label="Seleccionar cliente registrado"
                >
                  <SelectValue placeholder="Cliente ocasional (sin registro)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Cliente ocasional (sin registro)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.kind === 'CARPINTERO' ? `${c.name} · Carpintero` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClient && (selectedClient.phone || selectedClient.email) && (
                <p className="text-[11px] text-stone-500">
                  Contacto: {[selectedClient.phone, selectedClient.email].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maquila-client-name" className="text-xs text-stone-600">
                Nombre <span className="text-red-600" aria-hidden>*</span>
              </Label>
              <Input
                id="maquila-client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={selectedClient ? 'Nombre del cliente' : 'Nombre del cliente ocasional'}
                required
                aria-required="true"
                readOnly={!!selectedClient}
                className={cn('h-9 border-stone-200', selectedClient && 'bg-stone-50 text-stone-500')}
              />
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
                  <Label htmlFor="maquila-client-phone" className="text-xs text-stone-600">
                    Teléfono
                  </Label>
                  <Input
                    id="maquila-client-phone"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ej. 55 1234 5678"
                    type="tel"
                    readOnly={!!selectedClient}
                    className={cn('h-9 border-stone-200', selectedClient && 'bg-stone-50 text-stone-500')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maquila-client-email" className="text-xs text-stone-600">
                    Correo electrónico
                  </Label>
                  <Input
                    id="maquila-client-email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="cliente@correo.com"
                    type="email"
                    readOnly={!!selectedClient}
                    className={cn('h-9 border-stone-200', selectedClient && 'bg-stone-50 text-stone-500')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maquila-notes" className="text-xs text-stone-600">
                    Notas
                  </Label>
                  <Textarea
                    id="maquila-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observaciones para esta maquila…"
                    rows={2}
                    className="min-h-0"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>

          <Separator />

          {/* Materiales: estimados desde el despiece o capturados a mano */}
          <section className="space-y-1" aria-label="Materiales de la maquila">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-stone-600">
                {mode === 'despiece' ? 'Materiales estimados' : 'Materiales'}
              </Label>
              <div className="flex items-center gap-1">
                {mode === 'despiece' ? (
                  <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-200">
                    Hojas estimadas
                  </Badge>
                ) : (
                  <>
                    <Badge variant="secondary" className="bg-stone-100 text-stone-600 border border-stone-200">
                      {lines.length} {lines.length === 1 ? 'línea' : 'líneas'}
                    </Badge>
                    {lines.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLines([])}
                        aria-label="Quitar todos los materiales"
                        title="Quitar todos los materiales"
                        className="h-7 px-2 text-xs text-stone-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 mr-1" aria-hidden />
                        Vaciar
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {mode === 'despiece' ? (
              (plan?.perMaterial.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <Package className="w-8 h-8 text-stone-300" aria-hidden />
                  <p className="text-sm text-stone-500">
                    Captura o importa las piezas del cliente
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {plan!.perMaterial.map((m) => (
                    <div key={m.materialId} className="py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight" title={m.material?.name}>
                            {m.material?.name ?? 'Material'}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {m.piecesCount} {m.piecesCount === 1 ? 'pieza' : 'piezas'} · {num(m.areaM2)} m² ·{' '}
                            {num(m.edgeBandMl)} m cintilla
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                          {money(m.total)}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        <strong className="text-stone-700">{m.sheetsQty}</strong>{' '}
                        {m.sheetsQty === 1 ? 'hoja estimada' : 'hojas estimadas'}
                        {m.sheetM2 > 0 && (
                          <span className="text-stone-400">
                            {' '}
                            (hoja {num(m.sheetM2)} m² · {money(m.unitSheetCost)} c/u)
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                  <p className="pt-2 text-[11px] text-stone-400">
                    Las hojas reales las define el optimizador de la máquina; la tienda puede
                    ajustarlas al editar el documento.
                  </p>
                </div>
              )
            ) : lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Package className="w-8 h-8 text-stone-300" aria-hidden />
                <p className="text-sm text-stone-500">Agrega tableros del catálogo</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {lines.map((l, li) => {
                  const m = materialById[l.materialId];
                  const per = totals.perLine[li];
                  if (!m || !per) return null;
                  return (
                    <div key={l.materialId} className="py-2.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight" title={m.name}>
                            {m.name}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            Hoja {money(m.sheetCost || 0)}
                            {(m.edgeBandCostMl || 0) > 0 && ` · cintilla ${money(m.edgeBandCostMl || 0)}/m`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(l.materialId)}
                          aria-label={`Eliminar ${m.name} de la cotización`}
                          title="Eliminar de la cotización"
                          className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden />
                        </Button>
                      </div>
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-stone-500">Tableros</Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={l.sheets}
                            onChange={(e) => setLine(l.materialId, { sheets: e.target.value })}
                            aria-label={`Tableros de ${m.name}`}
                            className="h-8 border-stone-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-stone-500">Cintilla (m)</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.1}
                            value={l.ml}
                            onChange={(e) => setLine(l.materialId, { ml: e.target.value })}
                            placeholder="0"
                            aria-label={`Metros de cintilla de ${m.name}`}
                            className="h-8 border-stone-200"
                          />
                        </div>
                        <span className="text-sm font-semibold tabular-nums pb-1.5 whitespace-nowrap">
                          {money(per.total)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          {/* Servicios */}
          <section className="space-y-3" aria-label="Servicios de maquila">
            <div className="space-y-1.5">
              <Label htmlFor="cut-qty" className="text-xs text-stone-600">
                Cortes (pasadas de sierra)
              </Label>
              <Input
                id="cut-qty"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={cutQty}
                onChange={(e) => setCutQty(e.target.value)}
                placeholder={mode === 'despiece' && (plan?.estimatedCuts ?? 0) > 0 ? String(plan!.estimatedCuts) : '0'}
                className="h-9 w-full sm:max-w-[180px] border-stone-200"
              />
              <p className="text-[11px] text-stone-500">
                {money(totals.cutTotal)} · tarifa {money(parsePositive(cutRateStr))}/pasada
                {cutsFromPlan && (
                  <span className="text-amber-700 font-medium"> · estimado del despiece (ajústalo si lo conoces)</span>
                )}
              </p>
            </div>

            <Collapsible open={ratesOpen} onOpenChange={setRatesOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                  aria-expanded={ratesOpen}
                >
                  <ChevronDown
                    className={cn('w-3.5 h-3.5 transition-transform', ratesOpen && 'rotate-180')}
                    aria-hidden
                  />
                  Ajustar tarifas de esta cotización (opcional)
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-2 gap-3 pt-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="cut-rate" className="text-xs text-stone-600">
                    Tarifa por pasada
                  </Label>
                  <Input
                    id="cut-rate"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={1}
                    value={cutRateStr}
                    onChange={(e) => setCutRateStr(e.target.value)}
                    className="h-8 border-stone-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="band-rate" className="text-xs text-stone-600">
                    Tarifa encintado/ml
                  </Label>
                  <Input
                    id="band-rate"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={1}
                    value={bandRateStr}
                    onChange={(e) => setBandRateStr(e.target.value)}
                    className="h-8 border-stone-200"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>

          <Separator />

          {/* Totales en vivo */}
          <section className="space-y-1" aria-label="Totales de la maquila" aria-live="polite">
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">
                Tableros ({totals.perLine.reduce((a, l) => a + l.sheetsQty, 0)}
                {mode === 'despiece' ? ' est.' : ''})
              </span>
              <span className="tabular-nums">{money(totals.sheetsTotal)}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">Cintilla (material)</span>
              <span className="tabular-nums">{money(totals.bandMaterialTotal)}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">Servicio de corte</span>
              <span className="tabular-nums">{money(totals.cutTotal)}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">Encintado ({num(totals.edgeBandMlTotal)} m)</span>
              <span className="tabular-nums">{money(totals.edgeBandTotal)}</span>
            </div>

            <Separator className="my-1.5" />
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">Subtotal</span>
              <span className="tabular-nums">{money(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-stone-500">IVA ({ivaPct % 1 === 0 ? ivaPct : ivaPct.toFixed(1)}%)</span>
              <span className="tabular-nums">{money(totals.ivaAmount)}</span>
            </div>
            <div className="flex justify-between items-baseline py-1.5">
              <span className="text-sm font-bold text-stone-900">TOTAL (CON IVA)</span>
              <span className="text-xl font-bold text-amber-700 tabular-nums">
                {money(totals.totalWithIva)}
              </span>
            </div>
          </section>

          <p className="text-[11px] text-center text-stone-500">
            Entrega estimada: {formatDate(new Date(Date.now() + (settings.deliveryDaysMaquila ?? 7) * 86400000))} ·{' '}
            {settings.deliveryDaysMaquila ?? 7} días (editable al guardar)
          </p>

          {/* Guardar */}
          <Button
            onClick={handleSave}
            disabled={!canSave}
            aria-label="Guardar cotización de maquila"
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
                {editingQuotation?.kind === 'MAQUILA' ? 'Guardar cambios' : 'Guardar cotización'}
              </>
            )}
          </Button>
          {!clientName.trim() && (
            <p className="text-[11px] text-center text-stone-400">
              Escribe el nombre del cliente para habilitar el guardado
            </p>
          )}
          {clientName.trim() && totals.perLine.length === 0 && (
            <p className="text-[11px] text-center text-stone-400">
              {mode === 'despiece'
                ? 'Agrega piezas con su material para habilitar el guardado'
                : 'Agrega al menos un tablero para habilitar el guardado'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
