import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/auth';
import fs from 'fs';
import {
  getDbPath,
  getDbHealth,
  listDbSnapshots,
  createDbSnapshot,
  restoreDbSnapshot,
  exportDatabaseJson,
} from '@/lib/server/backup';

export async function GET(req: NextRequest) {
  const denied = await requireRole(req, 'ADMIN');
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const download = searchParams.get('download');

    if (download === 'db') {
      const dbPath = getDbPath();
      if (!fs.existsSync(dbPath)) {
        return NextResponse.json({ error: 'Archivo de base de datos no encontrado' }, { status: 404 });
      }

      const fileBuffer = fs.readFileSync(dbPath);
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `cotizador_crm_backup_${dateStr}.db`;

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/x-sqlite3',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(fileBuffer.length),
        },
      });
    }

    if (download === 'json') {
      const jsonDump = await exportDatabaseJson();
      const jsonString = JSON.stringify(jsonDump, null, 2);
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `cotizador_crm_data_${dateStr}.json`;

      return new NextResponse(jsonString, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const health = await getDbHealth();
    const snapshots = listDbSnapshots();

    return NextResponse.json({
      health,
      snapshots,
    });
  } catch (error) {
    console.error('Error en /api/backup GET:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al consultar respaldos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireRole(req, 'ADMIN');
  if (denied) return denied;
  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'snapshot') {
      const snapshot = await createDbSnapshot();
      const snapshots = listDbSnapshots();
      return NextResponse.json({
        ok: true,
        message: `Respaldo ${snapshot.filename} creado exitosamente`,
        snapshot,
        snapshots,
      });
    }

    if (action === 'restore') {
      const filename = body.filename;
      if (!filename || typeof filename !== 'string') {
        return NextResponse.json({ error: 'Nombre de archivo no especificado' }, { status: 400 });
      }

      const result = await restoreDbSnapshot(filename);
      const health = await getDbHealth();
      const snapshots = listDbSnapshots();

      return NextResponse.json({
        ok: true,
        message: `Base de datos restaurada desde ${filename}. Se generó respaldo preventivo ${result.preBackup}.`,
        result,
        health,
        snapshots,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error) {
    console.error('Error en /api/backup POST:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al procesar respaldo' },
      { status: 500 }
    );
  }
}
