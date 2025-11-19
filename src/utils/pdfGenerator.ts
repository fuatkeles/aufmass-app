import { jsPDF } from 'jspdf';
import { FormData } from '../types';
import productConfigData from '../config/productConfig.json';
import type { ProductConfig, FieldConfig } from '../types/productConfig';

const productConfig = productConfigData as ProductConfig;

export const generatePDF = (formData: FormData) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  // Helper function to check if new page is needed
  const checkNewPage = (requiredSpace: number = 15) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      pdf.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header - AYLUX Logo
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
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('AUFMASS - DATENBLATT', margin, 25);

  yPos = 45;

  // ============ GRUNDDATEN ============
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(127, 169, 61);
  pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.text('GRUNDDATEN', margin + 2, yPos);
  yPos += 10;

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const grunddaten = [
    ['Datum:', formData.datum || '-'],
    ['Aufmasser / Berater:', formData.aufmasser || '-'],
    ['Montageteam:', formData.montageteam || '-'],
    ['Kunde:', `${formData.kundeVorname || ''} ${formData.kundeNachname || ''}`.trim() || '-'],
    ['Kundenlokation:', formData.kundenlokation || '-'],
  ];

  grunddaten.forEach(([label, value]) => {
    checkNewPage();
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin + 2, yPos);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(value, pageWidth - margin - 60);
    pdf.text(lines, margin + 52, yPos);
    yPos += 6 * lines.length;
  });

  yPos += 8;

  // ============ PRODUKTAUSWAHL ============
  checkNewPage(25);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(127, 169, 61);
  pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.text('PRODUKTAUSWAHL', margin + 2, yPos);
  yPos += 10;

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const produktauswahl = [
    ['Kategorie:', formData.productSelection.category || '-'],
    ['Produkttyp:', formData.productSelection.productType || '-'],
    ['Modell:', formData.productSelection.model || '-'],
  ];

  produktauswahl.forEach(([label, value]) => {
    checkNewPage();
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin + 2, yPos);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(value, pageWidth - margin - 60);
    pdf.text(lines, margin + 52, yPos);
    yPos += 6 * lines.length;
  });

  yPos += 8;

  // ============ SPEZIFIKATIONEN ============
  if (formData.productSelection.category && formData.productSelection.productType) {
    const fields = productConfig[formData.productSelection.category]?.[formData.productSelection.productType]?.fields || [];

    if (fields.length > 0 && Object.keys(formData.specifications).length > 0) {
      checkNewPage(25);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(127, 169, 61);
      pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.text('SPEZIFIKATIONEN', margin + 2, yPos);
      yPos += 10;

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      fields.forEach((field: FieldConfig) => {
        const value = formData.specifications[field.name];

        if (value !== undefined && value !== null && value !== '') {
          checkNewPage();

          let displayValue = '';

          if (typeof value === 'boolean') {
            displayValue = value ? 'Ja' : 'Nein';
          } else if (typeof value === 'number') {
            displayValue = field.unit ? `${value} ${field.unit}` : String(value);
          } else if (Array.isArray(value)) {
            displayValue = value.join(', ');
          } else {
            displayValue = String(value);
          }

          pdf.setFont('helvetica', 'bold');
          pdf.text(`${field.label}:`, margin + 2, yPos);
          pdf.setFont('helvetica', 'normal');

          const lines = pdf.splitTextToSize(displayValue, pageWidth - margin - 60);
          pdf.text(lines, margin + 52, yPos);
          yPos += 6 * lines.length;
        }
      });

      yPos += 8;
    }
  }

  // ============ BEMERKUNGEN ============
  if (formData.bemerkungen && formData.bemerkungen.trim()) {
    checkNewPage(25);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(127, 169, 61);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('BEMERKUNGEN', margin + 2, yPos);
    yPos += 10;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const lines = pdf.splitTextToSize(formData.bemerkungen, pageWidth - 2 * margin - 4);

    lines.forEach((line: string) => {
      checkNewPage();
      pdf.text(line, margin + 2, yPos);
      yPos += 6;
    });
  }

  // Footer
  const pageCount = (pdf as any).internal.getNumberOfPages();
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
  }

  // Save PDF
  const customerName = `${formData.kundeVorname || ''}_${formData.kundeNachname || ''}`.trim().replace(/\s+/g, '_') || 'Kunde';
  const date = formData.datum || new Date().toISOString().split('T')[0];
  const fileName = `Aufmass_${customerName}_${date}.pdf`;

  pdf.save(fileName);
};
