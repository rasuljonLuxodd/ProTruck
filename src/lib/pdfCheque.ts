import jsPDF from 'jspdf';
import { formatUZS, formatDate } from '@/lib/format';
import type { Sale, Expense } from '@/types';

/**
 * Generates A5-style PDF cheques for sales and expenses.
 *
 * Why A5 and not 80mm thermal: A5 (148×210mm) is half a standard A4 sheet,
 * which prints cleanly on every office printer the user is likely to have,
 * and on mobile it displays as a readable single-page document. A thermal
 * 80mm format would be nicer for actual receipt printers, but it's a niche
 * we can add later.
 *
 * Labels stay in Uzbek Latin regardless of the UI language so the PDF
 * doubles as a permanent record — independent of whichever language the
 * cashier happened to be using when they clicked "Download". (Embedding
 * a Cyrillic-capable font would inflate the bundle by ~300 KB for a
 * minor gain.)
 */

const PAGE = { width: 148, height: 210 } as const; // mm — A5 portrait
const MARGIN_X = 10;

function newDoc(): jsPDF {
  return new jsPDF({
    unit: 'mm',
    format: [PAGE.width, PAGE.height],
    orientation: 'portrait',
  });
}

/** Draws the ProTrack header band centered at the top. */
function drawHeader(doc: jsPDF, subtitle: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('ProTrack', PAGE.width / 2, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(subtitle, PAGE.width / 2, 22, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, 26, PAGE.width - MARGIN_X, 26);
}

/** Two-column meta row (label left, value right) at the given y. Returns next y. */
function metaRow(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(label, MARGIN_X, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(value, PAGE.width - MARGIN_X, y, { align: 'right' });
  return y + 5;
}

function dashLine(doc: jsPDF, y: number) {
  doc.setDrawColor(200, 200, 200);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(MARGIN_X, y, PAGE.width - MARGIN_X, y);
  doc.setLineDashPattern([], 0);
}

function drawFooter(doc: jsPDF, y: number, signLabels: [string, string]) {
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.2);
  const sigY = y + 18;
  // two signature lines
  const halfW = (PAGE.width - MARGIN_X * 2 - 8) / 2;
  doc.line(MARGIN_X, sigY, MARGIN_X + halfW, sigY);
  doc.line(MARGIN_X + halfW + 8, sigY, PAGE.width - MARGIN_X, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(signLabels[0], MARGIN_X + halfW / 2, sigY + 4, { align: 'center' });
  doc.text(signLabels[1], MARGIN_X + halfW + 8 + halfW / 2, sigY + 4, { align: 'center' });

  // bottom timestamp
  doc.setFontSize(7);
  doc.text(
    `Yaratildi: ${new Date().toLocaleString('en-GB')}`,
    PAGE.width / 2,
    PAGE.height - 8,
    { align: 'center' },
  );
  doc.setTextColor(0, 0, 0);
}

/** Strip narrow-no-break/non-breaking spaces so PDF text rendering stays clean. */
function ascii(s: string): string {
  return s.replace(/ /g, ' ').replace(/ /g, ' ');
}
function uzs(n: number): string {
  return ascii(formatUZS(n));
}

// ---------------------------------------------------------------------------
// Sales cheque
// ---------------------------------------------------------------------------

export function salePdf(s: Sale): void {
  const doc = newDoc();
  drawHeader(doc, `Sotuv cheki  ·  #${s.id.slice(0, 8).toUpperCase()}`);

  let y = 34;
  y = metaRow(doc, 'Sana', formatDate(s.date), y);
  y = metaRow(doc, 'Mijoz', s.customerName || '—', y);
  if (s.customerPhone) y = metaRow(doc, 'Telefon', s.customerPhone, y);
  y = metaRow(doc, "To'lov turi", paymentLabel(s.paymentType), y);
  y += 2;
  dashLine(doc, y);
  y += 6;

  // line items table — three columns
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Mahsulot', MARGIN_X, y);
  doc.text('Soni × Narx', PAGE.width / 2, y, { align: 'center' });
  doc.text('Jami', PAGE.width - MARGIN_X, y, { align: 'right' });
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN_X, y, PAGE.width - MARGIN_X, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  for (const item of s.items) {
    const itemTotal = item.quantity * item.price;
    // wrap product name if it's wide
    const nameLines = doc.splitTextToSize(item.productName, PAGE.width / 2 - MARGIN_X - 4);
    doc.text(nameLines, MARGIN_X, y);
    doc.text(
      `${item.quantity} × ${uzs(item.price)}`,
      PAGE.width / 2,
      y,
      { align: 'center' },
    );
    doc.text(uzs(itemTotal), PAGE.width - MARGIN_X, y, { align: 'right' });
    y += Math.max(5, nameLines.length * 4);
  }
  y += 2;
  dashLine(doc, y);
  y += 6;

  // totals block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Jami:', MARGIN_X, y);
  doc.text(uzs(s.total), PAGE.width - MARGIN_X, y, { align: 'right' });
  y += 6;

  if (s.paymentType === 'aralash') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text("Naqd qism:", MARGIN_X, y);
    doc.text(uzs(s.cashPart ?? 0), PAGE.width - MARGIN_X, y, { align: 'right' });
    y += 5;
    doc.text("Qarz qism:", MARGIN_X, y);
    doc.text(uzs(s.debtPart ?? 0), PAGE.width - MARGIN_X, y, { align: 'right' });
    y += 5;
  } else if (s.paymentType === 'qarz') {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(190, 60, 60);
    doc.text('Qarzga olindi', MARGIN_X, y);
    doc.text(uzs(s.total), PAGE.width - MARGIN_X, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  if (s.note) {
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    const noteLines = doc.splitTextToSize(`Izoh: ${s.note}`, PAGE.width - MARGIN_X * 2);
    doc.text(noteLines, MARGIN_X, y);
    y += noteLines.length * 4;
    doc.setTextColor(0, 0, 0);
  }

  drawFooter(doc, y, ['Sotuvchi', 'Mijoz']);

  doc.save(`sotuv-${s.id.slice(0, 8)}-${dateSlug(s.date)}.pdf`);
}

// ---------------------------------------------------------------------------
// Expense cheque
// ---------------------------------------------------------------------------

export function expensePdf(e: Expense): void {
  const doc = newDoc();
  drawHeader(doc, `Harajat cheki  ·  #${e.id.slice(0, 8).toUpperCase()}`);

  let y = 34;
  y = metaRow(doc, 'Sana', formatDate(e.date), y);
  y = metaRow(doc, 'Kategoriya', e.category, y);
  y = metaRow(doc, "To'lov turi", paymentLabel(e.paymentType), y);
  y += 2;
  dashLine(doc, y);
  y += 6;

  // description block
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text('Tavsif', MARGIN_X, y);
  y += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const descLines = doc.splitTextToSize(e.description || '—', PAGE.width - MARGIN_X * 2);
  doc.text(descLines, MARGIN_X, y);
  y += descLines.length * 5 + 2;
  dashLine(doc, y);
  y += 8;

  // amount as the highlight
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text('Summa', MARGIN_X, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(uzs(e.amount), PAGE.width - MARGIN_X, y + 2, { align: 'right' });
  y += 12;

  if (e.auto) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text('avtomatik yaratilgan', MARGIN_X, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
  }

  drawFooter(doc, y, ['Kassir', 'Tasdiqlovchi']);

  doc.save(`harajat-${e.id.slice(0, 8)}-${dateSlug(e.date)}.pdf`);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function paymentLabel(p: Sale['paymentType']): string {
  switch (p) {
    case 'naqd': return 'Naqd';
    case 'karta': return 'Karta';
    case 'qarz': return 'Qarz';
    case 'aralash': return 'Aralash';
    default: return p;
  }
}

function dateSlug(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
