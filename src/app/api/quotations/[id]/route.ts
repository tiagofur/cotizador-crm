import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/auth';
import { db } from '@/lib/db';
import { COTIZACION_STATUSES, PEDIDO_STATUSES, type QuotationStatus } from '@/lib/types';
import { updateQuotationFromInput, quotationInclude } from '@/lib/server/queries';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const denied = await requireRole(_req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  const { id } = await params;
  const quotation = await db.quotation.findUnique({
    where: { id },
    include: { ...quotationInclude, revisions: { orderBy: { rev: 'desc' as const } } },
  });
  if (!quotation) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  return NextResponse.json(quotation);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireRole(req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.clientId !== undefined) data.clientId = body.clientId || null;
    if (body.clientName !== undefined) data.clientName = String(body.clientName).trim();
    if (body.clientPhone !== undefined) data.clientPhone = body.clientPhone;
    if (body.clientEmail !== undefined) data.clientEmail = body.clientEmail;
    if (body.notes !== undefined) data.notes = body.notes;
    // Fecha estimada de entrega manual ('yyyy-MM-dd' → medianoche local; null para limpiar)
    if (body.estimatedDeliveryAt !== undefined) {
      const v = body.estimatedDeliveryAt;
      if (v === null || v === '') {
        data.estimatedDeliveryAt = null;
      } else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
        data.estimatedDeliveryAt = new Date(`${v.trim()}T00:00:00`);
      } else {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: 'La fecha de entrega no es válida' }, { status: 400 });
        }
        data.estimatedDeliveryAt = d;
      }
    }
    if (body.status !== undefined) {
      const current = await db.quotation.findUnique({
        where: { id },
        select: { orderCode: true, cutsEstimated: true },
      });
      if (!current) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
      const allowed = current.orderCode ? PEDIDO_STATUSES : COTIZACION_STATUSES;
      if (!allowed.includes(body.status as QuotationStatus)) {
        return NextResponse.json(
          { error: `Un ${current.orderCode ? 'pedido' : 'cotización'} no puede tener ese estado` },
          { status: 400 }
        );
      }
      // La pre-cotización del portal no se formaliza con cortes estimados
      const formaliza = !['SOLICITUD', 'CANCELADA', 'RECHAZADA'].includes(body.status as QuotationStatus);
      if (formaliza && current.cutsEstimated) {
        return NextResponse.json(
          { error: 'La solicitud tiene cortes estimados: captura las pasadas de sierra reales antes de enviarla' },
          { status: 400 }
        );
      }
      data.status = body.status;
    }
    const quotation = await db.quotation.update({ where: { id }, data, include: quotationInclude });
    return NextResponse.json(quotation);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar cotización' }, { status: 400 });
  }
}

/** PUT: actualiza una cotización (pedidos generan revisión automática) */
export async function PUT(req: NextRequest, { params }: Params) {
  const denied = await requireRole(req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  try {
    const { id } = await params;
    const input = await req.json();
    if (!input.clientName?.trim()) {
      return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 });
    }
    if ((input.kind ?? 'MUEBLE') === 'MAQUILA') {
      if (!input.maquilaLines?.length && !input.maquilaPieces?.length) {
        return NextResponse.json({ error: 'Agrega piezas del despiece o al menos un material a la maquila' }, { status: 400 });
      }
    } else if (!input.items?.length) {
      return NextResponse.json({ error: 'Agrega al menos un mueble a la cotización' }, { status: 400 });
    }
    const quotation = await updateQuotationFromInput(id, input);
    return NextResponse.json(quotation);
  } catch (e) {
    console.error('PUT /api/quotations/[id] error:', e);
    const message = e instanceof Error ? e.message : 'Error al actualizar la cotización';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = await requireRole(_req, 'ADMIN');
  if (denied) return denied;
  const { id } = await params;
  try {
    await db.quotation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar cotización' }, { status: 400 });
  }
}
