/* Verify piece parsing against TOTALES rows in the despiece sheets */
import * as XLSX from 'xlsx';

const wb = XLSX.readFile('/home/z/my-project/upload/Cotizador_Muebles_Auditado.xlsx');
const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['📋 Explosión y Despiece Bla'], { header: 1, blankrows: false, defval: null });

// Find TOTALES rows and show their columns
let shown = 0;
for (let i = 0; i < rows.length && shown < 3; i++) {
  const c0 = String(rows[i][0] ?? '');
  if (c0.startsWith('TOTAL')) {
    console.log(`R${i}:`, rows[i].slice(0, 17).map((c) => (c === null ? '' : String(c).slice(0, 14))).join(' | '));
    shown++;
  }
}
// Show header rows around a TOTALES to see next module title
for (let i = 0; i < rows.length; i++) {
  const c0 = String(rows[i][0] ?? '');
  if (c0.startsWith('TOTAL')) {
    console.log('context after:', rows.slice(i, i + 3).map((r) => String(r[0] ?? '').slice(0, 40)));
    break;
  }
}
