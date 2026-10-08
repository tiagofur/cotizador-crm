import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/auth';
import { db } from '@/lib/db';
import { clientInclude, serializeClient, parseStage, parseInteractionType, parseDateInput } from '@/lib/server/crm';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const denied = await requireRole(_req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  const interactions = await db.interaction.findMany({
    where: { clientId: id },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json(interactions);
}

export async function POST(req: NextRequest, { params }: Params) {
  const denied = await requireRole(req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await req.json();
    const client = await db.client.findUnique({ where: { id } });
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

    const content = String(body.content ?? '').trim();
    if (!content) {
      return NextResponse.json({ error: 'La nota o descripción es obligatoria' }, { status: 400 });
    }
    const type = parseInteractionType(body.type) ?? 'NOTA';
    const stage = parseStage(body.stage);
    const occurredAt = parseDateInput(body.occurredAt, 'create') ?? new Date();
    // El último contacto no retrocede al registrar una interacción con fecha pasada
    const lastContactAt =
      client.lastContactAt && client.lastContactAt > occurredAt ? client.lastContactAt : occurredAt;

    const [interaction] = await db.$transaction([
      db.interaction.create({
        data: {
          clientId: id,
          type,
          subject: body.subject ? String(body.subject).trim() || null : null,
          content,
          occurredAt,
        },
      }),
      db.client.update({
        where: { id },
        data: {
          lastContactAt,
          ...(stage ? { stage } : {}),
          nextFollowUpAt: body.nextFollowUpAt !== undefined ? parseDateInput(body.nextFollowUpAt, 'create') ?? null : undefined,
        },
      }),
    ]);

    const updated = await db.client.findUnique({ where: { id }, include: clientInclude });
    return NextResponse.json({ interaction, client: updated ? serializeClient(updated) : null }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al registrar la interacción' }, { status: 400 });
  }
}
