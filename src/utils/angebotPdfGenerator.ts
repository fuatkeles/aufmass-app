import { jsPDF } from 'jspdf';

export interface AngebotPdfItem {
  product_name: string;
  breite: number;
  tiefe: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface AngebotPdfExtra {
  description: string;
  price: number;
}

export interface AngebotPdfData {
  // Customer
  customer_firstname: string;
  customer_lastname: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: string;
  notes?: string;

  // Products
  items: AngebotPdfItem[];
  extras: AngebotPdfExtra[];
  total_price: number;

  // Optional measurement data (from Aufmaß)
  hasMeasurements?: boolean;
  measurements?: {
    category?: string;
    productType?: string;
    model?: string;
    specifications?: Record<string, unknown>;
  };

  // Meta
  created_at?: string;
  angebotNummer?: string;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
};

export const generateAngebotPDF = async (
  data: AngebotPdfData,
  options?: { returnBlob?: boolean }
): Promise<{ blob: Blob; fileName: string } | void> => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  const checkNewPage = (requiredSpace: number = 15) => {
    if (yPos + requiredSpace > pageHeight - 25) {
      pdf.addPage();
      yPos = 25;
      return true;
    }
    return false;
  };

  // ============ HEADER ============
  // AYLUX Logo
  pdf.setFillColor(127, 169, 61);
  pdf.rect(pageWidth - 70, 10, 50, 25, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('AYLUX', pageWidth - 60, 22);
  pdf.setFontSize(7);
  pdf.text('SONNENSCHUTZSYSTEME', pageWidth - 65, 28);

  // Title
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ANGEBOT', margin, 28);

  // Angebot number and date
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  const dateStr = data.created_at
    ? new Date(data.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  pdf.text(`Datum: ${dateStr}`, margin, 36);

  yPos = 50;

  // ============ CUSTOMER INFO ============
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(127, 169, 61);
  pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.text('KUNDENDATEN', margin + 3, yPos);
  yPos += 12;

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);

  const customerFields: [string, string][] = [
    ['Name:', `${data.customer_firstname} ${data.customer_lastname}`],
    ['E-Mail:', data.customer_email],
  ];
  if (data.customer_phone) customerFields.push(['Telefon:', data.customer_phone]);
  if (data.customer_address) customerFields.push(['Adresse:', data.customer_address]);

  customerFields.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin + 3, yPos);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(value, pageWidth - margin - 60);
    pdf.text(lines, margin + 40, yPos);
    yPos += 6 * lines.length;
  });

  yPos += 12;

  // ============ PRODUCTS TABLE ============
  if (data.items.length > 0) {
    checkNewPage(60);

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(127, 169, 61);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('PRODUKTE', margin + 3, yPos);
    yPos += 12;

    pdf.setTextColor(0, 0, 0);

    // Table header
    const colX = {
      produkt: margin + 3,
      abmessungen: margin + 70,
      menge: margin + 110,
      einzelpreis: margin + 130,
      gesamt: margin + 155
    };
    const tableWidth = pageWidth - 2 * margin;

    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos - 4, tableWidth, 8, 'F');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Produkt', colX.produkt, yPos);
    pdf.text('Abmessungen', colX.abmessungen, yPos);
    pdf.text('Menge', colX.menge, yPos);
    pdf.text('Einzelpreis', colX.einzelpreis, yPos);
    pdf.text('Gesamt', colX.gesamt, yPos);
    yPos += 8;

    // Table rows
    pdf.setFont('helvetica', 'normal');
    data.items.forEach((item) => {
      checkNewPage(10);

      pdf.text(item.product_name, colX.produkt, yPos);
      pdf.text(`${item.breite} x ${item.tiefe} cm`, colX.abmessungen, yPos);
      pdf.text(String(item.quantity), colX.menge, yPos);
      pdf.text(`${formatPrice(item.unit_price)} EUR`, colX.einzelpreis, yPos);
      pdf.text(`${formatPrice(item.total_price)} EUR`, colX.gesamt, yPos);
      yPos += 7;

      // Row separator
      pdf.setDrawColor(230, 230, 230);
      pdf.setLineWidth(0.2);
      pdf.line(margin, yPos - 3, margin + tableWidth, yPos - 3);
    });

    yPos += 5;
  }

  // ============ EXTRAS ============
  if (data.extras.length > 0) {
    checkNewPage(40);

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(127, 169, 61);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('ZUSATZLEISTUNGEN', margin + 3, yPos);
    yPos += 12;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);

    data.extras.forEach((extra) => {
      checkNewPage(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(extra.description, margin + 3, yPos);
      pdf.text(`${formatPrice(extra.price)} EUR`, margin + 155, yPos);
      yPos += 7;

      pdf.setDrawColor(230, 230, 230);
      pdf.setLineWidth(0.2);
      pdf.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
    });

    yPos += 5;
  }

  // ============ TOTAL ============
  checkNewPage(30);
  yPos += 5;

  // Total box
  const totalBoxWidth = 80;
  const totalBoxX = pageWidth - margin - totalBoxWidth;
  pdf.setFillColor(127, 169, 61);
  pdf.roundedRect(totalBoxX, yPos - 5, totalBoxWidth, 20, 3, 3, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Gesamtsumme:', totalBoxX + 5, yPos + 2);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${formatPrice(data.total_price)} EUR`, totalBoxX + 5, yPos + 11);

  // Netto/MwSt breakdown to the left
  const nettoPrice = data.total_price / 1.19;
  const mwstPrice = data.total_price - nettoPrice;

  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Netto: ${formatPrice(nettoPrice)} EUR`, totalBoxX - 55, yPos + 2);
  pdf.text(`MwSt. (19%): ${formatPrice(mwstPrice)} EUR`, totalBoxX - 55, yPos + 9);

  yPos += 30;

  // ============ MEASUREMENT DATA (if available) ============
  if (data.hasMeasurements && data.measurements) {
    checkNewPage(40);

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(52, 131, 235);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('MESSDATEN', margin + 3, yPos);
    yPos += 12;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);

    const m = data.measurements;

    if (m.category) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Kategorie:', margin + 3, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(m.category, margin + 40, yPos);
      yPos += 6;
    }
    if (m.productType) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Produkttyp:', margin + 3, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(m.productType, margin + 40, yPos);
      yPos += 6;
    }
    if (m.model) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Modell:', margin + 3, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(String(m.model), margin + 40, yPos);
      yPos += 6;
    }

    // Specifications
    if (m.specifications && Object.keys(m.specifications).length > 0) {
      yPos += 3;
      Object.entries(m.specifications).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '' && key !== 'montageteam' && key !== 'markiseData' && key !== 'markiseActive') {
          checkNewPage();
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${key}:`, margin + 3, yPos);
          pdf.setFont('helvetica', 'normal');
          const displayVal = typeof val === 'boolean' ? (val ? 'Ja' : 'Nein') : String(val);
          const lines = pdf.splitTextToSize(displayVal, pageWidth - margin - 60);
          pdf.text(lines, margin + 50, yPos);
          yPos += 6 * lines.length;
        }
      });
    }

    yPos += 10;
  }

  // ============ NOTES ============
  if (data.notes && data.notes.trim()) {
    checkNewPage(25);

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(127, 169, 61);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('NOTIZEN', margin + 3, yPos);
    yPos += 12;

    pdf.setTextColor(80, 80, 80);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const noteLines = pdf.splitTextToSize(data.notes, pageWidth - 2 * margin - 6);
    noteLines.forEach((line: string) => {
      checkNewPage();
      pdf.text(line, margin + 3, yPos);
      yPos += 5;
    });
  }

  // ============ FOOTER ============
  const pageCount = (pdf as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      `Seite ${i} von ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    pdf.text(
      `Erstellt am: ${new Date().toLocaleDateString('de-DE')}`,
      margin,
      pageHeight - 10
    );
    pdf.text(
      'AYLUX Sonnenschutzsysteme',
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // Generate filename
  const customerName = `${data.customer_firstname}_${data.customer_lastname}`.replace(/\s+/g, '_');
  const fileName = `Angebot_${customerName}_${dateStr.replace(/\./g, '-')}.pdf`;

  if (options?.returnBlob) {
    const blob = pdf.output('blob');
    return { blob, fileName };
  }

  pdf.save(fileName);
};
