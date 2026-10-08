import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/auth';
import { db } from '@/lib/db';
import { clientInclude, serializeClient, parseInteractionType } from '@/lib/server/crm';

type Params = { params: Promise<{ id: string }> };

/** Recalcula el último contacto del cliente según su historial real */
async function syncLastContact(clientId: string) {
  const last = await db.interaction.findFirst({
    where: { clientId },
    orderBy: { occurredAt: 'desc' },
    select: { occurredAt: true },
  });
  await db.client.update({
    where: { id: clientId },
    data: { lastContactAt: last ? last.occurredAt : null },
  });
}

async function updatedClient(clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, include: clientInclude });
  return client ? serializeClient(client) : null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireRole(req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
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
      if (!body.occurredAt || !d || isNaN(d.getTime())) {
        return NextResponse.json({ error: 'La fecha de la interacción es obligatoria' }, { status: 400 });
      }
      data.occurredAt = d;
    }
    const interaction = await db.interaction.update({ where: { id }, data });
    if (data.occurredAt !== undefined) await syncLastContact(interaction.clientId);
    const client = await updatedClient(interaction.clientId);
    return NextResponse.json({ interaction, client });
  } catch {
    return NextResponse.json({ error: 'Error al actualizar la interacción' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = await requireRole(_req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  const { id } = await params;
  try {
    const existing = await db.interaction.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Interacción no encontrada' }, { status: 404 });
    await db.interaction.delete({ where: { id } });
    await syncLastContact(existing.clientId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar la interacción' }, { status: 400 });
  }
}
