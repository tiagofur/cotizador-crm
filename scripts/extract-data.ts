/* Extract all data from Cotizador_Muebles_Auditado.xlsx into seed-data.json */
import * as XLSX from 'xlsx';
import fs from 'fs';

const SRC = '/home/z/my-project/upload/Cotizador_Muebles_Auditado.xlsx';
const OUT = '/home/z/my-project/prisma/seed-data.json';

const wb = XLSX.readFile(SRC, { cellDates: false });
const S = {
  muebles: 'MUEBLES',
  resumen: '📊 Resumen y Cotización',
  cubiertas: '🧱 Cubiertas',
  bla: '📋 Explosión y Despiece Bla',
  mad: '📋 Explosión y Despiece Mad',
  config: '⚙️ Configuración Costos',
};

function rowsOf(name: string): unknown[][] {
  const ws = wb.Sheets[name];
  return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
}
const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/* ---------- 1. Materials & hardware from Configuración ---------- */
const cfgRows = rowsOf(S.config);

// Tableros: rows 3-4 (col0 name, col1 cost/m2, col2 notes) + hoja info cols 8..13
// Cintillas: rows 3-5 col4 name, col5 cost/ML, col6 type
// Hoja: rows 3-6 col8 name, col9 ancho, col10 largo, col12 cost
const sheetInfo: Record<string, { w: number; l: number; cost: number }> = {};
for (const r of cfgRows) {
  const name = str(r[8]);
  if (name && num(r[9]) > 0) sheetInfo[name] = { w: num(r[9]), l: num(r[10]), cost: num(r[12]) };
}
const cintillas: Record<string, { cost: number; type: string }> = {};
for (const r of cfgRows) {
  const name = str(r[4]);
  if (name && num(r[5]) > 0) cintillas[name] = { cost: num(r[5]), type: str(r[6]) };
}
const materials: any[] = [];
const CUBIERTA_NAMES = ['GRANITO', 'MELAMINA', 'SIN CUBIERTA'];
// Tableros: solo la sección superior (filas 0..6) de la hoja de configuración
cfgRows.forEach((r, idx) => {
  if (idx > 6) return;
  const name = str(r[0]);
  if (!name || CUBIERTA_NAMES.includes(name)) return;
  const cost = num(r[1]);
  if (cost <= 0) return;
  const key = name + ' MDF 15mm';
  const si = sheetInfo[key] || sheetInfo[name] || null;
  const ci = cintillas[name] || null;
  materials.push({
    name,
    type: 'TABLERO',
    costPerM2: cost,
    edgeBandCostMl: ci ? ci.cost : null,
    edgeBandName: ci ? ci.type : null,
    sheetWidth: si ? si.w : null,
    sheetLength: si ? si.l : null,
    sheetCost: si ? si.cost : null,
    thickness: null,
    notes: str(r[2]) || null,
    isMaderado: name === 'VESTO NOUGAT',
    active: true,
  });
});
// Extra board sheets (Blanco Hidrofugo / Lamina Merino) from hoja table rows 5-6
for (const [name, si] of Object.entries(sheetInfo)) {
  if (materials.some((m) => name.startsWith(m.name))) continue;
  const cost = si.cost / ((si.w * si.l) / 1_000_000);
  materials.push({
    name: name.replace(' MDF 15mm', '').replace(' 16mm', ''),
    type: 'TABLERO',
    costPerM2: Math.round(cost * 100) / 100,
    edgeBandCostMl: null,
    edgeBandName: null,
    sheetWidth: si.w,
    sheetLength: si.l,
    sheetCost: si.cost,
    thickness: name.includes('16') ? '16mm' : '15mm',
    notes: 'Tablero para cubiertas de melamina (combinado con lámina)',
    isMaderado: false,
    active: true,
  });
}
// Cubiertas rows 21-23: col0 name, col1 cost/ML, col2 notes, col4+ extra notes
for (const r of cfgRows) {
  const name = str(r[0]);
  if (!['GRANITO', 'MELAMINA', 'SIN CUBIERTA'].includes(name)) continue;
  let notes = str(r[2]);
  const extra = [str(r[4]), str(r[5]), str(r[6])].filter(Boolean).join(' | ');
  if (extra) notes = (notes ? notes + '. ' : '') + extra;
  materials.push({ name, type: 'CUBIERTA', costPerM2: null, costPerMl: num(r[1]), edgeBandCostMl: null, edgeBandName: null, sheetWidth: null, sheetLength: null, sheetCost: null, thickness: null, notes: notes || null, isMaderado: false, active: true });
}

