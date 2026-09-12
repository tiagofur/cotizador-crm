import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseInteractionType } from '@/lib/server/crm';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.type !== undefined) {
      const type = parseInteractionType(body.type);
      if (!type) return NextResponse.json({ error: 'Tipo de interacción inválido' }, { status: 400 });
      data.type = type;
    }
    if (body.subject !== undefined) data.subject = body.subject ? String(body.subject).trim() || null : null;
    if (body.content !== undefined) {
      const content = String(body.content).trim();
      if (!content) return NextResponse.json({ error: 'La descripción no puede estar vacía' }, { status: 400 });
      data.content = content;
    }
    if (body.occurredAt !== undefined) {
      const d = body.occurredAt ? new Date(String(body.occurredAt)) : null;
      if (body.occurredAt && isNaN(d!.getTime())) {
        return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
      }
      data.occurredAt = d;
    }
    const interaction = await db.interaction.update({ where: { id }, data });
    return NextResponse.json(interaction);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar la interacción' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await db.interaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar la interacción' }, { status: 400 });
  }
}
