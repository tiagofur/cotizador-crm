import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { COTIZACION_STATUSES, PEDIDO_STATUSES, type QuotationStatus } from '@/lib/types';
import { updateQuotationFromInput } from '@/lib/server/queries';

type Params = { params: Promise<{ id: string }> };
const quotationInclude = { items: { orderBy: { id: 'asc' as const } }, countertopMaterial: true, client: { select: { id: true, name: true, stage: true } } };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const quotation = await db.quotation.findUnique({
    where: { id },
    include: { ...quotationInclude, revisions: { orderBy: { rev: 'desc' as const } } },
  });
  if (!quotation) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  return NextResponse.json(quotation);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.clientId !== undefined) data.clientId = body.clientId || null;
    if (body.clientName !== undefined) data.clientName = String(body.clientName).trim();
    if (body.clientPhone !== undefined) data.clientPhone = body.clientPhone;
    if (body.clientEmail !== undefined) data.clientEmail = body.clientEmail;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.status !== undefined) {
      const current = await db.quotation.findUnique({ where: { id }, select: { orderCode: true } });
      const allowed = current?.orderCode ? PEDIDO_STATUSES : COTIZACION_STATUSES;
      if (!allowed.includes(body.status as QuotationStatus)) {
        return NextResponse.json(
          { error: `Un ${current?.orderCode ? 'pedido' : 'cotización'} no puede tener ese estado` },
          { status: 400 }
        );
      }
      data.status = body.status;
    }
    const quotation = await db.quotation.update({ where: { id }, data, include: quotationInclude });
    return NextResponse.json(quotation);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar cotización' }, { status: 400 });
  }
}

/** PUT: actualiza una cotización (pedidos generan revisión automática) */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const input = await req.json();
    if (!input.clientName?.trim()) {
      return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 });
    }
    if (!input.items?.length) {
      return NextResponse.json({ error: 'Agrega al menos un mueble a la cotización' }, { status: 400 });
    }
    const quotation = await updateQuotationFromInput(id, input);
    return NextResponse.json(quotation);
  } catch (e) {
    console.error('PUT /api/quotations/[id] error:', e);
    const message = e instanceof Error ? e.message : 'Error al actualizar la cotización';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await db.quotation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar cotización' }, { status: 400 });
  }
}
