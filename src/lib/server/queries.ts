/* Helpers de servidor: consultas y cálculo de cotizaciones */
import { db } from '@/lib/db';
import { computeQuoteTotals, effectiveCostPerM2, type FurnitureLike, type MaterialLike, type Finish, type FinishProfileLike } from '@/lib/pricing';
import { computeMaquilaTotals, planFromPieces, type MaquilaLineLike, type MaquilaPieceLike } from '@/lib/maquila-pricing';
import type { Prisma } from '@prisma/client';

export const furnitureInclude = {
  pieces: { orderBy: { order: 'asc' as const }, include: { material: true } },
  hardwareItems: { include: { hardware: true } },
};

export const maquilaLineInclude = { material: true };

export const quotationInclude = {
  items: { orderBy: { id: 'asc' as const } },
  maquilaLines: { orderBy: [{ order: 'asc' as const }, { id: 'asc' as const }], include: maquilaLineInclude },
  maquilaPieces: { orderBy: [{ order: 'asc' as const }, { id: 'asc' as const }], include: { material: true } },
  countertopMaterial: true,
  client: { select: { id: true, name: true, stage: true } },
};

export async function getSettings() {
  let s = await db.settings.findUnique({ where: { id: 'default' } });
  if (!s) {
    s = await db.settings.create({ data: { id: 'default' } });
  }
  return s;
}

export async function getMaderadoMaterial(): Promise<MaterialLike | null> {
  const s = await getSettings();
  if (!s.maderadoMaterialId) return null;
  const m = await db.material.findUnique({ where: { id: s.maderadoMaterialId } });
  return m;
}

/** Perfil de acabado con materiales incluidos; fallback a Blanco/Maderado históricos */
export async function getFinishProfile(id: string | null | undefined): Promise<FinishProfileLike | null> {
  const pid = id ?? 'BLANCO';
  const p = await db.finishProfile.findUnique({
    where: { id: pid },
    include: { bodyMaterial: true, frontMaterial: true },
  });
  if (p) {
    return {
      id: p.id,
      name: p.name,
      usePieceMaterials: p.usePieceMaterials,
      bodyMaterial: p.bodyMaterial,
      frontMaterial: p.frontMaterial,
      active: p.active,
    };
  }
  if (pid === 'BLANCO') return { id: 'BLANCO', name: 'Blanco', usePieceMaterials: true };
  if (pid === 'MADERADO') {
    const mad = await getMaderadoMaterial();
    return { id: 'MADERADO', name: 'Maderado', usePieceMaterials: false, bodyMaterial: mad, frontMaterial: mad };
  }
  return null;
}

export function toFurnitureLike(
  f: Prisma.FurnitureGetPayload<{ include: typeof furnitureInclude }>
): FurnitureLike {
  return {
    id: f.id,
    code: f.code,
    name: f.name,
    category: f.category,
    width: f.width,
    height: f.height,
    depth: f.depth,
    appliesCountertop: f.appliesCountertop,
    countertopWidthM: f.countertopWidthM,
    pieces: f.pieces,
    hardwareItems: f.hardwareItems,
  };
}

export interface MaquilaPieceCreateInput {
  name: string;
  qty: number;
  length: number;
  width: number;
  materialId: string | null;
  grain?: boolean;
  bandL1?: boolean;
  bandL2?: boolean;
  bandA1?: boolean;
  bandA2?: boolean;
  notes?: string | null;
}

export interface MaquilaLineCreateInput {
  materialId: string;
  sheetsQty: number;
  edgeBandMl: number;
  notes?: string | null;
}

