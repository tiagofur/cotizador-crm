import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clientInclude, serializeClient, parseStage, parseKind, parseDateInput } from '@/lib/server/crm';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id }, include: clientInclude });
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  return NextResponse.json(serializeClient(client));
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
      data.name = name;
    }
    if (body.stage !== undefined) {
      const stage = parseStage(body.stage);
      if (!stage) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
      data.stage = stage;
    }
    if (body.kind !== undefined) {
      const kind = parseKind(body.kind);
      if (!kind) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
      data.kind = kind;
    }
    for (const k of ['company', 'phone', 'email', 'address', 'city', 'notes'] as const) {
      if (body[k] !== undefined) data[k] = body[k] ? String(body[k]).trim() || null : null;
    }
    if (body.discountPercent !== undefined) {
      data.discountPercent =
        body.discountPercent === null || body.discountPercent === ''
          ? null
          : Math.max(0, Math.min(100, Number(String(body.discountPercent).replace(',', '.')) || 0));
    }
    if (body.lastContactAt !== undefined) data.lastContactAt = parseDateInput(body.lastContactAt, 'patch');
    if (body.nextFollowUpAt !== undefined) data.nextFollowUpAt = parseDateInput(body.nextFollowUpAt, 'patch');

    const client = await db.client.update({ where: { id }, data, include: clientInclude });
    return NextResponse.json(serializeClient(client));
  } catch {
    return NextResponse.json({ error: 'Error al actualizar el cliente' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const quotations = await db.quotation.count({ where: { clientId: id } });
    if (quotations > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: el cliente tiene ${quotations} cotización(es). Elimina o desvincula las cotizaciones primero.` },
        { status: 409 }
      );
    }
    await db.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar el cliente' }, { status: 400 });
  }
}
