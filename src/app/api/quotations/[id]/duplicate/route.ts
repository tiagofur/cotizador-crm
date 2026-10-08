import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/auth';
import { db } from '@/lib/db';
import { createQuotationFromInput } from '@/lib/server/queries';

type Params = { params: Promise<{ id: string }> };
const quotationInclude = { items: true, maquilaLines: true, countertopMaterial: true };

export async function POST(_req: NextRequest, { params }: Params) {
  const denied = await requireRole(_req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  const { id } = await params;
  try {
    const original = await db.quotation.findUnique({ where: { id }, include: quotationInclude });
    if (!original) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });

    const esMaquila = (original.kind as string) === 'MAQUILA';

    const copy = await createQuotationFromInput({
      clientId: original.clientId,
      clientName: `${original.clientName} (copia)`,
      title: original.title ? `${original.title} (copia)` : null,
      distributorDiscount: original.distributorSnapshot ?? undefined,
      clientPhone: original.clientPhone,
      clientEmail: original.clientEmail,
      notes: original.notes,
      kind: esMaquila ? 'MAQUILA' : 'MUEBLE',
      finish: original.finish,
      countertopMaterialId: original.countertopMaterialId,
      countertopMlOverride: original.countertopMlOverride,
      applyDistributor: original.applyDistributor,
      factor: original.factorSnapshot,
      laborPerUnit: original.laborSnapshot,
      items: esMaquila
        ? []
        : original.items
            .filter((i) => i.furnitureId)
            .map((i) => ({ furnitureId: i.furnitureId as string, qty: i.qty })),
      // La copia de maquila recotiza con costos y tarifas vigentes
      maquilaLines: esMaquila
        ? original.maquilaLines.map((l) => ({
            materialId: l.materialId,
            sheetsQty: l.sheetsQty,
            edgeBandMl: l.edgeBandMl,
            notes: l.notes,
          }))
        : undefined,
      cutQty: esMaquila ? original.cutQty : undefined,
      cutCostPerPass: esMaquila ? original.cutUnitCost : undefined,
      edgeBandServiceCostMl: esMaquila ? original.edgeBandUnitCost : undefined,
    });

    // Recalcular con los datos actuales del catálogo (createQuotationFromInput ya lo hace)
    return NextResponse.json(copy, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al duplicar cotización' }, { status: 400 });
  }
}
