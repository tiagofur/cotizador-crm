/* Helpers de servidor: consultas y cálculo de cotizaciones */
import { db } from '@/lib/db';
import { computeQuoteTotals, effectiveCostPerM2, type FurnitureLike, type MaterialLike, type Finish, type FinishProfileLike } from '@/lib/pricing';
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

export interface QuotationCreateInput {
  clientId?: string | null;
  clientName: string;
  title?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  notes?: string | null;
  finish: Finish;
  countertopMaterialId?: string | null;
  countertopMlOverride?: number | null;
  applyDistributor: boolean;
  /** Descuento distribuidor efectivo (0-1); default: el de Configuración */
  distributorDiscount?: number;
  factor?: number;
  laborPerUnit?: number;
  items: { furnitureId: string; qty: number }[];
}

export async function nextFolio(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.quotation.count();
  return `COT-${year}-${String(count + 1).padStart(4, '0')}`;
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
  const existing = await db.quotation.findUnique({ where: { id }, include: { items: true } });
  if (!existing) throw new Error('Cotización no encontrada');

  const esPedido = !!existing.orderCode;
  const editables = esPedido ? ['PRODUCCION', 'TERMINADO'] : ['BORRADOR', 'ENVIADA', 'ACEPTADA'];
  if (!editables.includes(existing.status)) {
    throw new Error(
      esPedido
        ? 'Un pedido cancelado no se puede editar'
        : `Una cotización ${existing.status === 'RECHAZADA' ? 'rechazada' : 'cancelada'} no se puede editar`
    );
  }

  const { factor, labor, distributorDiscount, totals } = await computeQuotation(input);

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
            existing.items.map((it) => ({
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
          note: input.revisionNote?.trim() || 'Edición del pedido',
        },
      })
    );
  }

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
      include: { items: true, countertopMaterial: true },
    })
  );

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

export async function createQuotationFromInput(input: QuotationCreateInput) {
  const { factor, labor, distributorDiscount, totals } = await computeQuotation(input);

  const folio = await nextFolio();
  const quotation = await db.quotation.create({
    data: {
      clientId: input.clientId ?? null,
      folio,
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
      status: 'BORRADOR',
      rev: 1,
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

  /* ----- CRM: registra la cotización como interacción del cliente ----- */
  if (input.clientId) {
    const client = await db.client.findUnique({ where: { id: input.clientId } });
    if (client) {
      // Etapas que avanzan a COTIZADO al recibir una cotización (sin degradar NEGOCIACION/GANADO/PERDIDO)
      const promotesToQuoted = ['NUEVO', 'PROSPECTANDO', 'CONTACTADO'].includes(client.stage);
      await db.$transaction([
        db.interaction.create({
          data: {
            clientId: client.id,
            type: 'COTIZACION',
            subject: `Cotización ${quotation.folio}`,
            content: `Se envió la cotización ${quotation.folio} por ${quotation.totalWithIva.toFixed(2)} MXN (${input.items.length} partida${input.items.length === 1 ? '' : 's'}).`,
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
  }

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
