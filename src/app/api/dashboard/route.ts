import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuditAlerts, getSettings } from '@/lib/server/queries';

export async function GET() {
  const [furnitureCount, piecesCount, materialsCount, hardwareCount, quotationsCount, alerts, settings] =
    await Promise.all([
      db.furniture.count(),
      db.piece.count(),
      db.material.count({ where: { active: true } }),
      db.hardware.count({ where: { active: true } }),
      db.quotation.count(),
      getAuditAlerts(),
      getSettings(),
    ]);
  return NextResponse.json({
    furnitureCount,
    piecesCount,
    materialsCount,
    hardwareCount,
    quotationsCount,
    alerts,
    settings,
  });
}
