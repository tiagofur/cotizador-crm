/* ============================================================
 * Excel de maquila: el cliente descarga el formato, lo llena con
 * sus piezas y la tienda lo importa tal cual (o captura pieza a
 * pieza en el sistema). GET = plantilla; POST = importar archivo.
 * ============================================================ */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/auth';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import type { MaquilaPieceInput } from '@/lib/types';

const HEADERS = ['Nombre', 'Cantidad', 'Largo (mm)', 'Ancho (mm)', 'Material', 'Veta', 'Canto L1', 'Canto L2', 'Canto A1', 'Canto A2', 'Notas'] as const;

/* ---------- GET: plantilla descargable ---------- */
export async function GET(req: NextRequest) {
  const denied = await requireRole(req, 'ADMIN', 'TIENDA', 'CLIENTE');
  if (denied) return denied;

  const materials = await db.material.findMany({
    where: { type: 'TABLERO', active: true },
    orderBy: { name: 'asc' },
  });

  // exceljs (no xlsx) para poder escribir la validación de datos de la lista Material
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Maquila';

  /* Hoja 1: Piezas — el formato. La columna Material (E) trae lista desplegable
     con los materiales del sistema; también se puede copiar/pegar de «Materiales». */
  const ws = wb.addWorksheet('Piezas');
  ws.columns = HEADERS.map((h, i) => ({ header: h, width: [28, 10, 11, 11, 26, 7, 9, 9, 9, 9, 30][i] }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5D46' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFF3ECDB' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Lista desplegable desde la hoja Materiales (filas 2..500 para dejar crecer el despiece)
  const lastMatRow = Math.max(2, materials.length + 1);
  for (let r = 2; r <= 500; r++) {
    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=Materiales!$A$2:$A$${lastMatRow}`],
      showErrorMessage: true,
      errorTitle: 'Material no válido',
      error: 'Elige un material de la lista (viene de nuestro catálogo).',
    };
  }

  /* Hoja 2: instrucciones */
  const wsInstr = wb.addWorksheet('Instrucciones');
  const instr = [
    ['FORMATO DE DESPIECE PARA MAQUILA'],
    [''],
    ['1. Llena la hoja «Piezas»: una fila por pieza (usa la cantidad para repetirlas).'],
    ['2. Largo y Ancho en MILÍMETROS (mm).'],
    ['3. Material: elige de la LISTA DESPLEGABLE de la columna Material'],
    ['   (o copia y pega el nombre exacto desde la hoja «Materiales»).'],
    ['4. Veta y Cantos: escribe SI o NO.'],
    ['   · Canto L1 / L2 = bordes LARGOS de la pieza (encintado).'],
    ['   · Canto A1 / A2 = bordes ANCHOS de la pieza (encintado).'],
    ['5. No cambies los nombres de las columnas ni muevas los encabezados.'],
    ['6. Nosotros calculamos las hojas necesarias por material y optimizamos el corte.'],
  ];
  wsInstr.columns = [{ width: 95 }];
  instr.forEach((row) => wsInstr.addRow(row));
  wsInstr.getRow(1).font = { bold: true, size: 13 };

  /* Hoja 3: catálogo de materiales válidos (fuente de la lista) */
  const wsMats = wb.addWorksheet('Materiales');
  wsMats.columns = [
    { header: 'Material', width: 30 },
    { header: 'Espesor', width: 10 },
    { header: 'Hoja (mm)', width: 16 },
    { header: 'Costo tablero', width: 14 },
  ];
  wsMats.getRow(1).font = { bold: true };
  for (const m of materials) {
    wsMats.addRow([
      m.name,
      m.thickness ?? '',
      m.sheetWidth && m.sheetLength ? `${m.sheetWidth}×${m.sheetLength}` : '',
      m.sheetCost ?? '',
    ]);
  }

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Formato_Despiece_Maquila.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}

/* ---------- POST: importar el formato llenado ---------- */

/** Normaliza texto: minúsculas y sin acentos */
function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function truthy(v: unknown): boolean {
  return ['si', 'x', 'true', '1', 'y', 'yes'].includes(norm(v));
}

function num(v: unknown): number {
  const n = Number(String(v ?? '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const HEADER_MAP: Record<string, string> = {
  nombre: 'name',
  pieza: 'name',
  descripcion: 'name',
  cantidad: 'qty',
  cant: 'qty',
  qty: 'qty',
  'largo (mm)': 'length',
  largo: 'length',
  'ancho (mm)': 'width',
  ancho: 'width',
  material: 'material',
  veta: 'grain',
  'canto l1': 'bandL1',
  'canto l2': 'bandL2',
  'canto a1': 'bandA1',
  'canto a2': 'bandA2',
  notas: 'notes',
  nota: 'notes',
  observaciones: 'notes',
};

export async function POST(req: NextRequest) {
  const denied = await requireRole(req, 'ADMIN', 'TIENDA', 'CLIENTE');
  if (denied) return denied;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Adjunta el archivo de Excel llenado' }, { status: 400 });
    }

    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    // Busca la hoja de piezas: la que tenga más encabezados reconocidos
    let best: { name: string; rows: unknown[][] } | null = null;
    let bestScore = -1;
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false });
      const headerRow = rows.find((r) => r && norm(r[0]) === 'nombre') ?? rows[0];
      if (!headerRow) continue;
      const score = headerRow.filter((h) => HEADER_MAP[norm(h)]).length;
      if (score > bestScore) {
        bestScore = score;
        best = { name, rows };
      }
    }
    if (!best || bestScore < 3) {
      return NextResponse.json(
        { error: 'No encontramos la hoja de piezas. Descarga el formato y respeta sus columnas.' },
        { status: 400 }
      );
    }

    const materials = await db.material.findMany({ where: { type: 'TABLERO', active: true } });
    const matByName = new Map(materials.map((m) => [norm(m.name), m]));

    const rows = best.rows;
    const headerIdx = Math.max(0, rows.findIndex((r) => r && norm(r[0]) === 'nombre'));
    const headerRow = rows[headerIdx] ?? [];
    const cols: Record<string, number> = {};
    headerRow.forEach((h, i) => {
      const key = HEADER_MAP[norm(h)];
      if (key && cols[key] === undefined) cols[key] = i;
    });

    const pieces: MaquilaPieceInput[] = [];
    const errors: string[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => String(c ?? '').trim() === '')) continue;
      const rowNo = i + 1;
      const name = String(row[cols.name ?? 0] ?? '').trim();
      const qty = Math.round(num(row[cols.qty]));
      const length = num(row[cols.length]);
      const width = num(row[cols.width]);
      const matName = norm(row[cols.material]);
      const material = matByName.get(matName);

      if (!name) { errors.push(`Fila ${rowNo}: falta el nombre de la pieza`); continue; }
      if (qty < 1) { errors.push(`Fila ${rowNo} (${name}): la cantidad debe ser 1 o más`); continue; }
      if (length <= 0 || width <= 0) { errors.push(`Fila ${rowNo} (${name}): largo y ancho en mm deben ser mayores a 0`); continue; }
      if (!matName) { errors.push(`Fila ${rowNo} (${name}): falta el material`); continue; }
      if (!material) { errors.push(`Fila ${rowNo} (${name}): el material «${String(row[cols.material]).trim()}» no está en nuestro catálogo`); continue; }

      pieces.push({
        name,
        qty,
        length,
        width,
        materialId: material.id,
        grain: cols.grain !== undefined && truthy(row[cols.grain]),
        bandL1: cols.bandL1 !== undefined && truthy(row[cols.bandL1]),
        bandL2: cols.bandL2 !== undefined && truthy(row[cols.bandL2]),
        bandA1: cols.bandA1 !== undefined && truthy(row[cols.bandA1]),
        bandA2: cols.bandA2 !== undefined && truthy(row[cols.bandA2]),
        notes: cols.notes !== undefined ? String(row[cols.notes] ?? '').trim() || null : null,
      });
    }

    if (!pieces.length) {
      return NextResponse.json(
        { error: 'No pudimos leer ninguna pieza válida del archivo.', errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ pieces, errors, sheetName: best.name });
  } catch (e) {
    console.error('POST /api/maquila/excel error:', e);
    return NextResponse.json({ error: 'No se pudo leer el archivo. Verifica que sea .xlsx o .csv válido.' }, { status: 400 });
  }
}