export interface QuotationCreateInput {
  clientId?: string | null;
  clientName: string;
  title?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  notes?: string | null;
  kind?: 'MUEBLE' | 'MAQUILA';
  finish: Finish;
  countertopMaterialId?: string | null;
  countertopMlOverride?: number | null;
  applyDistributor: boolean;
  /** Descuento distribuidor efectivo (0-1); default: el de Configuración */
  distributorDiscount?: number;
  factor?: number;
  laborPerUnit?: number;
  items: { furnitureId: string; qty: number }[];
  /** Maquila: líneas de material, pasadas de corte y overrides de tarifario */
  maquilaLines?: MaquilaLineCreateInput[];
  /** Maquila por despiece: piezas del cliente; el servidor estima hojas/cortes y deriva las líneas */
  maquilaPieces?: MaquilaPieceCreateInput[];
  /** true cuando cutQty capturado es el real (tienda); omítelo para estimar desde el despiece */
  cutsAreReal?: boolean;
  /** false cuando la tienda ya fijó las hojas reales tras optimizar (solo modo despiece) */
  sheetsEstimated?: boolean;
  cutQty?: number;
  cutCostPerPass?: number;
  edgeBandServiceCostMl?: number;
  /** Portal: crea el documento como SOLICITUD (pre-cotización) en vez de BORRADOR */
  source?: 'TIENDA' | 'PORTAL';
  /** Portal: los cortes vienen estimados (Σ hojas × avgCutsPerSheet), no capturados */
  cutsEstimated?: boolean;
  /** Fecha estimada de entrega ('yyyy-MM-dd' o ISO); al crear se aplica el plazo por tipo si se omite */
  estimatedDeliveryAt?: string | null;
  revisionNote?: string | null;
}

export async function nextFolio(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.quotation.count({ where: { kind: 'MUEBLE' } });
  return `COT-${year}-${String(count + 1).padStart(4, '0')}`;
}

/** Folio consecutivo de maquila: MAQ-YYYY-NNNN (secuencia independiente) */
export async function nextMaquilaFolio(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.quotation.count({ where: { kind: 'MAQUILA' } });
  return `MAQ-${year}-${String(count + 1).padStart(4, '0')}`;
}

/** Material con costo/m² efectivo (hoja ÷ m² × merma) para cálculo server-side */
function withEffectiveCost<M extends { type?: string; costPerM2: number | null; sheetCost?: number | null; sheetWidth?: number | null; sheetLength?: number | null; isMaderado?: boolean }>(
  m: M,
  wasteStandard: number,
  wasteMaderado: number
): M {
  if ((m.type ?? 'TABLERO') !== 'TABLERO') return m;
  return { ...m, costPerM2: effectiveCostPerM2(m, wasteStandard, wasteMaderado) };
}

/** Código consecutivo de pedido: PED-YYYY-NNNN */

