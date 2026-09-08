import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { furnitureInclude, getSettings } from '@/lib/server/queries';
import { sanitizeNums } from '@/lib/num';

const SETTINGS_NUM_KEYS = ['saleFactor', 'ivaRate', 'distributorDiscount', 'laborPerUnit', 'countertopMultipleM', 'countertopFactor'];
const MATERIAL_NUM_KEYS = ['costPerM2', 'costPerMl', 'edgeBandCostMl', 'sheetWidth', 'sheetLength', 'sheetCost'];
const HARDWARE_NUM_KEYS = ['unitCost'];
const PIECE_NUM_KEYS = ['length', 'width'];
const FURNITURE_NUM_KEYS = ['width', 'height', 'depth', 'countertopWidthM'];

export async function GET() {
  const [furniture, materials, hardware, settingsRaw] = await Promise.all([
    db.furniture.findMany({ include: furnitureInclude, orderBy: { order: 'asc' } }),
    db.material.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    db.hardware.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    getSettings(),
  ]);

  const settings = sanitizeNums(settingsRaw as unknown as Record<string, unknown>, SETTINGS_NUM_KEYS);
  const materialsClean = materials.map((m) => sanitizeNums(m as unknown as Record<string, unknown>, MATERIAL_NUM_KEYS, 4));
  const hardwareClean = hardware.map((h) => sanitizeNums(h as unknown as Record<string, unknown>, HARDWARE_NUM_KEYS, 4));
  const furnitureClean = furniture.map((f) => ({
    ...sanitizeNums(f as unknown as Record<string, unknown>, FURNITURE_NUM_KEYS),
    pieces: f.pieces.map((p) => sanitizeNums(p as unknown as Record<string, unknown>, PIECE_NUM_KEYS)),
    hardwareItems: f.hardwareItems.map((hi) => ({
      ...hi,
      hardware: sanitizeNums(hi.hardware as unknown as Record<string, unknown>, HARDWARE_NUM_KEYS, 4),
    })),
  }));

  return NextResponse.json({ furniture: furnitureClean, materials: materialsClean, hardware: hardwareClean, settings });
}
