import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const hardware = await db.hardware.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name.trim() : undefined,
        unit: body.unit !== undefined ? body.unit : undefined,
        unitCost: body.unitCost !== undefined ? Number(body.unitCost) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        active: body.active !== undefined ? body.active : undefined,
      },
    });
    return NextResponse.json(hardware);
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Ya existe un herraje con ese nombre' : 'Error al actualizar herraje';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const used = await db.furnitureHardware.count({ where: { hardwareId: id } });
    if (used > 0) {
      await db.hardware.update({ where: { id }, data: { active: false } });
      return NextResponse.json({ ok: true, deactivated: true, message: 'Herraje en uso por muebles; se desactivó en lugar de eliminarse' });
    }
    await db.hardware.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar herraje' }, { status: 400 });
  }
}