/** Actualiza una cotización. Pedidos (orderCode) crean una revisión del estado anterior. */
export async function updateQuotationFromInput(id: string, input: QuotationCreateInput & { revisionNote?: string | null }) {
  const existing = await db.quotation.findUnique({ where: { id }, include: { items: true, maquilaLines: { include: maquilaLineInclude } } });
  if (!existing) throw new Error('Cotización no encontrada');

  const kind = (existing.kind as 'MUEBLE' | 'MAQUILA') ?? 'MUEBLE';
  const esPedido = !!existing.orderCode;
  const editables = esPedido
    ? ['PRODUCCION', 'TERMINADO']
    : ['SOLICITUD', 'BORRADOR', 'ENVIADA', 'ACEPTADA'];
  if (!editables.includes(existing.status)) {
    throw new Error(
      esPedido
        ? 'Un pedido cancelado o entregado no se puede editar'
        : `Una cotización ${existing.status === 'RECHAZADA' ? 'rechazada' : 'cancelada'} no se puede editar`
    );
  }

  const esMaquila = kind === 'MAQUILA';

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  // Pedido: snapshot del estado actual como revisión antes de sobrescribir
  if (esPedido) {
    ops.push(
      db.quotationRevision.create({
        data: {
          quotationId: id,
          rev: existing.rev,
          status: existing.status,
          itemsJson: JSON.stringify(
            esMaquila
              ? existing.maquilaLines.map((ln) => ({
                  material: ln.material.name,
                  sheetsQty: ln.sheetsQty,
                  edgeBandMl: ln.edgeBandMl,
                  unitSheetCost: ln.unitSheetCost,
                  unitBandCostMl: ln.unitBandCostMl,
                  notes: ln.notes,
                }))
              : existing.items.map((it) => ({
                  code: it.code,
                  name: it.name,
                  qty: it.qty,
                  width: it.width,
                  height: it.height,
                  depth: it.depth,
                  unitCost: it.unitCost,
                  unitPrice: it.unitPrice,
                }))
          ),
          furnitureSale: existing.furnitureSale,
          totalWithIva: existing.totalWithIva,
          distributorTotal: existing.distributorTotal,
          ...(esMaquila ? { materialsTotal: existing.materialsTotal, servicesTotal: existing.servicesTotal } : {}),
          note: input.revisionNote?.trim() || (esMaquila ? 'Edición del pedido de maquila' : 'Edición del pedido'),
        },
      })
    );
  }

  if (esMaquila) {
    const { cutRate, bandRate, totals, matMap, derivedLines, byPieces, cutsEstimated, sheetsEstimated } =
      await computeMaquilaQuotation(input);
    ops.push(
      db.quotation.update({
        where: { id },
        data: {
          clientId: input.clientId ?? null,
          clientName: input.clientName,
          clientPhone: input.clientPhone ?? null,
          clientEmail: input.clientEmail ?? null,
          title: input.title?.trim() || null,
          notes: input.notes ?? null,
          cutQty: totals.cutQty,
          // La tienda captura pasadas reales; el despiece/portal deja estimados
          cutsEstimated,
          sheetsEstimated,
          cutUnitCost: cutRate,
          edgeBandMl: totals.edgeBandMlTotal,
          edgeBandUnitCost: bandRate,
          materialsTotal: totals.materialsTotal,
          servicesTotal: totals.servicesTotal,
          ivaAmount: totals.ivaAmount,
          totalWithIva: totals.totalWithIva,
          ...(input.estimatedDeliveryAt !== undefined
            ? { estimatedDeliveryAt: parseDeliveryDate(input.estimatedDeliveryAt) }
            : {}),
          ...(esPedido ? { rev: existing.rev + 1 } : {}),
          maquilaLines: {
            deleteMany: {},
            create: derivedLines.map((ln, i) => ({
              materialId: ln.materialId,
              sheetsQty: Math.max(0, Math.round(ln.sheetsQty || 0)),
              edgeBandMl: Math.max(0, ln.edgeBandMl || 0),
              unitSheetCost: matMap.get(ln.materialId)?.sheetCost ?? 0,
              unitBandCostMl: matMap.get(ln.materialId)?.edgeBandCostMl ?? 0,
              notes: ln.notes?.trim() || null,
              order: i,
            })),
          },
          // El despiece solo se reemplaza cuando el input trae piezas;
          // editar en modo tableros (hojas reales tras optimizar) lo conserva como registro
          ...(byPieces
            ? {
                maquilaPieces: {
                  deleteMany: {},
                  create: input.maquilaPieces!.map((p, i) => ({
                    name: p.name.trim() || `Pieza ${i + 1}`,
                    qty: Math.max(1, Math.round(p.qty || 1)),
                    length: Math.max(0, p.length || 0),
                    width: Math.max(0, p.width || 0),
                    materialId: p.materialId,
                    grain: !!p.grain,
                    bandL1: !!p.bandL1,
                    bandL2: !!p.bandL2,
                    bandA1: !!p.bandA1,
                    bandA2: !!p.bandA2,
                    notes: p.notes?.trim() || null,
                    order: i,
                  })),
                },
              }
            : {}),
        },
        include: quotationInclude,
      })
    );
  } else {
    const { factor, labor, distributorDiscount, totals } = await computeQuotation(input);
    ops.push(
      db.quotation.update({
        where: { id },
        data: {
          clientId: input.clientId ?? null,
          clientName: input.clientName,
          clientPhone: input.clientPhone ?? null,
          clientEmail: input.clientEmail ?? null,
          title: input.title?.trim() || null,
          notes: input.notes ?? null,
          finish: input.finish,
          countertopMaterialId: input.countertopMaterialId ?? null,
          countertopMlOverride: input.countertopMlOverride ?? null,
          applyDistributor: input.applyDistributor,
          factorSnapshot: factor,
          laborSnapshot: labor,
          distributorSnapshot: distributorDiscount,
          furnitureCost: totals.furnitureCost,
          furnitureSale: totals.furnitureSale,
          countertopMl: totals.countertopMlBillable,
          countertopCost: totals.countertopCost,
          countertopSale: totals.countertopSale,
          ivaAmount: totals.ivaAmount,
          totalWithIva: totals.totalWithIva,
          distributorFurniture: totals.distributorFurniture,
          distributorCountertop: totals.distributorCountertop,
          distributorIva: totals.distributorIva,
          distributorTotal: totals.distributorTotal,
          ...(input.estimatedDeliveryAt !== undefined
            ? { estimatedDeliveryAt: parseDeliveryDate(input.estimatedDeliveryAt) }
            : {}),
          ...(esPedido ? { rev: existing.rev + 1 } : {}),
          items: {
            deleteMany: {},
            create: totals.perItem.map((it) => ({
              furnitureId: it.furniture.id,
              qty: it.qty,
              code: it.furniture.code,
              name: it.furniture.name,
              width: it.furniture.width,
              height: it.furniture.height,
              depth: it.furniture.depth,
              unitCost: it.unitCost,
              unitPrice: it.unitPrice,
            })),
          },
        },
        include: quotationInclude,
      })
    );
  }

  const results = await db.$transaction(ops);
  return results[results.length - 1];
}

