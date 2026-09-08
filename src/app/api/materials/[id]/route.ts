import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const material = await db.material.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name.trim() : undefined,
        type: body.type !== undefined ? body.type : undefined,
        costPerM2: body.costPerM2 !== undefined ? body.costPerM2 : undefined,
        costPerMl: body.costPerMl !== undefined ? body.costPerMl : undefined,
        edgeBandCostMl: body.edgeBandCostMl !== undefined ? body.edgeBandCostMl : undefined,
        edgeBandName: body.edgeBandName !== undefined ? body.edgeBandName : undefined,
        sheetWidth: body.sheetWidth !== undefined ? body.sheetWidth : undefined,
        sheetLength: body.sheetLength !== undefined ? body.sheetLength : undefined,
        sheetCost: body.sheetCost !== undefined ? body.sheetCost : undefined,
        thickness: body.thickness !== undefined ? body.thickness : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        isMaderado: body.isMaderado !== undefined ? body.isMaderado : undefined,
        active: body.active !== undefined ? body.active : undefined,
      },
    });
    return NextResponse.json(material);
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Ya existe un material con ese nombre' : 'Error al actualizar material';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    // Verificar uso en piezas
    const used = await db.piece.count({ where: { materialId: id } });
    if (used > 0) {
      // desactivar en lugar de eliminar
      await db.material.update({ where: { id }, data: { active: false } });
      return NextResponse.json({ ok: true, deactivated: true, message: 'Material en uso por piezas; se desactivó en lugar de eliminarse' });
    }
    const usedCubierta = await db.quotation.count({ where: { countertopMaterialId: id } });
    if (usedCubierta > 0) {
      await db.material.update({ where: { id }, data: { active: false } });
      return NextResponse.json({ ok: true, deactivated: true, message: 'Material usado en cotizaciones; se desactivó en lugar de eliminarse' });
    }
    await db.material.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar material' }, { status: 400 });
  }
}
