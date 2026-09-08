/* ============================================================
 * Motor de precios — lógica compartida cliente/servidor
 * Costo de pieza = (m² × costo tablero) + (ML cinta × costo cinta)
 * Costo de mueble = Σ piezas + Σ herrajes
 * Precio = (costo + mano de obra/unidad × unidades) × factor de venta
 * ============================================================ */

export type Finish = 'BLANCO' | 'MADERADO';

export interface MaterialLike {
  id: string;
  name: string;
  type: string; // TABLERO | CUBIERTA
  costPerM2: number | null;
  costPerMl: number | null;
  edgeBandCostMl: number | null;
  isMaderado?: boolean;
  active?: boolean;
}

export interface PieceLike {
  id?: string;
  name: string;
  code?: string | null;
  qty: number;
  length: number; // mm
  width: number; // mm
  materialId?: string | null;
  material?: MaterialLike | null;
  grain: boolean;
  bandLong1: boolean;
  bandLong2: boolean;
  bandShort1: boolean;
  bandShort2: boolean;
  order?: number;
}

export interface HardwareItemLike {
  qty: number;
  hardware?: { id: string; name: string; unit: string; unitCost: number } | null;
  hardwareId?: string;
}

export interface FurnitureLike {
  id: string;
  code: string;
  name: string;
  category: string;
  width: number;
  height: number;
  depth: number;
  imageUrl?: string | null;
  appliesCountertop: boolean;
  countertopWidthM: number;
  pieces: PieceLike[];
  hardwareItems: HardwareItemLike[];
}

export interface SettingsLike {
  saleFactor: number;
  ivaRate: number;
  distributorDiscount: number;
  laborPerUnit: number;
  countertopMultipleM: number;
  countertopFactor: number;
  currency?: string;
}

/** Área en m² de una pieza (total, incluyendo cantidad) */
export function pieceAreaM2(p: PieceLike): number {
  return (p.qty * p.length * p.width) / 1e6;
}

/** Metros lineales de cintilla de una pieza (incluye cantidad) */
export function pieceEdgeMl(p: PieceLike): number {
  const ml =
    (p.bandLong1 ? p.length : 0) +
    (p.bandLong2 ? p.length : 0) +
    (p.bandShort1 ? p.width : 0) +
    (p.bandShort2 ? p.width : 0);
  return (p.qty * ml) / 1000;
}

/** Material efectivo de una pieza según el acabado */
export function resolvePieceMaterial(p: PieceLike, maderadoMaterialId: string | null, finish: Finish): MaterialLike | null {
  if (finish === 'MADERADO' && maderadoMaterialId) {
    // Si la pieza ya es el material maderado, se queda igual
    if (p.material?.id === maderadoMaterialId) return p.material;
    // En acabado maderado todas las piezas usan el material maderado
    return null; // la persona que llama debe resolver el material maderado
  }
  return p.material ?? null;
}

/** Material de una pieza según acabado, dado el objeto material maderado */
export function pieceMaterialFor(p: PieceLike, finish: Finish, maderadoMat: MaterialLike | null): MaterialLike | null {
  if (finish === 'MADERADO') return maderadoMat ?? p.material ?? null;
  return p.material ?? null;
}

/** Costo de una pieza con su material efectivo */
export function pieceCost(p: PieceLike, mat: MaterialLike | null): number {
  if (!mat) return 0;
  const m2 = pieceAreaM2(p);
  const ml = pieceEdgeMl(p);
  const matCost = (mat.costPerM2 || 0) * m2;
  const bandCost = (mat.edgeBandCostMl || 0) * ml;
  return matCost + bandCost;
}

export interface FurnitureCostResult {
  boardsCost: number;
  bandCost: number;
  hardwareCost: number;
  total: number;
  totalM2: number;
  totalMl: number;
}

/** Desglose de costo de un mueble en un acabado */
export function furnitureCostBreakdown(
  f: FurnitureLike,
  finish: Finish,
  maderadoMat: MaterialLike | null
): FurnitureCostResult {
  let boards = 0;
  let band = 0;
  let totalM2 = 0;
  let totalMl = 0;
  for (const p of f.pieces) {
    const mat = pieceMaterialFor(p, finish, maderadoMat);
    boards += pieceCost(p, mat) - (mat ? (mat.edgeBandCostMl || 0) * pieceEdgeMl(p) : 0);
    band += mat ? (mat.edgeBandCostMl || 0) * pieceEdgeMl(p) : 0;
    totalM2 += pieceAreaM2(p);
    totalMl += pieceEdgeMl(p);
  }
  let hardware = 0;
  for (const hi of f.hardwareItems) {
    hardware += hi.qty * (hi.hardware?.unitCost || 0);
  }
  return { boardsCost: boards, bandCost: band, hardwareCost: hardware, total: boards + band + hardware, totalM2, totalMl };
}