export async function nextOrderCode(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.quotation.count({ where: { orderCode: { not: null } } });
  return `PED-${year}-${String(count + 1).padStart(4, '0')}`;
}

/** Cálculo compartido entre crear y actualizar cotizaciones */
async function computeQuotation(input: QuotationCreateInput) {
  const settings = await getSettings();
  const factor = input.factor ?? settings.saleFactor;
  const labor = input.laborPerUnit ?? settings.laborPerUnit;
  const profileRaw = await getFinishProfile(input.finish);
  const wS = settings.wasteFactorStandard ?? 1;
  const wM = settings.wasteFactorMaderado ?? 1;
  const profile = profileRaw && !profileRaw.usePieceMaterials
    ? {
        ...profileRaw,
        bodyMaterial: profileRaw.bodyMaterial ? withEffectiveCost(profileRaw.bodyMaterial, wS, wM) : null,
        frontMaterial: profileRaw.frontMaterial ? withEffectiveCost(profileRaw.frontMaterial, wS, wM) : null,
      }
    : profileRaw;

  const furnitures = await db.furniture.findMany({
    where: { id: { in: input.items.map((i) => i.furnitureId) } },
    include: furnitureInclude,
  });
  const furnitureMap = new Map(
    furnitures.map((f) => [
      f.id,
      toFurnitureLike({
        ...f,
        pieces: f.pieces.map((p) => ({
          ...p,
          material: p.material ? withEffectiveCost(p.material, wS, wM) : p.material,
        })),
      }),
    ])
  );

  const itemsForCalc = input.items
    .map((i) => ({ furniture: furnitureMap.get(i.furnitureId), qty: i.qty }))
    .filter((x): x is { furniture: FurnitureLike; qty: number } => !!x.furniture);

  let countertop: MaterialLike | null = null;
  if (input.countertopMaterialId) {
    countertop = await db.material.findUnique({ where: { id: input.countertopMaterialId } });
  }

  const distributorDiscount = input.distributorDiscount ?? settings.distributorDiscount;

  const totals = computeQuoteTotals({
    items: itemsForCalc,
    profile,
    countertop,
    countertopMlOverride: input.countertopMlOverride ?? null,
    factor,
    laborPerUnit: labor,
    ivaRate: settings.ivaRate,
    distributorDiscount,
    countertopFactor: settings.countertopFactor,
    countertopMultipleM: settings.countertopMultipleM,
  });

  return { factor, labor, distributorDiscount, totals };
}

/** Cálculo compartido de una cotización de maquila (valida materiales y aplica tarifario).
 *  Dos modos: despiece (maquilaPieces → se estiman hojas/cortes y se derivan las líneas)
 *  o venta directa de tableros (maquilaLines capturadas a mano). */
