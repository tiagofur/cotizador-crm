import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { furnitureInclude, getSettings } from '@/lib/server/queries';
import { sanitizeNums } from '@/lib/num';
import { effectiveCostPerM2 } from '@/lib/pricing';

const SETTINGS_NUM_KEYS = ['saleFactor', 'ivaRate', 'distributorDiscount', 'laborPerUnit', 'countertopMultipleM', 'countertopFactor', 'wasteFactorStandard', 'wasteFactorMaderado'];
const MATERIAL_NUM_KEYS = ['costPerM2', 'costPerMl', 'edgeBandCostMl', 'sheetWidth', 'sheetLength', 'sheetCost'];
const HARDWARE_NUM_KEYS = ['unitCost'];
const PIECE_NUM_KEYS = ['length', 'width'];
const FURNITURE_NUM_KEYS = ['width', 'height', 'depth', 'countertopWidthM'];

export async function GET() {
  const [furniture, materials, hardware, finishProfiles, settingsRaw] = await Promise.all([
    db.furniture.findMany({ include: furnitureInclude, orderBy: { order: 'asc' } }),
    db.material.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    db.hardware.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    db.finishProfile.findMany({ include: { bodyMaterial: true, frontMaterial: true }, orderBy: { order: 'asc' } }),
    getSettings(),
  ]);

  const settings = sanitizeNums(settingsRaw as unknown as Record<string, unknown>, SETTINGS_NUM_KEYS);
  const materialsClean = materials.map((raw) => {
    const m = sanitizeNums(raw as unknown as Record<string, unknown>, MATERIAL_NUM_KEYS, 4);
    if (m.type !== 'TABLERO') return m;
    const base = m.costPerM2;
    const derived = effectiveCostPerM2(
      m as unknown as Parameters<typeof effectiveCostPerM2>[0],
      Number(settings.wasteFactorStandard ?? 1),
      Number(settings.wasteFactorMaderado ?? 1)
    );
    return { ...m, costPerM2: derived, baseCostPerM2: base };
  });
  const hardwareClean = hardware.map((h) => sanitizeNums(h as unknown as Record<string, unknown>, HARDWARE_NUM_KEYS, 4));
  const furnitureClean = furniture.map((f) => ({
    ...sanitizeNums(f as unknown as Record<string, unknown>, FURNITURE_NUM_KEYS),
    pieces: f.pieces.map((p) => sanitizeNums(p as unknown as Record<string, unknown>, PIECE_NUM_KEYS)),
    hardwareItems: f.hardwareItems.map((hi) => ({
      ...hi,
      hardware: sanitizeNums(hi.hardware as unknown as Record<string, unknown>, HARDWARE_NUM_KEYS, 4),
    })),
  }));

  return NextResponse.json({
    furniture: furnitureClean,
    materials: materialsClean,
    hardware: hardwareClean,
    finishProfiles,
    settings,
  });
}