export function furnitureCost(f: FurnitureLike, finish: Finish, maderadoMat: MaterialLike | null): number {
  return furnitureCostBreakdown(f, finish, maderadoMat).total;
}

export function furniturePrice(
  f: FurnitureLike,
  finish: Finish,
  maderadoMat: MaterialLike | null,
  settings: SettingsLike
): number {
  return furnitureCost(f, finish, maderadoMat) * settings.saleFactor;
}

export interface QuoteItemInput {
  furniture: FurnitureLike;
  qty: number;
}

export interface QuoteTotalsInput {
  items: QuoteItemInput[];
  finish: Finish;
  countertop?: MaterialLike | null;
  countertopMlOverride?: number | null;
  factor: number;
  laborPerUnit: number;
  ivaRate: number;
  distributorDiscount: number;
  countertopFactor: number;
  countertopMultipleM: number;
  maderadoMat: MaterialLike | null;
}

export interface QuoteTotals {
  totalUnits: number;
  furnitureCost: number;
  laborTotal: number;
  furnitureSale: number;
  countertopMl: number;
  countertopMlBillable: number;
  countertopCost: number;
  countertopSale: number;
  subtotalSale: number;
  ivaAmount: number;
  totalWithIva: number;
  distributorFurniture: number;
  distributorCountertop: number;
  distributorIva: number;
  distributorTotal: number;
  perItem: { furniture: FurnitureLike; qty: number; unitCost: number; unitPrice: number; total: number }[];
}

/** Redondeo hacia arriba a múltiplos (para cubiertas) */
export function roundUpTo(value: number, multiple: number): number {
  if (multiple <= 0) return value;
  return Math.ceil(value / multiple - 1e-9) * multiple;
}

/** Cálculo completo de una cotización */
export function computeQuoteTotals(input: QuoteTotalsInput): QuoteTotals {
  const {
    items, finish, countertop, countertopMlOverride, factor, laborPerUnit,
    ivaRate, distributorDiscount, countertopFactor, countertopMultipleM, maderadoMat,
  } = input;

  let furnitureCostTotal = 0;
  let totalUnits = 0;
  let countertopMlReal = 0;
  const perItem = items.map((it) => {
    const unitCost = furnitureCost(it.furniture, finish, maderadoMat);
    const costPlusLabor = unitCost + laborPerUnit;
    const unitPrice = costPlusLabor * factor;
    const total = unitPrice * it.qty;
    furnitureCostTotal += unitCost * it.qty;
    totalUnits += it.qty;
    if (it.furniture.appliesCountertop) {
      countertopMlReal += it.furniture.countertopWidthM * it.qty;
    }
    return { furniture: it.furniture, qty: it.qty, unitCost, unitPrice, total };
  });

  const laborTotal = laborPerUnit * totalUnits;
  // Venta de muebles = (costo directo + mano de obra total) × factor
  const furnitureSale = (furnitureCostTotal + laborTotal) * factor;

  const isCubierta = countertop && countertop.type === 'CUBIERTA' && (countertop.costPerMl || 0) > 0;
  const countertopMl = countertopMlOverride != null && countertopMlOverride > 0 ? countertopMlOverride : countertopMlReal;
  const countertopMlBillable = isCubierta ? roundUpTo(countertopMl, countertopMultipleM) : 0;
  const countertopCost = isCubierta ? countertopMlBillable * (countertop.costPerMl || 0) : 0;
  const countertopSale = countertopCost * countertopFactor;

  const subtotalSale = furnitureSale + countertopSale;
  const ivaAmount = subtotalSale * ivaRate;
  const totalWithIva = subtotalSale + ivaAmount;

  const distributorFurniture = furnitureSale * (1 - distributorDiscount);
  const distributorCountertop = countertopSale * (1 - distributorDiscount);
  const distributorSubtotal = distributorFurniture + distributorCountertop;
  const distributorIva = distributorSubtotal * ivaRate;
  const distributorTotal = distributorSubtotal + distributorIva;

  return {
    totalUnits,
    furnitureCost: furnitureCostTotal,
    laborTotal,
    furnitureSale,
    countertopMl,
    countertopMlBillable,
    countertopCost,
    countertopSale,
    subtotalSale,
    ivaAmount,
    totalWithIva,
    distributorFurniture,
    distributorCountertop,
    distributorIva,
    distributorTotal,
    perItem,
  };
}