async function computeMaquilaQuotation(input: QuotationCreateInput) {
  const settings = await getSettings();
  const cutRate = input.cutCostPerPass ?? settings.cutCostPerPass;
  const bandRate = input.edgeBandServiceCostMl ?? settings.edgeBandServiceCostMl;

  const byPieces = !!input.maquilaPieces?.length;
  const wanted = byPieces
    ? Array.from(new Set(input.maquilaPieces!.map((p) => p.materialId).filter((x): x is string => !!x)))
    : (input.maquilaLines ?? []).map((l) => l.materialId);
  if (!wanted.length) throw new Error('Agrega al menos un material a la cotización de maquila');
  const materials = await db.material.findMany({ where: { id: { in: wanted } } });
  const matMap = new Map(materials.map((m) => [m.id, m]));

  let derivedLines: MaquilaLineCreateInput[];
  let estimatedCuts: number | null = null;

  if (byPieces) {
    const pieceLikes: MaquilaPieceLike[] = input.maquilaPieces!.map((p) => ({
      name: p.name,
      qty: p.qty,
      length: p.length,
      width: p.width,
      materialId: p.materialId,
      grain: p.grain,
      bandL1: p.bandL1,
      bandL2: p.bandL2,
      bandA1: p.bandA1,
      bandA2: p.bandA2,
      material: p.materialId ? matMap.get(p.materialId) ?? null : null,
    }));
    const plan = planFromPieces(pieceLikes, {
      wasteFactorStandard: settings.wasteFactorStandard ?? 1,
      wasteFactorMaderado: settings.wasteFactorMaderado ?? 1,
      avgCutsPerSheet: settings.avgCutsPerSheet ?? 0,
    });
    derivedLines = plan.perMaterial.map((m) => ({
      materialId: m.materialId,
      sheetsQty: m.sheetsQty,
      edgeBandMl: m.edgeBandMl,
      notes: `Despiece: ${m.piecesCount} pieza(s) · ${m.areaM2.toFixed(2)} m²${m.sheetsQty > 0 ? ' · hojas estimadas' : ''}`,
    }));
    estimatedCuts = plan.estimatedCuts;
  } else {
    for (const l of input.maquilaLines ?? []) {
      if (!matMap.has(l.materialId)) throw new Error('Una de las líneas tiene un material inexistente');
    }
    derivedLines = input.maquilaLines ?? [];
  }

  const lines: MaquilaLineLike[] = derivedLines.map((l) => ({
    materialId: l.materialId,
    sheetsQty: l.sheetsQty,
    edgeBandMl: l.edgeBandMl,
    material: matMap.get(l.materialId) ?? null,
  }));

  // Cortes: real si la tienda lo capturó; estimado desde el despiece si no
  const cutQty = input.cutQty ?? estimatedCuts ?? 0;
  const totals = computeMaquilaTotals({
    lines,
    cutQty,
    cutCostPerPass: cutRate,
    edgeBandServiceCostMl: bandRate,
    ivaRate: settings.ivaRate,
  });
  return {
    cutRate,
    bandRate,
    totals,
    matMap,
    derivedLines,
    byPieces,
    cutsEstimated: byPieces && !input.cutsAreReal,
    sheetsEstimated: byPieces && input.sheetsEstimated !== false,
  };
}

