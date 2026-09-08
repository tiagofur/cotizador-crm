/* Seed la base de datos con los datos extraídos del Excel */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { computeQuoteTotals, type FurnitureLike, type MaterialLike } from '../src/lib/pricing';

const prisma = new PrismaClient();

interface SeedData {
  settings: {
    saleFactor: number; ivaRate: number; distributorDiscount: number; laborPerUnit: number;
    countertopMultipleM: number; countertopFactor: number; currency: string; companyName: string;
  };
  materials: Array<{
    name: string; type: string; costPerM2: number | null; costPerMl?: number | null;
    edgeBandCostMl: number | null; edgeBandName: string | null; sheetWidth: number | null;
    sheetLength: number | null; sheetCost: number | null; thickness: string | null;
    notes: string | null; isMaderado: boolean; active: boolean;
  }>;
  hardware: Array<{ name: string; unit: string; unitCost: number; active: boolean; notes: string | null }>;
  furniture: Array<{
    order: number; code: string; name: string; category: string; width: number; height: number;
    depth: number; appliesCountertop: boolean; countertopWidthM: number; imageUrl: string | null;
    notes: string | null;
    pieces: Array<{ name: string; code: string | null; qty: number; length: number; width: number; materialName: string; grain: boolean; bandLong1: boolean; bandLong2: boolean; bandShort1: boolean; bandShort2: boolean; order: number }>;
    hardware: Array<{ name: string; qty: number }>;
  }>;
  demoItems: Array<{ code: string; qty: number }>;
}

