import { jsPDF } from 'jspdf';
import { FormData } from '../types';
import productConfigData from '../config/productConfig.json';
import type { ProductConfig, FieldConfig } from '../types/productConfig';
import { uploadTempFile } from '../services/api';

const productConfig = productConfigData as ProductConfig;

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to get image dimensions
const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.src = base64;
  });
};

export const generatePDF = async (formData: FormData) => {
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

  // Get montageteam from specifications if exists
  const montageteam = formData.specifications?.montageteam || '-';

  const grunddaten = [
    ['Datum:', formData.datum || '-'],
    ['Aufmasser / Berater:', formData.aufmasser || '-'],
    ['Kunde:', `${formData.kundeVorname || ''} ${formData.kundeNachname || ''}`.trim() || '-'],
    ['Kundenlokation:', formData.kundenlokation || '-'],
    ['Montageteam:', String(montageteam)],
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

      // Add Markise data if exists
      if (formData.specifications.markiseActive && formData.specifications.markiseData) {
        try {
          const markiseData = JSON.parse(formData.specifications.markiseData as string);

          checkNewPage(25);
          yPos += 5;
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.text('Markise Details:', margin + 2, yPos);
          yPos += 8;
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');

          const markiseFields = [
            ['Typ:', markiseData.typ || '-'],
            ['Modell:', markiseData.modell || '-'],
            ['Breite:', markiseData.breite ? `${markiseData.breite} mm` : '-'],
            ['Länge:', markiseData.laenge ? `${markiseData.laenge} mm` : '-'],
            ['Höhe:', markiseData.hoehe ? `${markiseData.hoehe} mm` : '-'],
            ['Stoff Nummer:', markiseData.stoffNummer || '-'],
            ['Gestellfarbe:', markiseData.gestellfarbe || '-'],
            ['Antrieb:', markiseData.antrieb || '-'],
            ['Antriebsseite:', markiseData.antriebsseite || '-'],
          ];

          if (markiseData.befestigungsart) {
            markiseFields.push(['Befestigungsart:', markiseData.befestigungsart]);
          }
          if (markiseData.position) {
            markiseFields.push(['Position:', markiseData.position]);
          }
          if (markiseData.zip) {
            markiseFields.push(['ZIP:', markiseData.zip]);
          }
          if (markiseData.volanTyp) {
            markiseFields.push(['Volan Typ:', markiseData.volanTyp]);
          }

          markiseFields.forEach(([label, value]) => {
            if (value && value !== '-') {
              checkNewPage();
              pdf.setFont('helvetica', 'bold');
              pdf.text(label, margin + 10, yPos);
              pdf.setFont('helvetica', 'normal');
              pdf.text(String(value), margin + 52, yPos);
              yPos += 6;
            }
          });
        } catch (e) {
          // Skip markise data if parsing fails
        }
      }

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

  // ============ BILDER & ANHÄNGE ============
  const bilder = formData.bilder as File[];
  if (bilder && bilder.length > 0) {
    // Separate images and PDFs - check both type and name extension for safety
    const imageFiles = bilder.filter(f => {
      if (!f || !f.type) return false;
      if (f.type.startsWith('image/')) return true;
      // Fallback: check file extension
      const ext = f.name?.toLowerCase().split('.').pop();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
    });
    const pdfFiles = bilder.filter(f => {
      if (!f) return false;
      if (f.type === 'application/pdf') return true;
      // Fallback: check file extension
      return f.name?.toLowerCase().endsWith('.pdf');
    });

    // Start attachments on a new page
    pdf.addPage();
    yPos = 20;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(127, 169, 61);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('BILDER & ANHÄNGE', margin + 2, yPos);
    yPos += 15;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);

    // List PDF attachments with clickable links
    if (pdfFiles.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('PDF Anhänge:', margin, yPos);
      yPos += 8;
      pdf.setFont('helvetica', 'normal');

      // Upload PDFs and create links
      for (const file of pdfFiles) {
        if (!file || !file.name) continue;
        checkNewPage();

        try {
          // Upload PDF to server and get URL
          const uploadResult = await uploadTempFile(file);
          const linkText = `• ${file.name}`;

          // Add clickable link
          pdf.setTextColor(0, 102, 204); // Blue color for link
          pdf.textWithLink(linkText, margin + 5, yPos, { url: uploadResult.url });
          pdf.setTextColor(0, 0, 0); // Reset to black
          yPos += 6;
        } catch {
          // If upload fails, just show filename without link
          pdf.text(`• ${file.name} (Link nicht verfügbar)`, margin + 5, yPos);
          yPos += 6;
        }
      }
      yPos += 10;
    }

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];

      // Skip if not a valid file
      if (!file || !(file instanceof File)) {
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const dimensions = await getImageDimensions(base64);

        // Calculate image size to fit on page
        const maxWidth = pageWidth - 2 * margin;
        const maxHeight = 80; // Max height per image

        let imgWidth = dimensions.width;
        let imgHeight = dimensions.height;

        // Scale to fit
        if (imgWidth > maxWidth) {
          const ratio = maxWidth / imgWidth;
          imgWidth = maxWidth;
          imgHeight = imgHeight * ratio;
        }

        if (imgHeight > maxHeight) {
          const ratio = maxHeight / imgHeight;
          imgHeight = maxHeight;
          imgWidth = imgWidth * ratio;
        }

        // Check if we need a new page
        if (yPos + imgHeight + 15 > pageHeight - 20) {
          pdf.addPage();
          yPos = 20;
        }

        // Add image label
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Bild ${i + 1}: ${file.name}`, margin, yPos);
        yPos += 5;

        // Add image - center it horizontally
        const xPos = margin + (maxWidth - imgWidth) / 2;
        pdf.addImage(base64, 'JPEG', xPos, yPos, imgWidth, imgHeight);

        yPos += imgHeight + 15;

      } catch (error) {
        // If image fails to load, add a placeholder message
        pdf.setFont('helvetica', 'italic');
        pdf.text(`Bild ${i + 1}: ${file.name} - Konnte nicht geladen werden`, margin, yPos);
        yPos += 10;
      }
    }
  }

  // Footer - update page count after all pages are added
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
  }

  // Save PDF
  const customerName = `${formData.kundeVorname || ''}_${formData.kundeNachname || ''}`.trim().replace(/\s+/g, '_') || 'Kunde';
  const date = formData.datum || new Date().toISOString().split('T')[0];
  const fileName = `Aufmass_${customerName}_${date}.pdf`;

  pdf.save(fileName);
};