/** Convierte 'yyyy-MM-dd' (medianoche local) o ISO a Date; null si viene vacío o inválido */
function parseDeliveryDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00`);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha estimada de entrega al crear: override manual o plazo por tipo (maquila/cocina) */
async function deliveryDateFor(
  kind: 'MUEBLE' | 'MAQUILA',
  override: string | null | undefined
): Promise<Date | null> {
  const parsed = parseDeliveryDate(override);
  if (parsed) return parsed;
  const settings = await getSettings();
  const days = kind === 'MAQUILA' ? settings.deliveryDaysMaquila : settings.deliveryDaysCocina;
  return new Date(Date.now() + Math.max(0, days ?? 0) * 86400000);
}

export async function createQuotationFromInput(input: QuotationCreateInput) {
  if ((input.kind ?? 'MUEBLE') === 'MAQUILA') return createMaquilaFromInput(input);

  const { factor, labor, distributorDiscount, totals } = await computeQuotation(input);
  const estimatedDeliveryAt = await deliveryDateFor('MUEBLE', input.estimatedDeliveryAt);

  const folio = await nextFolio();
  const esPortal = input.source === 'PORTAL';
  const quotation = await db.quotation.create({
    data: {
      clientId: input.clientId ?? null,
      folio,
      kind: 'MUEBLE',
      source: esPortal ? 'PORTAL' : 'TIENDA',
      clientName: input.clientName,
      clientPhone: input.clientPhone ?? null,
      clientEmail: input.clientEmail ?? null,
      title: input.title?.trim() || null,
      notes: input.notes ?? null,
      finish: input.finish,
      countertopMaterialId: input.countertopMaterialId ?? null,
      countertopMlOverride: input.countertopMlOverride ?? null,
      applyDistributor: input.applyDistributor,
      factorSnapshot: factor,
      laborSnapshot: labor,
      distributorSnapshot: distributorDiscount,
      status: esPortal ? 'SOLICITUD' : 'BORRADOR',
      rev: 1,
      estimatedDeliveryAt,
      furnitureCost: totals.furnitureCost,
      furnitureSale: totals.furnitureSale,
      countertopMl: totals.countertopMlBillable,
      countertopCost: totals.countertopCost,
      countertopSale: totals.countertopSale,
      ivaAmount: totals.ivaAmount,
      totalWithIva: totals.totalWithIva,
      distributorFurniture: totals.distributorFurniture,
      distributorCountertop: totals.distributorCountertop,
      distributorIva: totals.distributorIva,
      distributorTotal: totals.distributorTotal,
      items: {
        create: totals.perItem.map((it) => ({
          furnitureId: it.furniture.id,
          qty: it.qty,
          code: it.furniture.code,
          name: it.furniture.name,
          width: it.furniture.width,
          height: it.furniture.height,
          depth: it.furniture.depth,
          unitCost: it.unitCost,
          unitPrice: it.unitPrice,
        })),
      },
    },
    include: quotationInclude,
  });

  await logQuotationInteraction(quotation, input.items.length);
  return quotation;
}

/** Crea una cotización de maquila: folio MAQ-, líneas de material con snapshot de costos */
async function createMaquilaFromInput(input: QuotationCreateInput) {
  // Solicitud del portal (venta directa) sin pasadas capturadas: se estiman con el promedio por hoja
  if (input.source === 'PORTAL' && input.cutQty === undefined && input.cutsEstimated && !input.maquilaPieces?.length) {
    const settings = await getSettings();
    const totalSheets = (input.maquilaLines ?? []).reduce((acc, l) => acc + Math.max(0, Math.round(l.sheetsQty || 0)), 0);
    input = { ...input, cutQty: Math.round(totalSheets * (settings.avgCutsPerSheet || 0)) };
  }

  const { cutRate, bandRate, totals, matMap, derivedLines, byPieces, cutsEstimated, sheetsEstimated } =
    await computeMaquilaQuotation(input);
  const estimatedDeliveryAt = await deliveryDateFor('MAQUILA', input.estimatedDeliveryAt);

  const folio = await nextMaquilaFolio();
  const quotation = await db.quotation.create({
    data: {
      clientId: input.clientId ?? null,
      folio,
      kind: 'MAQUILA',
      source: input.source === 'PORTAL' ? 'PORTAL' : 'TIENDA',
      clientName: input.clientName,
      clientPhone: input.clientPhone ?? null,
      clientEmail: input.clientEmail ?? null,
      title: input.title?.trim() || null,
      notes: input.notes ?? null,
      status: input.source === 'PORTAL' ? 'SOLICITUD' : 'BORRADOR',
      rev: 1,
      cutsEstimated,
      sheetsEstimated,
      estimatedDeliveryAt,
      cutQty: totals.cutQty,
      cutUnitCost: cutRate,
      edgeBandMl: totals.edgeBandMlTotal,
      edgeBandUnitCost: bandRate,
      materialsTotal: totals.materialsTotal,
      servicesTotal: totals.servicesTotal,
      ivaAmount: totals.ivaAmount,
      totalWithIva: totals.totalWithIva,
      maquilaLines: {
        create: derivedLines.map((ln, i) => ({
          materialId: ln.materialId,
          sheetsQty: Math.max(0, Math.round(ln.sheetsQty || 0)),
          edgeBandMl: Math.max(0, ln.edgeBandMl || 0),
          unitSheetCost: matMap.get(ln.materialId)?.sheetCost ?? 0,
          unitBandCostMl: matMap.get(ln.materialId)?.edgeBandCostMl ?? 0,
          notes: ln.notes?.trim() || null,
          order: i,
        })),
      },
      ...(byPieces
        ? {
            maquilaPieces: {
              create: input.maquilaPieces!.map((p, i) => ({
                name: p.name.trim() || `Pieza ${i + 1}`,
                qty: Math.max(1, Math.round(p.qty || 1)),
                length: Math.max(0, p.length || 0),
                width: Math.max(0, p.width || 0),
                materialId: p.materialId,
                grain: !!p.grain,
                bandL1: !!p.bandL1,
                bandL2: !!p.bandL2,
                bandA1: !!p.bandA1,
                bandA2: !!p.bandA2,
                notes: p.notes?.trim() || null,
                order: i,
              })),
            },
          }
        : {}),
    },
    include: quotationInclude,
  });

  await logQuotationInteraction(quotation, input.maquilaLines?.length ?? 0);
  return quotation;
}

/** CRM: registra la cotización como interacción del cliente vinculado */
async function logQuotationInteraction(
  quotation: { id: string; folio: string; clientId: string | null; totalWithIva: number; status: string },
  partCount: number
) {
  if (!quotation.clientId) return;
  const client = await db.client.findUnique({ where: { id: quotation.clientId } });
  if (!client) return;
  const esSolicitud = quotation.status === 'SOLICITUD';
  // Etapas que avanzan a COTIZADO al recibir una cotización (sin degradar NEGOCIACION/GANADO/PERDIDO)
  const promotesToQuoted = ['NUEVO', 'PROSPECTANDO', 'CONTACTADO'].includes(client.stage);
  await db.$transaction([
    db.interaction.create({
      data: {
        clientId: client.id,
        type: 'COTIZACION',
        subject: esSolicitud ? `Solicitud ${quotation.folio} (portal)` : `Cotización ${quotation.folio}`,
        content: esSolicitud
          ? `Pre-cotización ${quotation.folio} solicitada desde el portal por ~${quotation.totalWithIva.toFixed(2)} MXN (${partCount} partida${partCount === 1 ? '' : 's'}); pendiente de confirmar en tienda.`
          : `Se envió la cotización ${quotation.folio} por ${quotation.totalWithIva.toFixed(2)} MXN (${partCount} partida${partCount === 1 ? '' : 's'}).`,
      },
    }),
    db.client.update({
      where: { id: client.id },
      data: {
        lastContactAt: new Date(),
        ...(promotesToQuoted ? { stage: 'COTIZADO' } : {}),
      },
    }),
  ]);
}

/** Auditoría: detecta problemas de datos para minimizar errores */
export async function getAuditAlerts() {
  const alerts: { level: 'error' | 'warning'; message: string; detail?: string }[] = [];

  const [materials, hardware, furniture, settings] = await Promise.all([
    db.material.findMany(),
    db.hardware.findMany(),
    db.furniture.findMany({ include: { pieces: true, hardwareItems: true } }),
    getSettings(),
  ]);

  for (const m of materials) {
    if (!m.active) continue;
    if (m.type === 'TABLERO' && (!m.costPerM2 || m.costPerM2 <= 0)) {
      alerts.push({ level: 'error', message: `Material "${m.name}" activo sin precio de m²` });
    }
    if (m.type === 'CUBIERTA' && m.name !== 'SIN CUBIERTA' && (!m.costPerMl || m.costPerMl <= 0)) {
      alerts.push({ level: 'warning', message: `Cubierta "${m.name}" activa sin costo por ML` });
    }
  }
  for (const h of hardware) {
    if (h.active && (!h.unitCost || h.unitCost <= 0)) {
      alerts.push({ level: 'error', message: `Herraje "${h.name}" activo sin costo unitario` });
    }
  }
  const pieces = await db.piece.findMany();
  const matIds = new Set(materials.map((m) => m.id));
  for (const p of pieces) {
    if (!p.materialId || !matIds.has(p.materialId)) {
      const f = furniture.find((x) => x.id === p.furnitureId);
      alerts.push({ level: 'error', message: `Pieza "${p.name}" sin material en ${f?.code ?? 'mueble desconocido'}` });
    }
  }
  for (const f of furniture) {
    if (f.pieces.length === 0) {
      alerts.push({ level: 'warning', message: `${f.code} no tiene piezas en su despiece` });
    }
    if (f.appliesCountertop && f.countertopWidthM <= 0) {
      alerts.push({ level: 'warning', message: `${f.code} aplica cubierta pero su ancho es 0` });
    }
  }
  if (!settings.maderadoMaterialId) {
    alerts.push({ level: 'error', message: 'No hay material maderado configurado (acabado MADERADO no funcionará)' });
  }
  return alerts;
}
