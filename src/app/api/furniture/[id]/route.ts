import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { furnitureInclude } from '@/lib/server/queries';
import type { FurnitureInput } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const furniture = await db.furniture.findUnique({ where: { id }, include: furnitureInclude });
  if (!furniture) return NextResponse.json({ error: 'Mueble no encontrado' }, { status: 404 });
  return NextResponse.json(furniture);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json() as FurnitureInput;
    if (!body.code?.trim() || !body.name?.trim()) {
      return NextResponse.json({ error: 'Código y nombre son obligatorios' }, { status: 400 });
    }
    // Reemplazar piezas y herrajes por completo
    await db.piece.deleteMany({ where: { furnitureId: id } });
    await db.furnitureHardware.deleteMany({ where: { furnitureId: id } });
    const furniture = await db.furniture.update({
      where: { id },
      data: {
        code: body.code.trim(),
        name: body.name.trim(),
        category: body.category?.trim() || 'Otro',
        width: Number(body.width) || 0,
        height: Number(body.height) || 0,
        depth: Number(body.depth) || 0,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        appliesCountertop: !!body.appliesCountertop,
        countertopWidthM: Number(body.countertopWidthM) || 0,
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
    return NextResponse.json(furniture);
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Ya existe un mueble con ese código' : 'Error al actualizar mueble';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const used = await db.quotationItem.count({ where: { furnitureId: id } });
    if (used > 0) {
      return NextResponse.json({ error: 'El mueble está usado en cotizaciones; no se puede eliminar' }, { status: 400 });
    }
    await db.furniture.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar mueble' }, { status: 400 });
  }
}
