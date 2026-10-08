/* Genera la cotización en PDF (con o sin precios) */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/auth';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { getSettings, getFinishProfile } from '@/lib/server/queries';

type Params = { params: Promise<{ id: string }> };

const quotationInclude = { items: { orderBy: { id: 'asc' as const } }, countertopMaterial: true };
const maquilaInclude = {
  maquilaLines: { orderBy: [{ order: 'asc' as const }, { id: 'asc' as const }], include: { material: true } },
  maquilaPieces: { orderBy: [{ order: 'asc' as const }, { id: 'asc' as const }], include: { material: true } },
};

function money(n: number): string {
  return '$' + (n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* Paleta de marca Nahú Cocinas (folleto maquila 2026) */
const BRAND = {
  green: '#2f5d46', // banda del encabezado
  greenDark: '#274c3a',
  gold: '#b89858', // acentos (línea, totales)
  goldDark: '#8a6a33',
  cream: '#f3ecdb',
  bark: '#4a3b31', // pie
  barkDark: '#3a2e26',
  ink: '#26241f',
  gray: '#5d5748',
} as const;

function buildPdf(doc: PDFKit.PDFDocument, data: {
  company: { companyName: string; companyPhone: string | null; companyEmail: string | null; companyAddress: string | null };
  folio: string; date: Date; clientName: string; clientPhone: string | null; clientEmail: string | null;
  title: string | null; orderCode: string | null;
  finish: string; finishLabel: string; notes: string | null; showPrices: boolean;
  items: { qty: number; code: string; name: string; width: number; height: number; depth: number; unitPrice: number }[];
  factor: number; ivaRate: number; discount: number;
  furnitureSale: number; countertopName: string | null; countertopMl: number; countertopCost: number; countertopSale: number;
  subtotal: number; ivaAmount: number; total: number;
  applyDistributor: boolean; distributorFurniture: number; distributorCountertop: number; distributorIva: number; distributorTotal: number;
}, imagesDir: string) {
  const left = 40;
  const right = 555.28;
  const pageWidth = right - left;

  /* ---------- Banda del encabezado (verde del folleto) ---------- */
  const bandH = 86;
  doc.rect(0, 0, 612, bandH).fill(BRAND.green);
  doc.rect(0, bandH, 612, 2.5).fill(BRAND.gold);

  // Logo a la izquierda, dentro de la banda
  let textX = left;
  const logoPath = path.join(imagesDir, 'logo-nahu.png');
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, left, 14, { height: 56 });
      textX = left + 70;
    } catch {
      /* si falla la imagen, el texto ocupa su lugar */
    }
  }

  doc.font('Helvetica-Bold').fontSize(19).fillColor('#faf7ef')
    .text(data.company.companyName || 'Nahú Cocinas', textX, 20, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND.gold)
    .text('COTIZACIÓN DE MUEBLES A MEDIDA', textX, 44, { lineBreak: false });
  const contact = [
    data.company.companyPhone,
    data.company.companyEmail,
    data.company.companyAddress,
  ].filter(Boolean).join('  ·  ');
  doc.font('Helvetica').fontSize(7.2).fillColor('#dce8de')
    .text(contact, textX, 58, { width: right - 170 - textX, height: 22, ellipsis: true, lineBreak: false });

  // Folio y fecha a la derecha
  doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND.gold)
    .text('COTIZACIÓN', right - 160, 18, { width: 160, align: 'right', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#faf7ef')
    .text(data.folio, right - 160, 36, { width: 160, align: 'right', lineBreak: false });
  if (data.orderCode) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.gold)
      .text(`PEDIDO ${data.orderCode}`, right - 160, 50, { width: 160, align: 'right', lineBreak: false });
  }
  doc.font('Helvetica').fontSize(8.5).fillColor('#dce8de')
    .text(fmtDate(data.date), right - 160, 52, { width: 160, align: 'right', lineBreak: false });

  let y = bandH + 18;

  /* ---------- Cliente y metadatos ---------- */
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#78716c').text('CLIENTE', left, y);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#1c1917').text(data.clientName || 'Público General', left, y + 13);
  let titleOffset = 0;
  if (data.title) {
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#78716c')
      .text(data.title, left, y + 27, { lineBreak: false });
    titleOffset = 11;
  }
  const clientInfo: string[] = [];
  if (data.clientPhone) clientInfo.push(`Tel: ${data.clientPhone}`);
  if (data.clientEmail) clientInfo.push(data.clientEmail);
  if (clientInfo.length) doc.font('Helvetica').fontSize(8.5).fillColor('#78716c').text(clientInfo.join('  ·  '), left, y + 28 + titleOffset);

  const metaX = right - 220;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#78716c').text('ACABADO', metaX, y);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(data.finish === 'BLANCO' ? '#44403c' : '#4d7c0f')
    .text(data.finishLabel, metaX, y + 13);
  doc.font('Helvetica').fontSize(8.5).fillColor('#78716c').text('Moneda: MXN', metaX, y + 28);
  y += 48;    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.75).strokeColor('#e6d8b8').stroke();
  y += 12;

  /* ---------- Tabla de items ---------- */
  const showPrices = data.showPrices;
  const colQty = 38;
  const colCode = 78;
  const colDims = 92;
  const colUnit = showPrices ? 66 : 0;
  const colTotal = showPrices ? 76 : 0;
  const colDesc = pageWidth - colQty - colCode - colDims - colUnit - colTotal;
  const rowH = 26;
  const headerH = 20;

  const drawHeader = () => {
    doc.rect(left, y, pageWidth, headerH).fill(BRAND.green);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#f3ecdb');
    let x = left + 6;
    doc.text('CANT.', x, y + 6, { width: colQty - 8, align: 'center' });
    x += colQty;
    doc.text('CÓDIGO', x, y + 6, { width: colCode - 8 });
    x += colCode;
    doc.text('MUEBLE', x, y + 6, { width: colDesc - 8 });
    x += colDesc;
    doc.text('DIMENSIONES (mm)', x, y + 6, { width: colDims - 4 });
    if (showPrices) {
      x += colDims;
      doc.text('P. UNIT.', x, y + 6, { width: colUnit - 4, align: 'right' });
      x += colUnit;
      doc.text('TOTAL', x, y + 6, { width: colTotal - 4, align: 'right' });
    }
    y += headerH;
  };

  drawHeader();
  let zebra = false;

  for (const it of data.items) {
    if (it.qty <= 0) continue;
    if (y + rowH > 720) {
      doc.addPage();
      y = 50;
      drawHeader();
    }
    const bg = zebra ? '#faf7ef' : '#ffffff';
    doc.rect(left, y, pageWidth, rowH).fill(bg);
    doc.rect(left, y, pageWidth, 0.5).fill('#e6d8b8');
    zebra = !zebra;

    const name = it.name;
    doc.font('Helvetica').fontSize(8.5).fillColor('#1c1917');
    let x = left + 6;
    doc.text(String(it.qty), x, y + 9, { width: colQty - 8, align: 'center' });
    x += colQty;
    doc.font('Helvetica').fontSize(7.5).fillColor('#57534e').text(it.code, x, y + 9, { width: colCode - 8, lineBreak: false });
    x += colCode;
    doc.font('Helvetica').fontSize(8.5).fillColor('#1c1917').text(name, x, y + 9, { width: colDesc - 10, height: rowH - 4, ellipsis: true, lineBreak: false });
    x += colDesc;
    doc.font('Helvetica').fontSize(7.5).fillColor('#57534e').text(`${it.width} × ${it.height} × ${it.depth}`, x, y + 9, { width: colDims - 4, lineBreak: false });
    if (showPrices) {
      x += colDims;
      doc.font('Helvetica').fontSize(8.5).fillColor('#1c1917').text(money(it.unitPrice), x, y + 9, { width: colUnit - 4, align: 'right', lineBreak: false });
      x += colUnit;
      doc.font('Helvetica-Bold').fontSize(8.5).text(money(it.unitPrice * it.qty), x, y + 9, { width: colTotal - 4, align: 'right', lineBreak: false });
    }
    y += rowH;
  }

  /* ---------- Cubierta ---------- */
  if (data.countertopName && data.countertopMl > 0) {
    if (y + 22 > 720) { doc.addPage(); y = 50; }
    y += 6;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.goldDark);
    if (showPrices) {
      doc.text(
        `Cubierta ${data.countertopName}: ${data.countertopMl.toFixed(2)} m × ${money(data.countertopCost / Math.max(data.countertopMl, 0.01))}/ML  ·  Venta: ${money(data.countertopSale)}`,
        left, y, { width: pageWidth }
      );
    } else {
      doc.text(`Cubierta ${data.countertopName}: ${data.countertopMl.toFixed(2)} m (cobrables, múltiplos de 1.20 m)`, left, y, { width: pageWidth });
    }
    y += 14;
  }

  /* ---------- Totales ---------- */
  if (showPrices) {
    if (y + 130 > 720) { doc.addPage(); y = 50; }
    y += 10;
    const blockW = 230;
    const bx = right - blockW;
    const row = (label: string, value: string, opts?: { bold?: boolean; color?: string; size?: number }) => {
      doc.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts?.size || 9)
        .fillColor(opts?.color || '#44403c').text(label, bx, y, { width: blockW - 80, align: 'left' });
      doc.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts?.size || 9)
        .fillColor(opts?.color || '#1c1917').text(value, bx, y, { width: blockW, align: 'right' });
      y += opts?.size === 13 ? 22 : 15;
    };
    row('Venta de muebles', money(data.furnitureSale));
    if (data.countertopSale > 0) row('Venta de cubierta', money(data.countertopSale));
    row('Subtotal', money(data.subtotal));
    row(`IVA (${(data.ivaRate * 100).toFixed(0)}%)`, money(data.ivaAmount));
    doc.rect(bx - 8, y - 2, blockW + 8, 22).fill(BRAND.gold);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('TOTAL', bx, y + 4, { width: blockW - 90 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text(money(data.total), bx, y + 4, { width: blockW, align: 'right' });
    y += 30;

    if (data.applyDistributor) {
      y += 6;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.green)
        .text(`PRECIO DISTRIBUIDOR (−${(data.discount * 100).toFixed(0)}%)`, bx, y, { width: blockW, align: 'left' });
      y += 14;
      row('Muebles', money(data.distributorFurniture));
      if (data.distributorCountertop > 0) row('Cubierta', money(data.distributorCountertop));
      row(`IVA (${(data.ivaRate * 100).toFixed(0)}%)`, money(data.distributorIva));
      doc.rect(bx - 8, y - 2, blockW + 8, 20).fill(BRAND.green);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#ffffff').text('TOTAL DISTRIBUIDOR', bx, y + 3, { width: blockW - 100 });
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#ffffff').text(money(data.distributorTotal), bx, y + 3, { width: blockW, align: 'right' });
      y += 26;
    }
  } else {
    y += 10;
    doc.font('Helvetica').fontSize(8.5).fillColor('#78716c')
      .text('* Presentación de muebles sin precios. Solicita tu cotización con precios y disponibilidad.', left, y, { width: pageWidth });
    y += 14;
  }

  /* ---------- Notas (encima de la banda café) ---------- */
  doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.gray);
  const notes = [
    data.notes || null,
    showPrices ? `Precios calculados con factor ${data.factor.toFixed(2)} sobre costos de materiales y herrajes. Precios en pesos mexicanos (MXN).` : 'Presentación de muebles sin precios. Precios en pesos mexicanos (MXN).',
  ].filter(Boolean) as string[];
  notes.slice(0, 2).forEach((n, i) => {
    doc.text(n, left, 736 + i * 11, { width: pageWidth, lineBreak: false, height: 10, ellipsis: true });
  });

  /* ---------- Banda del pie (café del folleto) ---------- */
  const footY = 770;
  doc.rect(0, footY, 612, 842 - footY).fill(BRAND.bark);
  doc.rect(0, footY, 612, 1.5).fill(BRAND.gold);
  const footContact = [
    data.company.companyPhone,
    data.company.companyEmail,
  ].filter(Boolean).join('  ·  ');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#f3ecdb')
    .text(data.company.companyName || 'Nahú Cocinas', left, footY + 8, { width: 200, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor('#e6d8b8')
    .text(footContact || '¡Con gusto te atendemos!', left, footY + 22, { width: 380, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor('#e6d8b8')
    .text('Página 1', right, footY + 22, { width: 0, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(6.5).fillColor('#c9ab6f')
    .text(data.company.companyAddress || '', left, footY + 34, { width: pageWidth, lineBreak: false });
}

/* ---------- PDF de maquila (cotización con precios u hoja de corte sin precios) ---------- */
function buildMaquilaPdf(doc: PDFKit.PDFDocument, data: {
  company: { companyName: string; companyPhone: string | null; companyEmail: string | null; companyAddress: string | null };
  folio: string; date: Date; clientName: string; clientPhone: string | null; clientEmail: string | null;
  title: string | null; orderCode: string | null; notes: string | null; showPrices: boolean;
  lines: { material: string; sheetsQty: number; unitSheetCost: number; edgeBandMl: number; unitBandCostMl: number; notes: string | null }[];
  pieces: { name: string; qty: number; length: number; width: number; material: string; grain: boolean; cantos: string }[];
  cutQty: number; cutUnitCost: number; edgeBandMlTotal: number; edgeBandUnitCost: number;
  sheetsTotal: number; bandMaterialTotal: number; cutTotal: number; edgeBandTotal: number;
  materialsTotal: number; servicesTotal: number; subtotal: number; ivaRate: number; ivaAmount: number; total: number;
}, imagesDir: string) {
  const left = 40;
  const right = 555.28;
  const pageWidth = right - left;
  const showPrices = data.showPrices;

  /* ---------- Banda del encabezado ---------- */
  const bandH = 86;
  doc.rect(0, 0, 612, bandH).fill(BRAND.green);
  doc.rect(0, bandH, 612, 2.5).fill(BRAND.gold);

  let textX = left;
  const logoPath = path.join(imagesDir, 'logo-nahu.png');
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, left, 14, { height: 56 });
      textX = left + 70;
    } catch {
      /* si falla la imagen, el texto ocupa su lugar */
    }
  }

  doc.font('Helvetica-Bold').fontSize(19).fillColor('#faf7ef')
    .text(data.company.companyName || 'Nahú Cocinas', textX, 20, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND.gold)
    .text('MAQUILA · TABLEROS, CORTE Y CANTEADO', textX, 44, { lineBreak: false });
  const contact = [
    data.company.companyPhone,
    data.company.companyEmail,
    data.company.companyAddress,
  ].filter(Boolean).join('  ·  ');
  doc.font('Helvetica').fontSize(7.2).fillColor('#dce8de')
    .text(contact, textX, 58, { width: right - 170 - textX, height: 22, ellipsis: true, lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND.gold)
    .text('MAQUILA', right - 160, 18, { width: 160, align: 'right', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#faf7ef')
    .text(data.folio, right - 160, 36, { width: 160, align: 'right', lineBreak: false });
  if (data.orderCode) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.gold)
      .text(`PEDIDO ${data.orderCode}`, right - 160, 50, { width: 160, align: 'right', lineBreak: false });
  }
  doc.font('Helvetica').fontSize(8.5).fillColor('#dce8de')
    .text(fmtDate(data.date), right - 160, data.orderCode ? 62 : 52, { width: 160, align: 'right', lineBreak: false });

  let y = bandH + 18;

  /* ---------- Cliente ---------- */
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#78716c').text('CLIENTE', left, y);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#1c1917').text(data.clientName || 'Público General', left, y + 13);
  let titleOffset = 0;
  if (data.title) {
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#78716c')
      .text(data.title, left, y + 27, { lineBreak: false });
    titleOffset = 11;
  }
  const clientInfo: string[] = [];
  if (data.clientPhone) clientInfo.push(`Tel: ${data.clientPhone}`);
  if (data.clientEmail) clientInfo.push(data.clientEmail);
  if (clientInfo.length) doc.font('Helvetica').fontSize(8.5).fillColor('#78716c').text(clientInfo.join('  ·  '), left, y + 28 + titleOffset);

  const metaX = right - 220;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#78716c').text('SERVICIO', metaX, y);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#2f5d46')
    .text('Tableros · Corte · Encintado', metaX, y + 13);
  doc.font('Helvetica').fontSize(8.5).fillColor('#78716c').text('Moneda: MXN', metaX, y + 28);
  y += 48;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.75).strokeColor('#e6d8b8').stroke();
  y += 12;

  /* ---------- Despiece del cliente (lista para escuadradora) ---------- */
  if (data.pieces.length) {
    const pRowH = 18;
    const pHeaderH = 18;
    const pColQty = 34;
    const pColCantos = 92;
    const pColDims = 96;
    const pColMat = 150;
    const pColName = pageWidth - pColQty - pColCantos - pColDims - pColMat;

    const drawPiecesHeader = () => {
      doc.rect(left, y, pageWidth, pHeaderH).fill(BRAND.green);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#f3ecdb');
      let x = left + 6;
      doc.text('CANT.', x, y + 5, { width: pColQty - 4, align: 'center' });
      x += pColQty;
      doc.text('PIEZA', x, y + 5, { width: pColName - 8 });
      x += pColName;
      doc.text('MEDIDAS (MM)', x, y + 5, { width: pColDims - 4, align: 'right' });
      x += pColDims;
      doc.text('MATERIAL', x, y + 5, { width: pColMat - 8 });
      x += pColMat;
      doc.text('CANTOS', x, y + 5, { width: pColCantos - 4 });
      y += pHeaderH;
    };

    doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.goldDark).text('DESPIECE DEL CLIENTE', left, y);
    y += 14;
    drawPiecesHeader();
    let zebraP = false;
    for (const p of data.pieces) {
      if (y + pRowH > 720) {
        doc.addPage();
        y = 50;
        drawPiecesHeader();
      }
      doc.rect(left, y, pageWidth, pRowH).fill(zebraP ? '#faf7ef' : '#ffffff');
      doc.rect(left, y, pageWidth, 0.5).fill('#e6d8b8');
      zebraP = !zebraP;
      let x = left + 6;
      doc.font('Helvetica').fontSize(8).fillColor('#1c1917');
      doc.text(String(p.qty), x, y + 5, { width: pColQty - 4, align: 'center' });
      x += pColQty;
      doc.text(p.name, x, y + 5, { width: pColName - 10, height: pRowH - 3, ellipsis: true, lineBreak: false });
      x += pColName;
      doc.text(`${p.length} × ${p.width}${p.grain ? ' ≡' : ''}`, x, y + 5, { width: pColDims - 4, align: 'right', lineBreak: false });
      x += pColDims;
      doc.font('Helvetica').fontSize(7.5).fillColor('#57534e')
        .text(p.material, x, y + 5, { width: pColMat - 8, height: pRowH - 3, ellipsis: true, lineBreak: false });
      x += pColMat;
      doc.font('Helvetica').fontSize(7.5).fillColor(p.cantos ? '#1c1917' : '#a8a29e')
        .text(p.cantos || '—', x, y + 5, { width: pColCantos - 4, lineBreak: false });
      y += pRowH;
    }
    y += 14;
    if (y + 120 > 720) { doc.addPage(); y = 50; }
  }

  /* ---------- Tabla de materiales ---------- */
  const colSheets = 56;
  const colSheetCost = showPrices ? 74 : 0;
  const colBandMl = 70;
  const colBandCost = showPrices ? 74 : 0;
  const colTotal = showPrices ? 80 : 0;
  const colMaterial = pageWidth - colSheets - colSheetCost - colBandMl - colBandCost - colTotal;
  const rowH = 26;
  const headerH = 20;

  const drawHeader = () => {
    doc.rect(left, y, pageWidth, headerH).fill(BRAND.green);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#f3ecdb');
    let x = left + 6;
    doc.text('MATERIAL', x, y + 6, { width: colMaterial - 8 });
    x += colMaterial;
    doc.text('TABLEROS', x, y + 6, { width: colSheets - 4, align: 'center' });
    if (showPrices) {
      x += colSheets;
      doc.text('COSTO HOJA', x, y + 6, { width: colSheetCost - 4, align: 'right' });
      x += colSheetCost;
    }
    doc.text('CINTILLA (M)', x, y + 6, { width: colBandMl - 4, align: 'right' });
    if (showPrices) {
      x += colBandMl;
      doc.text('CINTILLA/M', x, y + 6, { width: colBandCost - 4, align: 'right' });
      x += colBandCost;
      doc.text('TOTAL', x, y + 6, { width: colTotal - 4, align: 'right' });
    }
    y += headerH;
  };

  drawHeader();
  let zebra = false;

  for (const ln of data.lines) {
    if (ln.sheetsQty <= 0 && ln.edgeBandMl <= 0) continue;
    if (y + rowH > 720) {
      doc.addPage();
      y = 50;
      drawHeader();
    }
    const bg = zebra ? '#faf7ef' : '#ffffff';
    doc.rect(left, y, pageWidth, rowH).fill(bg);
    doc.rect(left, y, pageWidth, 0.5).fill('#e6d8b8');
    zebra = !zebra;

    let x = left + 6;
    doc.font('Helvetica').fontSize(8.5).fillColor('#1c1917')
      .text(ln.material, x, y + 9, { width: colMaterial - 10, height: rowH - 4, ellipsis: true, lineBreak: false });
    x += colMaterial;
    doc.font('Helvetica').fontSize(8.5).text(String(ln.sheetsQty), x, y + 9, { width: colSheets - 4, align: 'center' });
    if (showPrices) {
      x += colSheets;
      doc.font('Helvetica').fontSize(8.5).text(money(ln.unitSheetCost), x, y + 9, { width: colSheetCost - 4, align: 'right' });
      x += colSheetCost;
    }
    doc.font('Helvetica').fontSize(8.5).text(ln.edgeBandMl.toFixed(2), x, y + 9, { width: colBandMl - 4, align: 'right' });
    if (showPrices) {
      x += colBandMl;
      doc.font('Helvetica').fontSize(8.5).text(money(ln.unitBandCostMl), x, y + 9, { width: colBandCost - 4, align: 'right' });
      x += colBandCost;
      doc.font('Helvetica-Bold').fontSize(8.5)
        .text(money(ln.sheetsQty * ln.unitSheetCost + ln.edgeBandMl * ln.unitBandCostMl), x, y + 9, { width: colTotal - 4, align: 'right' });
    }
    y += rowH;
  }

  /* ---------- Servicios ---------- */
  if (y + 60 > 720) { doc.addPage(); y = 50; }
  y += 8;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.goldDark).text('SERVICIOS', left, y);
  y += 14;
  const svcRow = (label: string, detail: string, amount: number) => {
    doc.font('Helvetica').fontSize(8.5).fillColor('#1c1917').text(label, left, y, { width: 160, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor('#78716c').text(detail, left + 165, y, { width: 220, lineBreak: false });
    if (showPrices) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1c1917').text(money(amount), right, y, { width: 0, align: 'right', lineBreak: false });
    }
    y += 14;
  };
  svcRow('Corte', `${data.cutQty} pasadas de sierra`, data.cutTotal);
  svcRow('Encintado', `${data.edgeBandMlTotal.toFixed(2)} m de cintilla × ${money(data.edgeBandUnitCost)}/m`, data.edgeBandTotal);

  /* ---------- Totales ---------- */
  if (showPrices) {
    if (y + 120 > 720) { doc.addPage(); y = 50; }
    y += 10;
    const blockW = 230;
    const bx = right - blockW;
    const row = (label: string, value: string, opts?: { bold?: boolean; color?: string; size?: number }) => {
      doc.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts?.size || 9)
        .fillColor(opts?.color || '#44403c').text(label, bx, y, { width: blockW - 80, align: 'left' });
      doc.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts?.size || 9)
        .fillColor(opts?.color || '#1c1917').text(value, bx, y, { width: blockW, align: 'right' });
      y += opts?.size === 13 ? 22 : 15;
    };
    row('Tableros (al costo)', money(data.sheetsTotal));
    row('Cintilla (material)', money(data.bandMaterialTotal));
    row('Corte (servicio)', money(data.cutTotal));
    row('Encintado (servicio)', money(data.edgeBandTotal));
    row('Subtotal', money(data.subtotal));
    row(`IVA (${(data.ivaRate * 100).toFixed(0)}%)`, money(data.ivaAmount));
    doc.rect(bx - 8, y - 2, blockW + 8, 22).fill(BRAND.gold);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('TOTAL', bx, y + 4, { width: blockW - 90 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text(money(data.total), bx, y + 4, { width: blockW, align: 'right' });
    y += 30;
  } else {
    y += 10;
    doc.font('Helvetica').fontSize(8.5).fillColor('#78716c')
      .text('* Hoja de corte para taller, sin precios. Dimensiones de tableros y metros de cintilla para escuadradora y canteadora.', left, y, { width: pageWidth });
    y += 14;
  }

  /* ---------- Notas ---------- */
  doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.gray);
  const notes = [
    data.notes || null,
    showPrices
      ? 'Tableros y cintilla se venden al costo; los servicios de corte y encintado se cobran aparte. Precios en pesos mexicanos (MXN).'
      : 'Hoja de trabajo sin precios. Precios en pesos mexicanos (MXN).',
  ].filter(Boolean) as string[];
  notes.slice(0, 2).forEach((n, i) => {
    doc.text(n, left, 736 + i * 11, { width: pageWidth, lineBreak: false, height: 10, ellipsis: true });
  });

  /* ---------- Banda del pie ---------- */
  const footY = 770;
  doc.rect(0, footY, 612, 842 - footY).fill(BRAND.bark);
  doc.rect(0, footY, 612, 1.5).fill(BRAND.gold);
  const footContact = [
    data.company.companyPhone,
    data.company.companyEmail,
  ].filter(Boolean).join('  ·  ');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#f3ecdb')
    .text(data.company.companyName || 'Nahú Cocinas', left, footY + 8, { width: 200, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor('#e6d8b8')
    .text(footContact || '¡Con gusto te atendemos!', left, footY + 22, { width: 380, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor('#e6d8b8')
    .text('Página 1', right, footY + 22, { width: 0, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(6.5).fillColor('#c9ab6f')
    .text(data.company.companyAddress || '', left, footY + 34, { width: pageWidth, lineBreak: false });
}

export async function GET(req: NextRequest, { params }: Params) {
  const denied = await requireRole(req, 'ADMIN', 'TIENDA');
  if (denied) return denied;
  const { id } = await params;
  const showPrices = new URL(req.url).searchParams.get('prices') !== '0';
  const settings = await getSettings();

  /* ----- Maquila: layout propio (cotización u hoja de corte) ----- */
  const qMaquila = await db.quotation.findUnique({ where: { id }, include: maquilaInclude });
  if (qMaquila && (qMaquila.kind as string) === 'MAQUILA') {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Maquila ${qMaquila.folio}`, Author: settings.companyName } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const sheetsTotal = qMaquila.maquilaLines.reduce((a, l) => a + l.sheetsQty * l.unitSheetCost, 0);
    const cutTotal = qMaquila.cutQty * qMaquila.cutUnitCost;

    buildMaquilaPdf(doc, {
      company: settings,
      folio: qMaquila.folio,
      date: qMaquila.createdAt,
      clientName: qMaquila.clientName,
      clientPhone: qMaquila.clientPhone,
      clientEmail: qMaquila.clientEmail,
      title: qMaquila.title,
      orderCode: qMaquila.orderCode,
      notes: qMaquila.notes,
      showPrices,
      lines: qMaquila.maquilaLines.map((l) => ({
        material: l.material?.name ?? 'Material',
        sheetsQty: l.sheetsQty,
        unitSheetCost: l.unitSheetCost,
        edgeBandMl: l.edgeBandMl,
        unitBandCostMl: l.unitBandCostMl,
        notes: l.notes,
      })),
      pieces: qMaquila.maquilaPieces.map((p) => ({
        name: p.name,
        qty: p.qty,
        length: p.length,
        width: p.width,
        material: p.material?.name ?? '—',
        grain: p.grain,
        cantos: [
          p.bandL1 && 'L1',
          p.bandL2 && 'L2',
          p.bandA1 && 'A1',
          p.bandA2 && 'A2',
        ].filter((x): x is string => !!x).join('·'),
      })),
      cutQty: qMaquila.cutQty,
      cutUnitCost: qMaquila.cutUnitCost,
      edgeBandMlTotal: qMaquila.edgeBandMl,
      edgeBandUnitCost: qMaquila.edgeBandUnitCost,
      sheetsTotal,
      bandMaterialTotal: qMaquila.materialsTotal - sheetsTotal,
      cutTotal,
      edgeBandTotal: qMaquila.servicesTotal - cutTotal,
      materialsTotal: qMaquila.materialsTotal,
      servicesTotal: qMaquila.servicesTotal,
      subtotal: qMaquila.materialsTotal + qMaquila.servicesTotal,
      ivaRate: qMaquila.materialsTotal + qMaquila.servicesTotal > 0
        ? qMaquila.ivaAmount / (qMaquila.materialsTotal + qMaquila.servicesTotal)
        : 0.16,
      ivaAmount: qMaquila.ivaAmount,
      total: qMaquila.totalWithIva,
    }, path.join(process.cwd(), 'public'));

    doc.end();
    const buffer = await done;
    const suffixMaquila = showPrices ? 'maquila' : 'hoja-corte';
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${qMaquila.folio}-${suffixMaquila}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const q = await db.quotation.findUnique({ where: { id }, include: quotationInclude });
  if (!q) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  const finishProfile = await getFinishProfile(q.finish);

  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Cotización ${q.folio}`, Author: settings.companyName } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const subtotal = q.furnitureSale + q.countertopSale;

  buildPdf(doc, {
    company: settings,
    folio: q.folio,
    date: q.createdAt,
    clientName: q.clientName,
    clientPhone: q.clientPhone,
    clientEmail: q.clientEmail,
    finish: q.finish,
    finishLabel: finishProfile?.name ?? q.finish,
    title: q.title,
    orderCode: q.orderCode,
    notes: q.notes,
    showPrices,
    items: q.items.map((i) => ({
      qty: i.qty, code: i.code, name: i.name,
      width: i.width, height: i.height, depth: i.depth, unitPrice: i.unitPrice,
    })),
    factor: q.factorSnapshot,
    ivaRate: q.furnitureSale + q.countertopSale > 0 ? q.ivaAmount / subtotal : 0.16,
    discount: settings.distributorDiscount,
    furnitureSale: q.furnitureSale,
    countertopName: q.countertopMaterial?.name ?? null,
    countertopMl: q.countertopMl,
    countertopCost: q.countertopCost,
    countertopSale: q.countertopSale,
    subtotal,
    ivaAmount: q.ivaAmount,
    total: q.totalWithIva,
    applyDistributor: q.applyDistributor,
    distributorFurniture: q.distributorFurniture,
    distributorCountertop: q.distributorCountertop,
    distributorIva: q.distributorIva,
    distributorTotal: q.distributorTotal,
  }, path.join(process.cwd(), 'public'));

  doc.end();
  const buffer = await done;
  const suffix = showPrices ? 'cotizacion' : 'lista-muebles';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${q.folio}-${suffix}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
