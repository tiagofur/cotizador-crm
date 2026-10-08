/* ============================================================
 * Motor de precios de MAQUILA — lógica compartida cliente/servidor
 * Tableros completos = al costo de hoja (sin factor ni merma)
 * Cintilla (material) = ml × costo cintilla/ml del material
 * Corte (servicio) = pasadas de sierra × tarifa/pasada
 * Encintado (servicio) = Σ ml de cintilla de todas las líneas × tarifa/ml
 * Subtotal = materiales + servicios → IVA
 * ============================================================ */

import type { MaterialLike } from './pricing';

export interface MaquilaLineLike {
  materialId: string;
  sheetsQty: number;
  edgeBandMl: number;
  material?: MaterialLike | null;
}

/* ---------- Piezas del despiece ---------- */

/** Pieza capturada por el cliente/tienda: medidas en mm y cantos por lado */
export interface MaquilaPieceLike {
  name: string;
  qty: number;
  length: number; // mm
  width: number; // mm
  materialId?: string | null;
  grain?: boolean;
  bandL1?: boolean;
  bandL2?: boolean;
  bandA1?: boolean;
  bandA2?: boolean;
  material?: MaterialLike | null;
}

/** Área total de la pieza en m² (incluye cantidad) */
export function pieceArea(p: MaquilaPieceLike): number {
  return (Math.max(0, p.qty || 0) * Math.max(0, p.length || 0) * Math.max(0, p.width || 0)) / 1e6;
}

/** Metros lineales de cintilla de la pieza: L1/L2 suman el largo, A1/A2 el ancho */
export function pieceBandMl(p: MaquilaPieceLike): number {
  const ml =
    (p.bandL1 ? p.length : 0) +
    (p.bandL2 ? p.length : 0) +
    (p.bandA1 ? p.width : 0) +
    (p.bandA2 ? p.width : 0);
  return (Math.max(0, p.qty || 0) * ml) / 1000;
}

export interface MaquilaPiecePlanItem {
  materialId: string;
  material: MaterialLike | null;
  /** Σ m² de las piezas de este material */
  areaM2: number;
  /** Hojas estimadas: Σ m² × merma ÷ m² de hoja (la máquina da el número real) */
  sheetsQty: number;
  sheetM2: number;
  unitSheetCost: number;
  unitBandCostMl: number;
  /** Σ ml de cintilla de las piezas de este material */
  edgeBandMl: number;
  sheetsTotal: number;
  bandMaterialTotal: number;
  total: number;
  piecesCount: number;
}

export interface MaquilaPiecePlan {
  perMaterial: MaquilaPiecePlanItem[];
  /** Pasadas de sierra estimadas: hojas × promedio configurado */
  estimatedCuts: number;
  piecesCount: number;
}

/** Estima el plan de materiales desde las piezas: hojas por material (con merma) y cintilla exacta */
export function planFromPieces(
  pieces: MaquilaPieceLike[],
  opts: { wasteFactorStandard?: number; wasteFactorMaderado?: number; avgCutsPerSheet?: number } = {}
): MaquilaPiecePlan {
  const wS = opts.wasteFactorStandard ?? 1;
  const wM = opts.wasteFactorMaderado ?? 1;

  const byMat = new Map<string, MaquilaPieceLike[]>();
  let piecesCount = 0;
  for (const p of pieces) {
    const id = p.materialId ?? '';
    if (!id) continue;
    if (!byMat.has(id)) byMat.set(id, []);
    byMat.get(id)!.push(p);
    piecesCount += Math.max(0, Math.round(p.qty || 0));
  }

  const perMaterial: MaquilaPiecePlanItem[] = [];
  for (const [materialId, group] of byMat) {
    const mat = group[0]?.material ?? null;
    const areaM2 = group.reduce((a, p) => a + pieceArea(p), 0);
    const edgeBandMl = group.reduce((a, p) => a + pieceBandMl(p), 0);
    const sheetM2 = ((mat?.sheetWidth ?? 0) / 1000) * ((mat?.sheetLength ?? 0) / 1000);
    const merma = mat?.isMaderado ? wM : wS;
    const sheetsQty = sheetM2 > 0 && areaM2 > 0 ? Math.ceil((areaM2 * merma) / sheetM2) : 0;
    const unitSheetCost = mat?.sheetCost ?? 0;
    const unitBandCostMl = mat?.edgeBandCostMl ?? 0;
    const sheetsTotal = sheetsQty * unitSheetCost;
    const bandMaterialTotal = edgeBandMl * unitBandCostMl;
    perMaterial.push({
      materialId,
      material: mat,
      areaM2,
      sheetsQty,
      sheetM2,
      unitSheetCost,
      unitBandCostMl,
      edgeBandMl,
      sheetsTotal,
      bandMaterialTotal,
      total: sheetsTotal + bandMaterialTotal,
      piecesCount: group.reduce((a, p) => a + Math.max(0, Math.round(p.qty || 0)), 0),
    });
  }

  const totalSheets = perMaterial.reduce((a, m) => a + m.sheetsQty, 0);
  return {
    perMaterial,
    estimatedCuts: Math.round(totalSheets * (opts.avgCutsPerSheet ?? 0)),
    piecesCount,
  };
}