// Hardware ACTIVOS: rows 9-18 (col0, col1, col2)
const hardware: any[] = [];
const seen = new Set<string>();
for (const r of cfgRows) {
  const name = str(r[0]);
  const cost = num(r[1]);
  if (!name || cost <= 0 || seen.has(name)) continue;
  if (['GRANITO', 'MELAMINA', 'SIN CUBIERTA'].includes(name)) continue;
  // only rows under the ACTIVE hardware section (before row index of 'Cubiertas' title)
  hardware.push({ name, unitCost: cost, unit: str(r[2]) || 'Pieza', active: true, notes: null });
  seen.add(name);
}
const isRefSection = (rowIdx: number) => rowIdx >= 24; // reference sections start ~R24
cfgRows.forEach((r, i) => {
  const name = str(r[0]);
  if (i < 24 || !name) return;
  const cost = num(r[1]);
  if (['Bisagra', 'Bisagra Clip', 'Bisagra Eko Line', 'Bisagra Eko Line Cierre Lento', 'Corredera Telescópica 500mm', 'Corredera Telescópica 500mm CS', 'Jaladera Tubular 128mm', 'taquete par abisagra'].includes(name)) {
    if (!seen.has(name)) {
      hardware.push({ name, unitCost: cost, unit: str(r[2]) || 'Pieza', active: false, notes: 'Referencia proveedor (no activo)' });
      seen.add(name);
    }
  }
});
// Fix Taquetes unit (missing in config)
const taq = hardware.find((h) => h.name === 'Taquetes de Madera 8x30mm');
if (taq && !taq.unit) taq.unit = 'Pieza';

/* ---------- 2. Despiece parsing (BLA canonical) ---------- */
function parseDespiece(name: string) {
  const rows = rowsOf(name);
  const modules: Record<string, { pieces: any[]; hardware: Map<string, number> }> = {};
  let currentModule: string | null = null;
  for (const r of rows) {
    const c0 = str(r[0]);
    const code = str(r[10]);
    if (code) {
      currentModule = code;
      if (!modules[code]) modules[code] = { pieces: [], hardware: new Map() };
      const qty = num(r[0]);
      const desc = str(r[3]);
      if (str(r[4]) === 'HERRAJE') {
        modules[code].hardware.set(desc, (modules[code].hardware.get(desc) || 0) + qty);
      } else {
        modules[code].pieces.push({
          name: desc,
          code: str(r[11]) || null,
          qty,
          length: num(r[1]),
          width: num(r[2]),
          materialName: str(r[4]),
          grain: num(r[5]) === 1,
          bandLong1: num(r[6]) === 1,
          bandLong2: num(r[7]) === 1,
          bandShort1: num(r[8]) === 1,
          bandShort2: num(r[9]) === 1,
        });
      }
    } else if (c0 && !c0.startsWith('TOTALES') && c0 !== 'Cantidad') {
      // module title row (no code) - ignore, code comes from data rows
    }
  }
  return modules;
}
const blaMod = parseDespiece(S.bla);
const madMod = parseDespiece(S.mad);

/* ---------- 3. MUEBLES list + Cubiertas info + Resumen ---------- */
const mueblesRows = rowsOf(S.muebles);
const cubiertasRows = rowsOf(S.cubiertas);
const cubInfo: Record<string, { aplica: boolean; ancho: number }> = {};
for (const r of cubiertasRows) {
  const code = str(r[0]);
  if (!code || code === 'ID Módulo') continue;
  cubInfo[code] = { aplica: str(r[2]).toUpperCase().startsWith('S'), ancho: num(r[3]) };
}

const resumenRows = rowsOf(S.resumen);
const catMap: Record<string, string> = { ALA: 'Alacena', GAB: 'Gabinete', TAR: 'Gabinete Tarja', DES: 'Despensa', PAN: 'Panel', ZOC: 'Zoclo' };
const furniture: any[] = [];
const demoItems: { code: string; qty: number }[] = [];
const costCheck: { code: string; xlsBlanco: number; calcBlanco: number; xlsMad: number; calcMadMat: number }[] = [];

for (let i = 1; i < mueblesRows.length; i++) {
  const r = mueblesRows[i];
  const code = str(r[1]);
  if (!code) continue;
  const name = str(r[2]);
  const m = name.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/);
  const width = m ? Number(m[1]) : 0;
  const height = m ? Number(m[2]) : 0;
  const depth = m ? Number(m[3]) : 0;
  const prefix = code.split('-')[0];
  const info = cubInfo[code] || { aplica: false, ancho: 0 };
  const bla = blaMod[code] || { pieces: [], hardware: new Map() };
  const mad = madMod[code] || { pieces: [], hardware: new Map() };
  // Hardware: BLA sums primary, add hardware only present in MAD
  const hwMap = new Map(bla.hardware);
  for (const [k, v] of mad.hardware) if (!hwMap.has(k)) hwMap.set(k, v);
  furniture.push({
    order: i - 1,
    code,
    name,
    category: catMap[prefix] || 'Otro',
    width,
    height,
    depth,
    appliesCountertop: info.aplica,
    countertopWidthM: info.ancho,
    imageUrl: null,
    notes: null,
    pieces: bla.pieces.map((p, pi) => ({ ...p, order: pi })),
    hardware: [...hwMap.entries()].map(([hname, qty]) => ({ name: hname, qty })),
  });
}

