import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/auth';
import { db } from '@/lib/db';
import { createQuotationFromInput, quotationInclude, type QuotationCreateInput } from '@/lib/server/queries';
import { sanitizeNums } from '@/lib/num';

const Q_NUM_KEYS = ['factorSnapshot', 'laborSnapshot', 'furnitureCost', 'furnitureSale', 'countertopMl', 'countertopCost', 'countertopSale', 'ivaAmount', 'totalWithIva', 'distributorFurniture', 'distributorCountertop', 'distributorIva', 'distributorTotal', 'cutUnitCost', 'edgeBandUnitCost', 'materialsTotal', 'servicesTotal'];
const MAQUILA_LINE_NUM_KEYS = ['edgeBandMl', 'unitSheetCost', 'unitBandCostMl'];

export async function GET(req: NextRequest) {
  const denied = await requireRole(req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  const quotations = await db.quotation.findMany({
    include: quotationInclude,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(
    quotations.map((q) => ({
      ...sanitizeNums(q as unknown as Record<string, unknown>, Q_NUM_KEYS, 2),
      client: q.client,
      items: q.items.map((it) => sanitizeNums(it as unknown as Record<string, unknown>, ['unitCost', 'unitPrice'], 2)),
      maquilaLines: q.maquilaLines.map((ln) => sanitizeNums(ln as unknown as Record<string, unknown>, MAQUILA_LINE_NUM_KEYS, 2)),
    }))
  );
}

export async function POST(req: NextRequest) {
  const denied = await requireRole(req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  try {
    const input = (await req.json()) as QuotationCreateInput;
    if (!input.clientName?.trim()) {
      return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 });
    }
    if ((input.kind ?? 'MUEBLE') === 'MAQUILA') {
      if (!input.maquilaLines?.length && !input.maquilaPieces?.length) {
        return NextResponse.json({ error: 'Agrega piezas del despiece o al menos un material a la maquila' }, { status: 400 });
      }
    } else if (!input.items?.length) {
      return NextResponse.json({ error: 'Agrega al menos un mueble a la cotización' }, { status: 400 });
    }
    const quotation = await createQuotationFromInput(input);
    return NextResponse.json(quotation, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al crear la cotización' }, { status: 400 });
  }
}
