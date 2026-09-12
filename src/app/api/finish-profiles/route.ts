import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const BUILT_IN = ['BLANCO', 'MADERADO'];

export async function GET() {
  const profiles = await db.finishProfile.findMany({
    include: { bodyMaterial: true, frontMaterial: true },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ error: 'El nombre del acabado es requerido' }, { status: 400 });
    }
    if (await db.finishProfile.findFirst({ where: { name } })) {
      return NextResponse.json({ error: 'Ya existe un acabado con ese nombre' }, { status: 409 });
    }
    const last = await db.finishProfile.findFirst({ orderBy: { order: 'desc' } });
    const profile = await db.finishProfile.create({
      data: {
        id: `FP-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
        name,
        usePieceMaterials: Boolean(body.usePieceMaterials),
        bodyMaterialId: body.bodyMaterialId || null,
        frontMaterialId: body.frontMaterialId || null,
        active: body.active !== false,
        order: (last?.order ?? 0) + 1,
      },
      include: { bodyMaterial: true, frontMaterial: true },
    });
    return NextResponse.json(profile, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'No se pudo crear el acabado' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body.id ?? '');
    if (!id) return NextResponse.json({ error: 'Falta el id del acabado' }, { status: 400 });
    if (BUILT_IN.includes(id) && body.active === false) {
      return NextResponse.json({ error: 'Los acabados Blanco y Maderado no se pueden desactivar' }, { status: 400 });
    }
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
      const dup = await db.finishProfile.findFirst({ where: { name, NOT: { id } } });
      if (dup) return NextResponse.json({ error: 'Ya existe un acabado con ese nombre' }, { status: 409 });
      data.name = name;
    }
    if (body.usePieceMaterials !== undefined) data.usePieceMaterials = Boolean(body.usePieceMaterials);
    if (body.bodyMaterialId !== undefined) data.bodyMaterialId = body.bodyMaterialId || null;
    if (body.frontMaterialId !== undefined) data.frontMaterialId = body.frontMaterialId || null;
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.order !== undefined) data.order = Number(body.order);
    const profile = await db.finishProfile.update({
      where: { id },
      data,
      include: { bodyMaterial: true, frontMaterial: true },
    });
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar el acabado' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  if (BUILT_IN.includes(id)) {
    return NextResponse.json({ error: 'Los acabados Blanco y Maderado no se pueden eliminar' }, { status: 400 });
  }
  const used = await db.quotation.count({ where: { finish: id } });
  if (used > 0) {
    // No se elimina si hay cotizaciones que lo usan; se desactiva
    await db.finishProfile.update({ where: { id }, data: { active: false } });
    return NextResponse.json({
      deactivated: true,
      message: `Hay ${used} cotización(es) con este acabado; se desactivó en lugar de eliminarse.`,
    });
  }
  await db.finishProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
