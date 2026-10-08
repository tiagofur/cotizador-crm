import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

const DB_REL_PATH = 'db/custom.db';
const BACKUP_DIR_REL = 'backups';

export function getDbPath(): string {
  return path.join(process.cwd(), DB_REL_PATH);
}

export function getBackupDir(): string {
  const dir = path.join(process.cwd(), BACKUP_DIR_REL);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export interface SnapshotInfo {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Crea un snapshot inmediato del archivo de base de datos */
export async function createDbSnapshot(prefix = 'custom'): Promise<SnapshotInfo> {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error('El archivo de base de datos no existe.');
  }

  // Forzar checkpoint de WAL en SQLite para garantizar que todas las páginas estén en el archivo principal
  try {
    await db.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // Si falla el checkpoint directo, continuar con la copia normal
  }

  const backupDir = getBackupDir();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `${prefix}_${timestamp}.db`;
  const targetPath = path.join(backupDir, filename);

  fs.copyFileSync(dbPath, targetPath);

  const stats = fs.statSync(targetPath);

  // Mantener solo los últimos 20 snapshots
  cleanOldSnapshots(20);

  return {
    filename,
    sizeBytes: stats.size,
    sizeFormatted: formatBytes(stats.size),
    createdAt: stats.mtime.toISOString(),
  };
}

/** Lista los snapshots disponibles en la carpeta de respaldos */
export function listDbSnapshots(): SnapshotInfo[] {
  const backupDir = getBackupDir();
  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db'));

  return files
    .map((filename) => {
      const fullPath = path.join(backupDir, filename);
      try {
        const stats = fs.statSync(fullPath);
        return {
          filename,
          sizeBytes: stats.size,
          sizeFormatted: formatBytes(stats.size),
          createdAt: stats.mtime.toISOString(),
        };
      } catch {
        return null;
      }
    })
    .filter((s): s is SnapshotInfo => s !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Elimina backups viejos superando el límite */
function cleanOldSnapshots(keepCount = 20): void {
  const snapshots = listDbSnapshots();
  if (snapshots.length > keepCount) {
    const toDelete = snapshots.slice(keepCount);
    const backupDir = getBackupDir();
    for (const snap of toDelete) {
      try {
        fs.unlinkSync(path.join(backupDir, snap.filename));
      } catch {
        // Ignorar errores al limpiar archivos viejos
      }
    }
  }
}

/** Restaura la base de datos a partir de un snapshot con respaldo preventivo previo */
export async function restoreDbSnapshot(filename: string): Promise<{ restoredFrom: string; preBackup: string }> {
  const backupDir = getBackupDir();
  const snapshotPath = path.join(backupDir, filename);
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`El snapshot ${filename} no existe.`);
  }

  // 1. Crear respaldo preventivo antes de sobrescribir
  const preBackup = await createDbSnapshot('pre_restore');

  // 2. Cerrar/desconectar temporalmente si es necesario y copiar snapshot
  const dbPath = getDbPath();
  fs.copyFileSync(snapshotPath, dbPath);

  // 3. Eliminar archivos WAL y SHM temporales si existen para que SQLite lea limpio
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  return {
    restoredFrom: filename,
    preBackup: preBackup.filename,
  };
}

/** Exportación completa a JSON con estructura legible de todas las tablas */
export async function exportDatabaseJson() {
  const [
    settings,
    materials,
    hardware,
    furniture,
    finishProfiles,
    clients,
    quotations,
  ] = await Promise.all([
    db.settings.findMany(),
    db.material.findMany(),
    db.hardware.findMany(),
    db.furniture.findMany({
      include: {
        pieces: true,
        hardwareItems: true,
      },
    }),
    db.finishProfile.findMany(),
    db.client.findMany({
      include: {
        interactions: true,
      },
    }),
    db.quotation.findMany({
      include: {
        items: true,
        revisions: true,
      },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    app: 'Cotizador CRM Nahú Cocinas',
    counts: {
      settings: settings.length,
      materials: materials.length,
      hardware: hardware.length,
      furniture: furniture.length,
      finishProfiles: finishProfiles.length,
      clients: clients.length,
      quotations: quotations.length,
    },
    data: {
      settings,
      materials,
      hardware,
      furniture,
      finishProfiles,
      clients,
      quotations,
    },
  };
}

/** Información de salud y tamaño de la base de datos */
export async function getDbHealth() {
  const dbPath = getDbPath();
  const exists = fs.existsSync(dbPath);
  let sizeFormatted = '0 B';
  let sizeBytes = 0;

  if (exists) {
    const stats = fs.statSync(dbPath);
    sizeBytes = stats.size;
    sizeFormatted = formatBytes(stats.size);
  }

  let journalMode = 'unknown';
  try {
    const res: unknown = await db.$queryRawUnsafe('PRAGMA journal_mode;');
    if (Array.isArray(res) && res[0] && typeof res[0] === 'object') {
      journalMode = String(Object.values(res[0])[0]);
    }
  } catch {
    // Ignorar si falla
  }

  const [clientsCount, quotationsCount, furnitureCount] = await Promise.all([
    db.client.count().catch(() => 0),
    db.quotation.count().catch(() => 0),
    db.furniture.count().catch(() => 0),
  ]);

  return {
    exists,
    sizeBytes,
    sizeFormatted,
    journalMode,
    isWal: journalMode.toLowerCase() === 'wal',
    counts: {
      clients: clientsCount,
      quotations: quotationsCount,
      furniture: furnitureCount,
    },
  };
}
