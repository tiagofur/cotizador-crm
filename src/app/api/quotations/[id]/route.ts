import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { QUOTATION_STATUSES } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };
const quotationInclude = { items: { orderBy: { id: 'asc' as const } }, countertopMaterial: true };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const quotation = await db.quotation.findUnique({ where: { id }, include: quotationInclude });
  if (!quotation) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  return NextResponse.json(quotation);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.clientName !== undefined) data.clientName = String(body.clientName).trim();
    if (body.clientPhone !== undefined) data.clientPhone = body.clientPhone;
    if (body.clientEmail !== undefined) data.clientEmail = body.clientEmail;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.status !== undefined) {
      if (!QUOTATION_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
      }
      data.status = body.status;
    }
    const quotation = await db.quotation.update({ where: { id }, data, include: quotationInclude });
    return NextResponse.json(quotation);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar cotización' }, { status: 400 });
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
