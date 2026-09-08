import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createQuotationFromInput, nextFolio } from '@/lib/server/queries';

type Params = { params: Promise<{ id: string }> };
const quotationInclude = { items: true, countertopMaterial: true };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const original = await db.quotation.findUnique({ where: { id }, include: quotationInclude });
    if (!original) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });

    // Obtener el folio que tendría la nueva cotización
    const tempCount = await db.quotation.count();
    const year = new Date().getFullYear();
    const previewFolio = `COT-${year}-${String(tempCount + 1).padStart(4, '0')}`;

    const copy = await createQuotationFromInput({
      clientName: `${original.clientName} (copia)`,
      clientPhone: original.clientPhone,
      clientEmail: original.clientEmail,
      notes: original.notes,
      finish: original.finish as 'BLANCO' | 'MADERADO',
      countertopMaterialId: original.countertopMaterialId,
      countertopMlOverride: original.countertopMlOverride,
      applyDistributor: original.applyDistributor,
      factor: original.factorSnapshot,
      laborPerUnit: original.laborSnapshot,
      items: original.items
        .filter((i) => i.furnitureId)
        .map((i) => ({ furnitureId: i.furnitureId as string, qty: i.qty })),
    });

    // Recalcular con los datos actuales del catálogo (createQuotationFromInput ya lo hace)
    void previewFolio;
    void nextFolio;
    return NextResponse.json(copy, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al duplicar cotización' }, { status: 400 });
  }
}
