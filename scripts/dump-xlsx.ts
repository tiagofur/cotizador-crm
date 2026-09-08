/* Dump Excel structure: sheet names, dimensions, and first rows of each sheet */
import * as XLSX from 'xlsx';

const path = '/home/z/my-project/upload/Cotizador_Muebles_Auditado.xlsx';
const wb = XLSX.readFile(path, { cellDates: false });

console.log('=== SHEETS ===');
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const ref = ws['!ref'] || 'EMPTY';
  console.log(`- "${name}" range=${ref}`);
}

// Dump a compact preview of each sheet (first 12 rows, all cols)
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  console.log(`\n===== SHEET: ${name} =====`);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
  const maxRows = Math.min(rows.length, 14);
  for (let r = 0; r < maxRows; r++) {
    const row = rows[r];
    if (!row) continue;
    const cells = row.slice(0, 16).map((c) => (c === null ? '' : String(c).slice(0, 24)));
    console.log(`R${r}: ${cells.join(' | ')}`);
  }
  console.log(`... total rows (non-blank): ${rows.length}`);
}
