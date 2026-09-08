/* Helpers de servidor: consultas y cálculo de cotizaciones */
import { db } from '@/lib/db';
import { computeQuoteTotals, type FurnitureLike, type MaterialLike, type Finish } from '@/lib/pricing';
import type { Prisma } from '@prisma/client';

export const furnitureInclude = {
  pieces: { orderBy: { order: 'asc' as const }, include: { material: true } },
  hardwareItems: { include: { hardware: true } },
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

export interface QuotationCreateInput {
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  notes?: string | null;
  finish: Finish;
  countertopMaterialId?: string | null;
  countertopMlOverride?: number | null;
  applyDistributor: boolean;
  factor?: number;
  laborPerUnit?: number;
  items: { furnitureId: string; qty: number }[];
}

export async function nextFolio(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.quotation.count();
  return `COT-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function createQuotationFromInput(input: QuotationCreateInput) {
  const settings = await getSettings();
  const factor = input.factor ?? settings.saleFactor;
  const labor = input.laborPerUnit ?? settings.laborPerUnit;
  const maderadoMat = await getMaderadoMaterial();

  const furnitures = await db.furniture.findMany({
    where: { id: { in: input.items.map((i) => i.furnitureId) } },
    include: furnitureInclude,
  });
  const furnitureMap = new Map(furnitures.map((f) => [f.id, toFurnitureLike(f)]));

  const itemsForCalc = input.items
    .map((i) => ({ furniture: furnitureMap.get(i.furnitureId), qty: i.qty }))
    .filter((x): x is { furniture: FurnitureLike; qty: number } => !!x.furniture);

  let countertop: MaterialLike | null = null;
  if (input.countertopMaterialId) {
    countertop = await db.material.findUnique({ where: { id: input.countertopMaterialId } });
  }

  const totals = computeQuoteTotals({
    items: itemsForCalc,
    finish: input.finish,
    countertop,
    countertopMlOverride: input.countertopMlOverride ?? null,
    factor,
    laborPerUnit: labor,
    ivaRate: settings.ivaRate,
    distributorDiscount: settings.distributorDiscount,
    countertopFactor: settings.countertopFactor,
    countertopMultipleM: settings.countertopMultipleM,
    maderadoMat,
  });

  const folio = await nextFolio();
  const quotation = await db.quotation.create({
    data: {
      folio,
      clientName: input.clientName,
      clientPhone: input.clientPhone ?? null,
      clientEmail: input.clientEmail ?? null,
      notes: input.notes ?? null,
      finish: input.finish,
      countertopMaterialId: input.countertopMaterialId ?? null,
      countertopMlOverride: input.countertopMlOverride ?? null,
      applyDistributor: input.applyDistributor,
      factorSnapshot: factor,
      laborSnapshot: labor,
      status: 'BORRADOR',
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
    include: { items: true, countertopMaterial: true },
  });
  return quotation;
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
