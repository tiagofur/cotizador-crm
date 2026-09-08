import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const hardware = await db.hardware.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  return NextResponse.json(hardware);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    const hardware = await db.hardware.create({
      data: {
        name: body.name.trim(),
        unit: body.unit?.trim() || 'Pieza',
        unitCost: Number(body.unitCost) || 0,
        notes: body.notes ?? null,
        active: body.active ?? true,
      },
    });
    return NextResponse.json(hardware, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Ya existe un herraje con ese nombre' : 'Error al crear herraje';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
