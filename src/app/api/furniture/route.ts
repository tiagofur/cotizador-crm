import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { furnitureInclude } from '@/lib/server/queries';
import type { FurnitureInput } from '@/lib/types';

export async function GET() {
  const furniture = await db.furniture.findMany({
    include: furnitureInclude,
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(furniture);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as FurnitureInput;
    if (!body.code?.trim() || !body.name?.trim()) {
      return NextResponse.json({ error: 'Código y nombre son obligatorios' }, { status: 400 });
    }
    const maxOrder = await db.furniture.aggregate({ _max: { order: true } });
    const furniture = await db.furniture.create({
      data: {
        code: body.code.trim(),
        name: body.name.trim(),
        category: body.category?.trim() || 'Otro',
        width: Number(body.width) || 0,
        height: Number(body.height) || 0,
        depth: Number(body.depth) || 0,
        imageUrl: body.imageUrl ?? null,
        notes: body.notes ?? null,
        appliesCountertop: !!body.appliesCountertop,
        countertopWidthM: Number(body.countertopWidthM) || 0,
        order: (maxOrder._max.order ?? 0) + 1,
        pieces: {
          create: (body.pieces || []).map((p, i) => ({
            name: p.name?.trim() || 'Pieza',
            code: p.code ?? null,
            qty: Math.max(1, Number(p.qty) || 1),
            length: Number(p.length) || 0,
            width: Number(p.width) || 0,
            materialId: p.materialId || null,
            isFront: !!p.isFront,
            grain: !!p.grain,
            bandLong1: !!p.bandLong1,
            bandLong2: !!p.bandLong2,
            bandShort1: !!p.bandShort1,
            bandShort2: !!p.bandShort2,
            order: i,
          })),
        },
        hardwareItems: {
          create: (body.hardware || []).map((h) => ({
            hardwareId: h.hardwareId,
            qty: Math.max(1, Number(h.qty) || 1),
          })),
        },
      },
      include: furnitureInclude,
    });
    return NextResponse.json(furniture, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Ya existe un mueble con ese código' : 'Error al crear mueble';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