// Demo quotation items from Resumen (col0 qty > 0)
for (let i = 10; i < resumenRows.length; i++) {
  const r = resumenRows[i];
  const qty = num(r[0]);
  const code = str(r[1]);
  if (code && code.includes('-') && qty > 0) demoItems.push({ code, qty });
  // capture cost columns for verification (rows 10..57)
  if (code && code.includes('-')) {
    const blaCostXls = num(r[3]);
    const madCostXls = num(r[6]);
    costCheck.push({ code, xlsBlanco: blaCostXls, calcBlanco: 0, xlsMad: madCostXls, calcMadMat: 0 });
  }
}

/* ---------- 4. Verify piece parsing against sheet TOTALES rows ---------- */
const matCost: Record<string, number> = {};
const matBand: Record<string, number> = {};
for (const m of materials) {
  if (m.type === 'TABLERO') {
    matCost[m.name] = m.costPerM2;
    matBand[m.name] = m.edgeBandCostMl || 0;
  }
}
const hwCost: Record<string, number> = {};
for (const h of hardware) hwCost[h.name] = h.unitCost;

// Re-parse raw TOTALES rows from despiece sheets: {code: {m2, ml, matHw}}
function parseTotales(name: string): Record<string, { m2: number; ml: number; matHw: number }> {
  const rows = rowsOf(name);
  const out: Record<string, { m2: number; ml: number; matHw: number }> = {};
  let lastCode = '';
  for (const r of rows) {
    const code = str(r[10]);
    if (code) lastCode = code;
    const c0 = str(r[0]);
    if (c0.startsWith('TOTAL') && lastCode) {
      out[lastCode] = { m2: num(r[12]), ml: num(r[13]), matHw: num(r[15]) };
    }
  }
  return out;
}
const totBla = parseTotales(S.bla);

function calcModuleTotals(pieces: any[]) {
  let m2 = 0, ml = 0, boards = 0, cint = 0;
  for (const p of pieces) {
    m2 += p.qty * (p.length * p.width) / 1e6;
    ml += p.qty * ((p.bandLong1 ? p.length : 0) + (p.bandLong2 ? p.length : 0) + (p.bandShort1 ? p.width : 0) + (p.bandShort2 ? p.width : 0)) / 1000;
    boards += p.qty * ((p.length * p.width) / 1e6 * (matCost[p.materialName] || 0));
    cint += p.qty * (((p.bandLong1 ? p.length : 0) + (p.bandLong2 ? p.length : 0) + (p.bandShort1 ? p.width : 0) + (p.bandShort2 ? p.width : 0)) / 1000) * (matBand[p.materialName] || 0);
  }
  return { m2, ml, boards, cint };
}

let bad = 0;
const diffs: string[] = [];
for (const f of furniture) {
  const t = totBla[f.code];
  if (!t) continue;
  const c = calcModuleTotals(f.pieces);
  if (Math.abs(c.m2 - t.m2) > 0.0001) { bad++; diffs.push(`M2 ${f.code}: sheet=${t.m2.toFixed(4)} calc=${c.m2.toFixed(4)}`); }
  if (Math.abs(c.ml - t.ml) > 0.0001) { bad++; diffs.push(`ML ${f.code}: sheet=${t.ml.toFixed(3)} calc=${c.ml.toFixed(3)}`); }
  const hwBlaCost = [...(blaMod[f.code]?.hardware || [])].reduce((a, [n, q]) => a + q * (hwCost[n] || 0), 0);
  if (Math.abs(c.boards + hwBlaCost - t.matHw) > 0.02) { bad++; diffs.push(`COSTO ${f.code}: sheet=${t.matHw.toFixed(2)} calc=${(c.boards + hwBlaCost).toFixed(2)}`); }
}
console.log('=== VERIFICACIÓN PIEZAS vs TOTALES de hoja Blanco (m², ML, tableros+herrajes) ===');
console.log(diffs.join('\n') || 'OK — todos los módulos cuadran exactamente');
console.log(`Mismatch: ${bad}`);

/* ---------- 5. Settings + totals demo quote ---------- */
const settings = {
  companyName: 'Cotizador de Muebles',
  saleFactor: 6.7,
  ivaRate: 0.16,
  distributorDiscount: 0.35,
  laborPerUnit: 0,
  countertopMultipleM: 1.2,
  countertopFactor: 4,
  currency: 'MXN',
};

const data = { settings, materials, hardware, furniture, demoItems };
fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log(`\nWrote ${OUT}`);
console.log(`materials=${materials.length} hardware=${hardware.length} furniture=${furniture.length} demoItems=${demoItems.length}`);
console.log('Demo items:', JSON.stringify(demoItems));
const totalPieces = furniture.reduce((a, f) => a + f.pieces.length, 0);
console.log('Total pieces:', totalPieces);
