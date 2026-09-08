import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const materials = await db.material.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  return NextResponse.json(materials);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    const material = await db.material.create({
      data: {
        name: body.name.trim(),
        type: body.type === 'CUBIERTA' ? 'CUBIERTA' : 'TABLERO',
        costPerM2: body.costPerM2 ?? null,
        costPerMl: body.costPerMl ?? null,
        edgeBandCostMl: body.edgeBandCostMl ?? null,
        edgeBandName: body.edgeBandName ?? null,
        sheetWidth: body.sheetWidth ?? null,
        sheetLength: body.sheetLength ?? null,
        sheetCost: body.sheetCost ?? null,
        thickness: body.thickness ?? null,
        notes: body.notes ?? null,
        isMaderado: !!body.isMaderado,
        active: body.active ?? true,
      },
    });
    return NextResponse.json(material, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Ya existe un material con ese nombre' : 'Error al crear material';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
