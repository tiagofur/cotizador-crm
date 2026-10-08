/* Convierte una cotización en pedido: asigna código PED-YYYY-NNNN (solo una vez) */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/auth';
import { db } from '@/lib/db';
import { nextOrderCode } from '@/lib/server/queries';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const denied = await requireRole(_req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  try {
    const { id } = await params;
    const q = await db.quotation.findUnique({ where: { id } });
    if (!q) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });

    if (q.orderCode) {
      return NextResponse.json({ ...q, alreadyHadCode: true, message: 'Esta cotización ya tiene código de pedido' });
    }

    // Pedido solo si el cliente aceptó (fuera de SOLICITUD/BORRADOR/RECHAZADA)
    if (q.status === 'SOLICITUD' || q.status === 'BORRADOR' || q.status === 'RECHAZADA') {
      return NextResponse.json(
        { error: 'Solo se puede generar pedido de una cotización aceptada (cambia su estado primero)' },
        { status: 400 }
      );
    }
    // Tampoco con cortes aún estimados (pre-cotización del portal)
    if (q.cutsEstimated) {
      return NextResponse.json(
        { error: 'La solicitud tiene cortes estimados: captura las pasadas de sierra reales antes de generar el pedido' },
        { status: 400 }
      );
    }

    let orderCode = await nextOrderCode();
    // garantiza unicidad ante carreras/conteo distinto
    while (await db.quotation.findUnique({ where: { orderCode } })) {
      const year = new Date().getFullYear();
      const n = Number(orderCode.split('-')[2]) + 1;
      orderCode = `PED-${year}-${String(n).padStart(4, '0')}`;
    }

    // Cocina y maquila comparten ciclo: el pedido nace En Producción
    const updated = await db.quotation.update({
      where: { id },
      data: { orderCode, status: q.status === 'ACEPTADA' ? 'PRODUCCION' : q.status },
      include: { items: true, maquilaLines: { include: { material: true } } },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'No se pudo generar el pedido' }, { status: 500 });
  }
}
