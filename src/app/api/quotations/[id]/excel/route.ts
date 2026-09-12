/* Genera el Excel de producción: resumen + lista de piezas + herrajes */
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import { getFinishProfile } from '@/lib/server/queries';
import { pieceAreaM2, pieceEdgeMl, type PieceLike } from '@/lib/pricing';

type Params = { params: Promise<{ id: string }> };
const quotationInclude = { items: { orderBy: { id: 'asc' as const } }, countertopMaterial: true };

const si = (b: boolean) => (b ? 'SÍ' : '');

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const q = await db.quotation.findUnique({
    where: { id },
    include: {
      ...quotationInclude,
      items: {
        orderBy: { id: 'asc' as const },
        include: { furniture: { include: { pieces: { orderBy: { order: 'asc' as const }, include: { material: true } }, hardwareItems: { include: { hardware: true } } } } },
      },
    },
  });
  if (!q) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });

  const profile = await getFinishProfile(q.finish);
  const finishLabel = profile?.name ?? q.finish;
  const materialForPiece = (p: { materialId: string | null; material: { name: string } | null; isFront: boolean }) => {
    if (!profile || profile.usePieceMaterials) return p.material?.name ?? '—';
    if (p.isFront) return profile.frontMaterial?.name ?? p.material?.name ?? '—';
    return profile.bodyMaterial?.name ?? p.material?.name ?? '—';
  };

  const wb = XLSX.utils.book_new();

  /* ---------- Hoja RESUMEN ---------- */
  const resumen: (string | number | null)[][] = [
    ['LISTA DE PRODUCCIÓN', null, null, null, null, null, null],
    ['Folio', q.folio], ['Cliente', q.clientName],
    ['Fecha', q.createdAt.toLocaleDateString('es-MX')],
    ['Acabado', finishLabel], ['Moneda', 'MXN'],
    ['Factor de venta', q.factorSnapshot], ['IVA', `${(q.ivaAmount / Math.max(q.furnitureSale + q.countertopSale, 0.01) * 100).toFixed(0)}%`],
    [],
    ['CANT', 'CÓDIGO', 'MUEBLE', 'DIMENSIONES (mm)', 'COSTO UNIT.', 'PRECIO UNIT.', 'TOTAL'],
  ];
  for (const it of q.items) {
    resumen.push([it.qty, it.code, it.name, `${it.width}×${it.height}×${it.depth}`, round(it.unitCost), round(it.unitPrice), round(it.unitPrice * it.qty)]);
  }
  resumen.push([]);
  resumen.push(['', '', '', '', 'Venta de muebles', '', round(q.furnitureSale)]);
  if (q.countertopMaterial) {
    resumen.push(['', '', '', '', `Cubierta ${q.countertopMaterial.name} (${q.countertopMl.toFixed(2)} m)`, '', round(q.countertopSale)]);
  }
  resumen.push(['', '', '', '', 'Subtotal', '', round(q.furnitureSale + q.countertopSale)]);
  resumen.push(['', '', '', '', 'IVA', '', round(q.ivaAmount)]);
  resumen.push(['', '', '', '', 'TOTAL (con IVA)', '', round(q.totalWithIva)]);
  if (q.applyDistributor) {
    resumen.push(['', '', '', '', 'TOTAL DISTRIBUIDOR (con IVA)', '', round(q.distributorTotal)]);
  }
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
  wsResumen['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 42 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'RESUMEN');

  /* ---------- Hoja PIEZAS ---------- */
  const piezas: (string | number | null)[][] = [
    ['MÓDULO', 'MUEBLE', 'CANT MOD', 'PIEZA', 'CÓDIGO PIEZA', 'CANT', 'LARGO mm', 'ANCHO mm', 'MATERIAL', 'VETA', 'CINTA L1', 'CINTA L2', 'CINTA A1', 'CINTA A2', 'm² TOTAL', 'ML CINTA'],
  ];
  let totalM2 = 0;
  let totalMl = 0;
  for (const item of q.items) {
    const f = item.furniture;
    if (!f) continue;
    for (const p of f.pieces) {
      const materialName = materialForPiece(p);
      const pl: PieceLike = {
        name: p.name, qty: p.qty, length: p.length, width: p.width,
        material: { id: p.materialId ?? '', name: materialName, type: 'TABLERO', costPerM2: 0, costPerMl: null, edgeBandCostMl: 0 },
        grain: p.grain, bandLong1: p.bandLong1, bandLong2: p.bandLong2, bandShort1: p.bandShort1, bandShort2: p.bandShort2,
      };
      const m2 = pieceAreaM2(pl) * item.qty;
      const ml = pieceEdgeMl(pl) * item.qty;
      totalM2 += m2;
      totalMl += ml;
      piezas.push([
        f.code, f.name, item.qty, p.name, p.code ?? '', p.qty * item.qty,
        p.length, p.width, materialName, si(p.grain), si(p.bandLong1), si(p.bandLong2), si(p.bandShort1), si(p.bandShort2),
        Number(m2.toFixed(3)), Number(ml.toFixed(2)),
      ]);
    }
  }
  piezas.push([]);
  piezas.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'TOTALES', Number(totalM2.toFixed(3)), Number(totalMl.toFixed(2))]);
  const wsPiezas = XLSX.utils.aoa_to_sheet(piezas);
  wsPiezas['!cols'] = Array.from({ length: 16 }, (_, i) => ({ wch: [10, 34, 9, 24, 18, 7, 9, 9, 16, 6, 9, 9, 9, 9, 10, 10][i] ?? 10 }));
  XLSX.utils.book_append_sheet(wb, wsPiezas, 'PIEZAS');

  /* ---------- Hoja HERRAJES ---------- */
  const herrajes: (string | number | null)[][] = [
    ['MÓDULO', 'CANT MOD', 'HERRAJE', 'CANT TOTAL', 'UNIDAD', 'COSTO UNIT.', 'SUBTOTAL'],
  ];
  const hwSummary = new Map<string, { unit: string; cost: number; qty: number; sub: number }>();
  for (const item of q.items) {
    const f = item.furniture;
    if (!f) continue;
    for (const hi of f.hardwareItems) {
      const h = hi.hardware;
      const qtyTotal = hi.qty * item.qty;
      const sub = qtyTotal * h.unitCost;
      herrajes.push([f.code, item.qty, h.name, qtyTotal, h.unit, round(h.unitCost), round(sub)]);
      const acc = hwSummary.get(h.name) ?? { unit: h.unit, cost: h.unitCost, qty: 0, sub: 0 };
      acc.qty += qtyTotal;
      acc.sub += sub;
      hwSummary.set(h.name, acc);
    }
  }
  herrajes.push([]);
  herrajes.push(['RESUMEN DE COMPRA DE HERRAJES']);
  herrajes.push(['HERRAJE', 'UNIDAD', 'CANTIDAD TOTAL', 'COSTO UNIT.', 'SUBTOTAL']);
  const hwRows = [...hwSummary.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, acc] of hwRows) {
    herrajes.push([name, acc.unit, acc.qty, round(acc.cost), round(acc.sub)]);
  }
  herrajes.push(['', '', '', 'TOTAL HERRAJES', round([...hwSummary.values()].reduce((a, x) => a + x.sub, 0))]);
  const wsHerrajes = XLSX.utils.aoa_to_sheet(herrajes);
  wsHerrajes['!cols'] = [{ wch: 18 }, { wch: 9 }, { wch: 34 }, { wch: 13 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsHerrajes, 'HERRAJES');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${q.folio}-produccion.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
