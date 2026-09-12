import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clientInclude, serializeClient, parseStage, parseKind, parseDateInput } from '@/lib/server/crm';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export async function GET(req: NextRequest) {
  const q = norm(req.nextUrl.searchParams.get('q') ?? '');
  const stage = req.nextUrl.searchParams.get('stage');
  const kind = req.nextUrl.searchParams.get('kind');

  const clients = await db.client.findMany({
    include: clientInclude,
    orderBy: [{ updatedAt: 'desc' }],
  });

  const mapped = clients.map(serializeClient);
  const filtered = mapped.filter((c) => {
    if (stage && stage !== 'ALL' && c.stage !== stage) return false;
    if (kind && kind !== 'ALL' && c.kind !== kind) return false;
    if (!q) return true;
    const hay = norm([c.name, c.company, c.phone, c.email, c.city].filter(Boolean).join(' '));
    return hay.includes(q);
  });

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 });
    }
    const dup = await db.client.findFirst({ where: { name: { equals: name } } });
    if (dup) {
      return NextResponse.json({ error: 'Ya existe un cliente con ese nombre' }, { status: 409 });
    }
    const stage = parseStage(body.stage);
    const kind = parseKind(body.kind);
    const client = await db.client.create({
      data: {
        name,
        kind: kind ?? 'PROSPECTO',
        stage: stage ?? 'NUEVO',
        company: body.company ? String(body.company).trim() || null : null,
        phone: body.phone ? String(body.phone).trim() || null : null,
        email: body.email ? String(body.email).trim() || null : null,
        address: body.address ? String(body.address).trim() || null : null,
        city: body.city ? String(body.city).trim() || null : null,
        notes: body.notes ? String(body.notes).trim() || null : null,
        discountPercent:
          body.discountPercent === null || body.discountPercent === '' || body.discountPercent === undefined
            ? null
            : Math.max(0, Math.min(100, Number(String(body.discountPercent).replace(',', '.')) || 0)),
        nextFollowUpAt: parseDateInput(body.nextFollowUpAt, 'create') ?? null,
      },
      include: clientInclude,
    });
    return NextResponse.json(serializeClient(client), { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al crear el cliente' }, { status: 400 });
  }
}
