/* Full dump of config + cubiertas + muebles sheets, plus distinct hardware names */
import * as XLSX from 'xlsx';

const path = '/home/z/my-project/upload/Cotizador_Muebles_Auditado.xlsx';
const wb = XLSX.readFile(path, { cellDates: false });

function dumpSheet(name: string, maxCol = 14) {
  const ws = wb.Sheets[name];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
  console.log(`\n===== ${name} (${rows.length} rows) =====`);
  rows.forEach((row, r) => {
    const cells = row.slice(0, maxCol).map((c) => (c === null ? '' : String(c).slice(0, 38)));
    console.log(`R${r}: ${cells.join(' | ')}`);
  });
}

dumpSheet('⚙️ Configuración Costos');
dumpSheet('🧱 Cubiertas');
dumpSheet('MUEBLES', 5);

// Distinct hardware names in despieces
for (const sn of ['📋 Explosión y Despiece Bla', '📋 Explosión y Despiece Mad']) {
  const ws = wb.Sheets[sn];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
  const hw = new Set<string>();
  for (const row of rows) {
    if (row[4] === 'HERRAJE') hw.add(String(row[3]));
  }
  console.log(`\nHardware names in ${sn}:`, [...hw].join(' ;; '));
}
