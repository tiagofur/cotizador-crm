import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createQuotationFromInput, type QuotationCreateInput } from '@/lib/server/queries';
import { sanitizeNums } from '@/lib/num';

const Q_NUM_KEYS = ['factorSnapshot', 'laborSnapshot', 'furnitureCost', 'furnitureSale', 'countertopMl', 'countertopCost', 'countertopSale', 'ivaAmount', 'totalWithIva', 'distributorFurniture', 'distributorCountertop', 'distributorIva', 'distributorTotal'];

const quotationInclude = { items: { orderBy: { id: 'asc' as const } }, countertopMaterial: true, client: { select: { id: true, name: true, stage: true } } };

export async function GET() {
  const quotations = await db.quotation.findMany({
    include: quotationInclude,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(
    quotations.map((q) => ({
      ...sanitizeNums(q as unknown as Record<string, unknown>, Q_NUM_KEYS, 2),
      client: q.client,
      items: q.items.map((it) => sanitizeNums(it as unknown as Record<string, unknown>, ['unitCost', 'unitPrice'], 2)),
    }))
  );
}

export async function POST(req: NextRequest) {
  try {
    const input = (await req.json()) as QuotationCreateInput;
    if (!input.clientName?.trim()) {
      return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 });
    }
    if (!input.items?.length) {
      return NextResponse.json({ error: 'Agrega al menos un mueble a la cotización' }, { status: 400 });
    }
    const quotation = await createQuotationFromInput(input);
    return NextResponse.json(quotation, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al crear la cotización' }, { status: 400 });
  }
}