export interface MaquilaTotalsInput {
  lines: MaquilaLineLike[];
  /** Pasadas de sierra del apartado de servicios */
  cutQty: number;
  cutCostPerPass: number;
  edgeBandServiceCostMl: number;
  ivaRate: number;
}

export interface MaquilaLineTotals {
  sheetsQty: number;
  sheetsTotal: number; // tableros al costo
  edgeBandMl: number;
  bandMaterialTotal: number; // cintilla (material)
  total: number;
}

export interface MaquilaTotals {
  sheetsTotal: number; // tableros al costo
  bandMaterialTotal: number; // cintilla (material)
  materialsTotal: number;
  cutQty: number;
  cutTotal: number;
  edgeBandMlTotal: number; // Σ ml de todas las líneas
  edgeBandTotal: number; // servicio de encintado
  servicesTotal: number;
  subtotal: number;
  ivaAmount: number;
  totalWithIva: number;
  perLine: MaquilaLineTotals[];
}

/** Cálculo completo de una cotización de maquila */
export function computeMaquilaTotals(input: MaquilaTotalsInput): MaquilaTotals {
  let sheetsTotal = 0;
  let bandMaterialTotal = 0;
  let edgeBandMlTotal = 0;

  const perLine = input.lines.map((ln) => {
    const sheetCost = ln.material?.sheetCost ?? 0;
    const bandCostMl = ln.material?.edgeBandCostMl ?? 0;
    const sheetsQty = Math.max(0, Math.round(ln.sheetsQty || 0));
    const ml = Math.max(0, ln.edgeBandMl || 0);
    const lineSheets = sheetsQty * sheetCost;
    const lineBand = ml * bandCostMl;
    sheetsTotal += lineSheets;
    bandMaterialTotal += lineBand;
    edgeBandMlTotal += ml;
    return { sheetsQty, sheetsTotal: lineSheets, edgeBandMl: ml, bandMaterialTotal: lineBand, total: lineSheets + lineBand };
  });

  const materialsTotal = sheetsTotal + bandMaterialTotal;
  const cutQty = Math.max(0, Math.round(input.cutQty || 0));
  const cutTotal = cutQty * (input.cutCostPerPass || 0);
  const edgeBandTotal = edgeBandMlTotal * (input.edgeBandServiceCostMl || 0);
  const servicesTotal = cutTotal + edgeBandTotal;

  const subtotal = materialsTotal + servicesTotal;
  const ivaAmount = subtotal * input.ivaRate;
  const totalWithIva = subtotal + ivaAmount;

  return {
    sheetsTotal,
    bandMaterialTotal,
    materialsTotal,
    cutQty,
    cutTotal,
    edgeBandMlTotal,
    edgeBandTotal,
    servicesTotal,
    subtotal,
    ivaAmount,
    totalWithIva,
    perLine,
  };
}
