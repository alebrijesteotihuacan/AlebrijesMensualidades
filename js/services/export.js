// services/export.js
// Exportadores CSV y PDF (jsPDF + AutoTable vía window.jspdf).

const { jsPDF } = window.jspdf || {};

/** Escapar valor para CSV */
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Descarga un CSV a partir de un array de objetos.
 * @param {Array<object>} rows
 * @param {string} filename
 * @param {string[]} [columns] - orden de columnas. Si se omite, se usan las keys del primer row.
 */
export function toCSV(rows, filename = 'export.csv', columns) {
  if (!Array.isArray(rows) || rows.length === 0) {
    // Igual descargamos un CSV con encabezados vacíos
  }
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [cols.join(',')];
  for (const r of rows) {
    lines.push(cols.map((c) => csvCell(r[c])).join(','));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  download(blob, filename);
}

/**
 * Descarga un PDF con tabla autoformateada.
 * @param {{title:string, columns:string[], rows:Array<any[]>, filename:string, headStyles?:object}} opts
 */
export function toPDF({ title = 'Reporte', columns = [], rows = [], filename = 'export.pdf', headStyles } = {}) {
  if (!jsPDF) {
    alert('jsPDF no se cargó. Verifica tu conexión a Internet.');
    return;
  }
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // Header con título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 40, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 40, 68);
  doc.setTextColor(15);

  doc.autoTable({
    startY: 90,
    head: [columns],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: headStyles ?? { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