async function main() {
  const raw = fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf-8');
  const data: SeedData = JSON.parse(raw);

  console.log('Limpiando base de datos...');
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.furnitureHardware.deleteMany();
  await prisma.piece.deleteMany();
  await prisma.furniture.deleteMany();
  await prisma.hardware.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.material.deleteMany();

  console.log('Creando materiales...');
  const matMap = new Map<string, string>();
  for (const m of data.materials) {
    const created = await prisma.material.create({
      data: {
        name: m.name,
        type: m.type,
        costPerM2: m.type === 'TABLERO' ? m.costPerM2 : null,
        costPerMl: m.type === 'CUBIERTA' ? (m.costPerMl ?? 0) : null,
        edgeBandCostMl: m.edgeBandCostMl,
        edgeBandName: m.edgeBandName,
        sheetWidth: m.sheetWidth,
        sheetLength: m.sheetLength,
        sheetCost: m.sheetCost,
        thickness: m.thickness,
        notes: m.notes,
        isMaderado: m.isMaderado,
        active: m.active,
      },
    });
    matMap.set(m.name, created.id);
  }

  console.log('Creando herrajes...');
  const hwMap = new Map<string, string>();
  for (const h of data.hardware) {
    const created = await prisma.hardware.create({
      data: { name: h.name, unit: h.unit, unitCost: h.unitCost, active: h.active, notes: h.notes },
    });
    hwMap.set(h.name, created.id);
  }

  console.log('Creando configuración...');
  const maderadoMat = data.materials.find((m) => m.isMaderado);
  await prisma.settings.create({
    data: {
      id: 'default',
      companyName: data.settings.companyName,
      saleFactor: data.settings.saleFactor,
      ivaRate: data.settings.ivaRate,
      distributorDiscount: data.settings.distributorDiscount,
      laborPerUnit: data.settings.laborPerUnit,
      countertopMultipleM: data.settings.countertopMultipleM,
      countertopFactor: data.settings.countertopFactor,
      currency: data.settings.currency,
      maderadoMaterialId: maderadoMat ? matMap.get(maderadoMat.name) : null,
    },
  });

  console.log(`Creando ${data.furniture.length} muebles con despieces...`);
  const furnMap = new Map<string, { id: string; like: FurnitureLike }>();
  for (const f of data.furniture) {
    const created = await prisma.furniture.create({
      data: {
        code: f.code,
        name: f.name,
        category: f.category,
        width: f.width,
        height: f.height,
        depth: f.depth,
        appliesCountertop: f.appliesCountertop,
        countertopWidthM: f.countertopWidthM,
        order: f.order,
        imageUrl: f.imageUrl,
        notes: f.notes,
      },
    });
    for (const p of f.pieces) {
      await prisma.piece.create({
        data: {
          furnitureId: created.id,
          name: p.name,
          code: p.code,
          qty: p.qty,
          length: p.length,
          width: p.width,
          materialId: matMap.get(p.materialName) ?? null,
          grain: p.grain,
          bandLong1: p.bandLong1,
          bandLong2: p.bandLong2,
          bandShort1: p.bandShort1,
          bandShort2: p.bandShort2,
          order: p.order,
        },
      });
    }
    for (const h of f.hardware) {
      const hid = hwMap.get(h.name);
      if (!hid) { console.warn(`  ! herraje no encontrado: ${h.name} en ${f.code}`); continue; }
      await prisma.furnitureHardware.create({
        data: { furnitureId: created.id, hardwareId: hid, qty: h.qty },
      });
    }

    // construir FurnitureLike para el motor de precios
    const piecesLike = f.pieces.map((p) => {
      const matName = p.materialName;
      const matDef = data.materials.find((m) => m.name === matName);
      return {
        name: p.name, qty: p.qty, length: p.length, width: p.width,
        material: matDef ? ({
          id: matMap.get(matName)!, name: matName, type: matDef.type,
          costPerM2: matDef.type === 'TABLERO' ? matDef.costPerM2 : null,
          costPerMl: matDef.type === 'CUBIERTA' ? (matDef.costPerMl ?? 0) : null,
          edgeBandCostMl: matDef.edgeBandCostMl, isMaderado: matDef.isMaderado,
        } as MaterialLike) : null,
        grain: p.grain, bandLong1: p.bandLong1, bandLong2: p.bandLong2,
        bandShort1: p.bandShort1, bandShort2: p.bandShort2,
      };
    });
    const hwItems = f.hardware
      .filter((h) => hwMap.has(h.name))
      .map((h) => {
        const hd = data.hardware.find((x) => x.name === h.name)!;
        return { qty: h.qty, hardware: { id: hwMap.get(h.name)!, name: h.name, unit: hd.unit, unitCost: hd.unitCost } };
      });
    furnMap.set(f.code, {
      id: created.id,
      like: {
        id: created.id, code: f.code, name: f.name, category: f.category,
        width: f.width, height: f.height, depth: f.depth,
        appliesCountertop: f.appliesCountertop, countertopWidthM: f.countertopWidthM,
        pieces: piecesLike, hardwareItems: hwItems,
      },
    });
  }

  // ============ Cotizaciones demo ============
  console.log('Creando cotizaciones de demostración...');
  const maderadoMatLike: MaterialLike | null = maderadoMat
    ? {
        id: matMap.get(maderadoMat.name)!, name: maderadoMat.name, type: maderadoMat.type,
        costPerM2: maderadoMat.costPerM2, costPerMl: maderadoMat.costPerMl ?? null,
        edgeBandCostMl: maderadoMat.edgeBandCostMl, isMaderado: true,
      }
    : null;

  const year = new Date().getFullYear();
  const variants: Array<{ finish: 'BLANCO' | 'MADERADO'; clientName: string; status: string }> = [
    { finish: 'BLANCO', clientName: 'Cocina Demo (Público General)', status: 'BORRADOR' },
    { finish: 'MADERADO', clientName: 'Cocina Demo — Acabado Maderado', status: 'ENVIADA' },
  ];
  let n = 0;
  for (const v of variants) {
    n++;
    const items = data.demoItems
      .map((d) => ({ d, f: furnMap.get(d.code) }))
      .filter((x): x is { d: { code: string; qty: number }; f: { id: string; like: FurnitureLike } } => !!x.f)
      .map((x) => ({ furniture: x.f.like, qty: x.d.qty }));
    const totals = computeQuoteTotals({
      items,
      finish: v.finish,
      countertop: null,
      factor: data.settings.saleFactor,
      laborPerUnit: data.settings.laborPerUnit,
      ivaRate: data.settings.ivaRate,
      distributorDiscount: data.settings.distributorDiscount,
      countertopFactor: data.settings.countertopFactor,
      countertopMultipleM: data.settings.countertopMultipleM,
      maderadoMat: maderadoMatLike,
    });
    const folio = `COT-${year}-${String(n).padStart(4, '0')}`;
    const q = await prisma.quotation.create({
      data: {
        folio,
        clientName: v.clientName,
        notes: v.finish === 'BLANCO'
          ? 'Cotización de ejemplo importada del Excel (9 unidades).'
          : 'Mismo proyecto con acabado maderado (todas las piezas en VESTO NOUGAT).',
        finish: v.finish,
        applyDistributor: false,
        factorSnapshot: data.settings.saleFactor,
        laborSnapshot: data.settings.laborPerUnit,
        status: v.status,
        furnitureCost: totals.furnitureCost,
        furnitureSale: totals.furnitureSale,
        countertopMl: totals.countertopMl,
        countertopCost: totals.countertopCost,
        countertopSale: totals.countertopSale,
        ivaAmount: totals.ivaAmount,
        totalWithIva: totals.totalWithIva,
        distributorFurniture: totals.distributorFurniture,
        distributorCountertop: totals.distributorCountertop,
        distributorIva: totals.distributorIva,
        distributorTotal: totals.distributorTotal,
      },
    });
    for (const it of totals.perItem) {
      await prisma.quotationItem.create({
        data: {
          quotationId: q.id,
          furnitureId: it.furniture.id,
          qty: it.qty,
          code: it.furniture.code,
          name: it.furniture.name,
          width: it.furniture.width,
          height: it.furniture.height,
          depth: it.furniture.depth,
          unitCost: it.unitCost,
          unitPrice: it.unitPrice,
        },
      });
    }
    console.log(`  ${folio}: ${v.finish} — venta muebles $${totals.furnitureSale.toFixed(2)} + IVA = $${totals.totalWithIva.toFixed(2)}`);
  }

  const counts = {
    materiales: await prisma.material.count(),
    herrajes: await prisma.hardware.count(),
    muebles: await prisma.furniture.count(),
    piezas: await prisma.piece.count(),
    herrajesPorMueble: await prisma.furnitureHardware.count(),
    cotizaciones: await prisma.quotation.count(),
  };
  console.log('Seed completo:', counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
