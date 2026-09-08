import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  let settings = await db.settings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    settings = await db.settings.create({ data: { id: 'default' } });
  }
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = await db.settings.update({
      where: { id: 'default' },
      data: {
        companyName: body.companyName !== undefined ? String(body.companyName).trim() : undefined,
        companyPhone: body.companyPhone !== undefined ? body.companyPhone : undefined,
        companyEmail: body.companyEmail !== undefined ? body.companyEmail : undefined,
        companyAddress: body.companyAddress !== undefined ? body.companyAddress : undefined,
        saleFactor: body.saleFactor !== undefined ? Number(body.saleFactor) : undefined,
        ivaRate: body.ivaRate !== undefined ? Number(body.ivaRate) : undefined,
        distributorDiscount: body.distributorDiscount !== undefined ? Number(body.distributorDiscount) : undefined,
        laborPerUnit: body.laborPerUnit !== undefined ? Number(body.laborPerUnit) : undefined,
        countertopMultipleM: body.countertopMultipleM !== undefined ? Number(body.countertopMultipleM) : undefined,
        countertopFactor: body.countertopFactor !== undefined ? Number(body.countertopFactor) : undefined,
        currency: body.currency !== undefined ? String(body.currency) : undefined,
        maderadoMaterialId: body.maderadoMaterialId !== undefined ? body.maderadoMaterialId : undefined,
      },
    });
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 400 });
  }
}
