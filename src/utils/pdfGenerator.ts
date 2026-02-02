import { jsPDF } from 'jspdf';
import { FormData } from '../types';
import productConfigData from '../config/productConfig.json';
import type { ProductConfig, FieldConfig } from '../types/productConfig';
import { getImageUrl, getStoredToken, getAbnahmeImageUrl } from '../services/api';

const productConfig = productConfigData as ProductConfig;

// Type for server image objects
interface ServerImage {
  id: number;
  file_name: string;
  file_type: string;
}

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to read EXIF orientation from image file
const getExifOrientation = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView(e.target?.result as ArrayBuffer);
      if (view.getUint16(0, false) !== 0xFFD8) {
        resolve(1); // Not a JPEG
        return;
      }
      const length = view.byteLength;
      let offset = 2;
      while (offset < length) {
        if (view.getUint16(offset + 2, false) <= 8) {
          resolve(1);
          return;
        }
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xFFE1) {
          if (view.getUint32(offset += 2, false) !== 0x45786966) {
            resolve(1);
            return;
          }
          const little = view.getUint16(offset += 6, false) === 0x4949;
          offset += view.getUint32(offset + 4, little);
          const tags = view.getUint16(offset, little);
          offset += 2;
          for (let i = 0; i < tags; i++) {
            if (view.getUint16(offset + (i * 12), little) === 0x0112) {
              resolve(view.getUint16(offset + (i * 12) + 8, little));
              return;
            }
          }
        } else if ((marker & 0xFF00) !== 0xFF00) {
          break;
        } else {
          offset += view.getUint16(offset, false);
        }
      }
      resolve(1);
    };
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
};

// Helper to fix image orientation based on EXIF data
const fixImageOrientation = (base64: string, orientation: number): Promise<string> => {
  return new Promise((resolve) => {
    if (orientation <= 1) {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Set canvas dimensions based on orientation
      if (orientation >= 5 && orientation <= 8) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      // Apply transformations based on EXIF orientation
      switch (orientation) {
        case 2: ctx.transform(-1, 0, 0, 1, img.width, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, img.width, img.height); break;
        case 4: ctx.transform(1, 0, 0, -1, 0, img.height); break;
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx.transform(0, 1, -1, 0, img.height, 0); break;
        case 7: ctx.transform(0, -1, -1, 0, img.height, img.width); break;
        case 8: ctx.transform(0, -1, 1, 0, 0, img.width); break;
      }

      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = base64;
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

// Helper to compress image for PDF (resize and reduce quality)
const compressImageForPDF = (base64: string, maxDimension: number = 800, quality: number = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

// Helper to get EXIF orientation from base64 string
const getExifOrientationFromBase64 = (base64: string): number => {
  try {
    // Remove data URL prefix
    const binaryString = atob(base64.split(',')[1]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check for JPEG marker
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
      return 1; // Not a JPEG
    }

    let offset = 2;
    while (offset < bytes.length - 1) {
      if (bytes[offset] !== 0xFF) {
        return 1;
      }

      const marker = bytes[offset + 1];

      // APP1 marker (EXIF)
      if (marker === 0xE1) {
        const exifStart = offset + 4;

        // Check for "Exif" string
        if (bytes[exifStart] === 0x45 && bytes[exifStart + 1] === 0x78 &&
            bytes[exifStart + 2] === 0x69 && bytes[exifStart + 3] === 0x66) {

          const tiffStart = exifStart + 6;
          const littleEndian = bytes[tiffStart] === 0x49;

          const getUint16 = (pos: number) => {
            if (littleEndian) {
              return bytes[pos] | (bytes[pos + 1] << 8);
            }
            return (bytes[pos] << 8) | bytes[pos + 1];
          };

          const ifdOffset = tiffStart + 8;
          const numEntries = getUint16(ifdOffset);

          for (let i = 0; i < numEntries; i++) {
            const entryOffset = ifdOffset + 2 + (i * 12);
            const tag = getUint16(entryOffset);

            if (tag === 0x0112) { // Orientation tag
              return getUint16(entryOffset + 8);
            }
          }
        }
        return 1;
      }

      // Skip to next marker
      if (marker === 0xD8 || marker === 0xD9) {
        offset += 2;
      } else {
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        offset += 2 + length;
      }
    }

    return 1;
  } catch {
    return 1;
  }
};

// Helper to automatically fix image orientation from base64
const fixImageOrientationAuto = async (base64: string): Promise<string> => {
  const orientation = getExifOrientationFromBase64(base64);
  if (orientation <= 1) {
    return base64;
  }
  return fixImageOrientation(base64, orientation);
};

// Helper to fetch server image and convert to base64
const fetchServerImageAsBase64 = async (imageId: number): Promise<string> => {
  const url = getImageUrl(imageId);
  const token = getStoredToken();

  const response = await fetch(url, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    throw new Error('Failed to fetch image');
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper to check if object is a server image
const isServerImage = (obj: unknown): obj is ServerImage => {
  return obj !== null &&
         typeof obj === 'object' &&
         'id' in obj &&
         'file_name' in obj &&
         typeof (obj as ServerImage).id === 'number';
};

export const generatePDF = async (formData: FormData, options?: { returnBlob?: boolean; forSignature?: boolean }): Promise<{ blob: Blob; fileName: string } | void> => {
  const forSignature = options?.forSignature || false;
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

  // ============ ABNAHME SECTION - If exists (skip for signature PDF) ============
  if (formData.abnahme && !forSignature) {
    const abnahme = formData.abnahme;

    // Abnahme header with green background
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(16, 185, 129); // Green color for abnahme
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('ABNAHME-PROTOKOLL', margin + 2, yPos);
    yPos += 12;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    // Status row with checkmarks
    const checkMark = 'Ja';
    const crossMark = 'Nein';

    // Arbeit fertiggestellt
    pdf.setFont('helvetica', 'bold');
    pdf.text('Arbeit fertiggestellt:', margin + 2, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(abnahme.istFertig ? checkMark : crossMark, margin + 52, yPos);
    yPos += 6;

    // Probleme vorhanden
    pdf.setFont('helvetica', 'bold');
    pdf.text('Probleme/Maengel:', margin + 2, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(abnahme.hatProbleme ? checkMark : crossMark, margin + 52, yPos);
    yPos += 6;

    // Common fields for both ARBEIT IST FERTIG and ES GIBT MÄNGEL
    if (abnahme.istFertig || abnahme.hatProbleme) {
      // Baustelle sauber
      if (abnahme.baustelleSauber) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Baustelle sauber:', margin + 2, yPos);
        pdf.setFont('helvetica', 'normal');
        pdf.text(abnahme.baustelleSauber === 'ja' ? 'JA' : 'NEIN', margin + 52, yPos);
        yPos += 6;
      }

      // Monteur Note
      if (abnahme.monteurNote) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Monteur Note:', margin + 2, yPos);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(abnahme.monteurNote), margin + 52, yPos);
        yPos += 6;
      }
    }

    // Mängel Liste only for ES GIBT MÄNGEL
    if (abnahme.hatProbleme) {
      // Mängel Liste (numbered defects)
      if (abnahme.maengelListe && Array.isArray(abnahme.maengelListe) && abnahme.maengelListe.some((m: string) => m.trim())) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Maengelliste:', margin + 2, yPos);
        yPos += 5;
        pdf.setFont('helvetica', 'normal');
        abnahme.maengelListe.forEach((mangel: string, idx: number) => {
          if (mangel && mangel.trim()) {
            const mangelText = `${idx + 1}) ${mangel}`;
            const mangelLines = pdf.splitTextToSize(mangelText, pageWidth - 2 * margin - 15);
            mangelLines.forEach((line: string) => {
              pdf.text(line, margin + 8, yPos);
              yPos += 5;
            });
          }
        });
        yPos += 2;
      }

      // Legacy problem description (for backward compatibility)
      if (abnahme.problemBeschreibung) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Problembeschreibung:', margin + 2, yPos);
        yPos += 5;
        pdf.setFont('helvetica', 'normal');
        const problemLines = pdf.splitTextToSize(abnahme.problemBeschreibung, pageWidth - 2 * margin - 10);
        problemLines.forEach((line: string) => {
          pdf.text(line, margin + 8, yPos);
          yPos += 5;
        });
        yPos += 2;
      }
    }

    // Abnahme Fotos - shown for both ARBEIT IST FERTIG and ES GIBT MÄNGEL
    if ((abnahme.istFertig || abnahme.hatProbleme) && abnahme.maengelBilder && Array.isArray(abnahme.maengelBilder) && abnahme.maengelBilder.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Abnahme Fotos:', margin + 2, yPos);
      yPos += 8;

      const imgWidth = 50;
      const imgHeight = 50;
      const imagesPerRow = 3;
      const imgGap = 5;

      for (let i = 0; i < abnahme.maengelBilder.length; i++) {
        const img = abnahme.maengelBilder[i];
        const col = i % imagesPerRow;
        const xPos = margin + col * (imgWidth + imgGap);

        // Check if we need a new page
        if (yPos + imgHeight > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }

        try {
          // Fetch image from server
          const token = getStoredToken();
          const imgUrl = getAbnahmeImageUrl(img.id);
          const response = await fetch(imgUrl, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });

          if (response.ok) {
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });

            // Get image format
            const format = img.file_type?.includes('png') ? 'PNG' : 'JPEG';
            pdf.addImage(base64, format, xPos, yPos, imgWidth, imgHeight);
          }
        } catch (err) {
          // Skip image if fetch fails
          console.error('Error loading abnahme image:', err);
        }

        // Move to next row after every 3 images
        if (col === imagesPerRow - 1) {
          yPos += imgHeight + imgGap;
        }
      }

      // If last row was not complete, still move down
      if (abnahme.maengelBilder.length % imagesPerRow !== 0) {
        yPos += imgHeight + imgGap;
      }

      yPos += 5;
    }

    // Notes (if any) - RED + UPPERCASE + BOLD
    if (abnahme.bemerkungen) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Bemerkungen:', margin + 2, yPos);
      yPos += 5;
      pdf.setTextColor(220, 38, 38); // Red color
      pdf.setFont('helvetica', 'bold');
      const notesText = abnahme.bemerkungen.toUpperCase();
      const notesLines = pdf.splitTextToSize(notesText, pageWidth - 2 * margin - 10);
      notesLines.forEach((line: string) => {
        pdf.text(line, margin + 8, yPos);
        yPos += 5;
      });
      pdf.setTextColor(0, 0, 0); // Reset color
      yPos += 2;
    }

    // Customer confirmation section
    yPos += 3;
    pdf.setDrawColor(16, 185, 129);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Kundenbestaetigung', margin + 2, yPos);
    yPos += 6;

    // Customer name
    if (abnahme.kundeName) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Kundenname:', margin + 2, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(abnahme.kundeName, margin + 52, yPos);
      yPos += 6;
    }

    // Customer confirmation
    pdf.setFont('helvetica', 'bold');
    pdf.text('Bestaetigt:', margin + 2, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(abnahme.kundeUnterschrift ? 'Ja, Kunde hat bestaetigt' : 'Nein, ausstehend', margin + 52, yPos);
    yPos += 6;

    // Abnahme date
    if (abnahme.abnahmeDatum) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Abnahmedatum:', margin + 2, yPos);
      pdf.setFont('helvetica', 'normal');
      const abnahmeDateFormatted = new Date(abnahme.abnahmeDatum).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      pdf.text(abnahmeDateFormatted, margin + 52, yPos);
      yPos += 6;
    }

    yPos += 10;
  }

  // ============ ANGEBOT SECTION - If exists ============
  if (formData.angebot && formData.angebot.items && formData.angebot.items.length > 0) {
    const angebot = formData.angebot;

    // Check if we need a new page
    checkNewPage(80);

    // Angebot header with purple background
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(167, 139, 250); // Purple color for angebot
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('ANGEBOT / PREISE', margin + 2, yPos);
    yPos += 12;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    // Table header
    const colWidths = {
      bezeichnung: 80,
      menge: 25,
      einzelpreis: 35,
      gesamtpreis: 35
    };
    const tableWidth = colWidths.bezeichnung + colWidths.menge + colWidths.einzelpreis + colWidths.gesamtpreis;
    const tableStartX = margin;

    // Header row background
    pdf.setFillColor(240, 240, 240);
    pdf.rect(tableStartX, yPos - 4, tableWidth, 8, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    let xPos = tableStartX + 2;
    pdf.text('Bezeichnung', xPos, yPos);
    xPos += colWidths.bezeichnung;
    pdf.text('Menge', xPos, yPos);
    xPos += colWidths.menge;
    pdf.text('Einzelpreis', xPos, yPos);
    xPos += colWidths.einzelpreis;
    pdf.text('Gesamt', xPos, yPos);
    yPos += 8;

    // Item rows
    pdf.setFont('helvetica', 'normal');
    for (const item of angebot.items) {
      checkNewPage(10);

      xPos = tableStartX + 2;
      // Truncate long descriptions
      const maxBezeichnungWidth = colWidths.bezeichnung - 4;
      const bezeichnungLines = pdf.splitTextToSize(item.bezeichnung, maxBezeichnungWidth);
      pdf.text(bezeichnungLines[0], xPos, yPos);

      xPos += colWidths.bezeichnung;
      pdf.text(String(item.menge), xPos, yPos);

      xPos += colWidths.menge;
      pdf.text(`${Number(item.einzelpreis).toFixed(2)} EUR`, xPos, yPos);

      xPos += colWidths.einzelpreis;
      pdf.text(`${Number(item.gesamtpreis).toFixed(2)} EUR`, xPos, yPos);

      yPos += 6;

      // Draw line under each row
      pdf.setDrawColor(230, 230, 230);
      pdf.setLineWidth(0.2);
      pdf.line(tableStartX, yPos - 2, tableStartX + tableWidth, yPos - 2);
    }

    yPos += 4;

    // Summary section
    if (angebot.summary) {
      const summaryX = tableStartX + colWidths.bezeichnung + colWidths.menge;

      pdf.setFont('helvetica', 'normal');
      pdf.text('Netto:', summaryX, yPos);
      pdf.text(`${Number(angebot.summary.netto_summe).toFixed(2)} EUR`, summaryX + colWidths.einzelpreis, yPos);
      yPos += 6;

      pdf.text(`MwSt. (${angebot.summary.mwst_satz || 19}%):`, summaryX, yPos);
      pdf.text(`${Number(angebot.summary.mwst_betrag).toFixed(2)} EUR`, summaryX + colWidths.einzelpreis, yPos);
      yPos += 6;

      pdf.setFont('helvetica', 'bold');
      pdf.text('Brutto:', summaryX, yPos);
      pdf.text(`${Number(angebot.summary.brutto_summe).toFixed(2)} EUR`, summaryX + colWidths.einzelpreis, yPos);
      yPos += 6;

      // Angebot date
      if (angebot.summary.angebot_datum) {
        yPos += 4;
        pdf.setFont('helvetica', 'normal');
        const angebotDateFormatted = new Date(angebot.summary.angebot_datum).toLocaleDateString('de-DE');
        pdf.text(`Angebotsdatum: ${angebotDateFormatted}`, tableStartX + 2, yPos);
      }
    }

    yPos += 15;
  }

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
    ['E-Mail:', formData.kundeEmail || '-'],
    ['Telefon:', formData.kundeTelefon || '-'],
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

  // Handle model as array or string
  const modelValue = Array.isArray(formData.productSelection.model)
    ? formData.productSelection.model.join(', ')
    : formData.productSelection.model;

  const produktauswahl = [
    ['Kategorie:', formData.productSelection.category || '-'],
    ['Produkttyp:', formData.productSelection.productType || '-'],
    ['Modell:', modelValue || '-'],
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
        // Check showWhen condition
        if (field.showWhen) {
          const dependentValue = formData.specifications[field.showWhen.field];
          if (dependentValue !== field.showWhen.value) {
            return; // Skip this field
          }
        }

        const value = formData.specifications[field.name];

        // Handle seitenmarkise field type separately
        if (field.type === 'seitenmarkise' && value) {
          try {
            const seitenmarkiseData = typeof value === 'string' ? JSON.parse(value) : value;
            const activePositions = Object.keys(seitenmarkiseData).filter(
              pos => seitenmarkiseData[pos]?.active
            );

            if (activePositions.length > 0) {
              checkNewPage(25);
              yPos += 5;
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(11);
              pdf.text('Seitenmarkise:', margin + 2, yPos);
              yPos += 8;

              pdf.setFontSize(10);
              activePositions.forEach(position => {
                const posData = seitenmarkiseData[position];
                checkNewPage();

                pdf.setFont('helvetica', 'bold');
                pdf.text(`${position}:`, margin + 5, yPos);
                pdf.setFont('helvetica', 'normal');

                let details = '';
                if (posData.aufteilung === 'mit') {
                  details = `Mit Aufteilung - Links: ${posData.links || 0} mm, Rechts: ${posData.rechts || 0} mm`;
                } else if (posData.aufteilung === 'ohne') {
                  details = `Ohne Aufteilung - Breite: ${posData.breite || 0} mm`;
                }

                pdf.text(details, margin + 30, yPos);
                yPos += 6;
              });
              yPos += 3;
            }
          } catch (e) {
            // Skip if parsing fails
          }
          return; // Skip normal processing for seitenmarkise
        }

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

          // For fundament field, append the additional details if available
          if (field.type === 'fundament' && formData.specifications[`${field.name}Value`]) {
            displayValue += ` - ${formData.specifications[`${field.name}Value`]}`;
          }

          // For conditional fields with valueUnit (like Dämmung, Überstand), append unit
          if (field.type === 'conditional' && field.valueUnit && value) {
            displayValue += ` ${field.valueUnit}`;
          }

          pdf.setFont('helvetica', 'bold');
          pdf.text(`${field.label}:`, margin + 2, yPos);
          pdf.setFont('helvetica', 'normal');

          // Set red color + bold + uppercase for conditional/bauform fields with "Ja" values
          // For conditional fields, check the ${field.name}Active flag
          const isConditionalActive = field.type === 'conditional' &&
            formData.specifications[`${field.name}Active`] === true;
          const isBauformActive = field.type === 'bauform' &&
            (displayValue.includes('EINGERÜCKT') || displayValue.includes('EINGERUCKT'));
          const isConditionalWithValue = isConditionalActive || isBauformActive;

          let finalDisplayValue = displayValue;
          if (isConditionalWithValue) {
            pdf.setTextColor(220, 38, 38); // Red color
            pdf.setFont('helvetica', 'bold');
            finalDisplayValue = displayValue.toUpperCase();
          }

          const lines = pdf.splitTextToSize(finalDisplayValue, pageWidth - margin - 60);
          pdf.text(lines, margin + 52, yPos);

          // Reset text color and font
          if (isConditionalWithValue) {
            pdf.setTextColor(0, 0, 0); // Back to black
            pdf.setFont('helvetica', 'normal');
          }
          yPos += 6 * lines.length;
        }
      });

      // Add Markise data if exists
      if (formData.specifications.markiseActive && formData.specifications.markiseData) {
        try {
          const parsed = JSON.parse(formData.specifications.markiseData as string);
          // Support both single object (legacy) and array format
          const markisenArray = Array.isArray(parsed) ? parsed : [parsed];

          if (markisenArray.length > 0) {
            checkNewPage(25);
            yPos += 5;
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.text(`Markise Details (${markisenArray.length} Stück):`, margin + 2, yPos);
            yPos += 10;

            // Iterate through all markisen
            markisenArray.forEach((markiseData: Record<string, unknown>, index: number) => {
              checkNewPage(30);

              // Markise header
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'bold');
              const markiseLabel = markiseData.typ
                ? `Markise ${index + 1}: ${markiseData.typ}${markiseData.position ? ` - ${markiseData.position}` : ''}`
                : `Markise ${index + 1}`;
              pdf.text(markiseLabel, margin + 5, yPos);
              yPos += 7;

              pdf.setFont('helvetica', 'normal');

              const markiseFields: [string, string][] = [
                ['Typ:', String(markiseData.typ || '-')],
                ['Modell:', String(markiseData.modell || '-')],
                ['Breite:', markiseData.breite ? `${markiseData.breite} mm` : '-'],
                ['Länge:', markiseData.laenge ? `${markiseData.laenge} mm` : '-'],
              ];

              // Height only for SENKRECHT
              if (markiseData.typ === 'SENKRECHT' && markiseData.hoehe) {
                markiseFields.push(['Höhe:', `${markiseData.hoehe} mm`]);
              }

              markiseFields.push(
                ['Stoff Nummer:', String(markiseData.stoffNummer || '-')],
                ['Gestellfarbe:', String(markiseData.gestellfarbe || '-')],
                ['Antrieb:', String(markiseData.antrieb || '-')],
                ['Antriebsseite:', String(markiseData.antriebsseite || '-')]
              );

              if (markiseData.befestigungsart) {
                markiseFields.push(['Befestigungsart:', String(markiseData.befestigungsart)]);
              }
              if (markiseData.position) {
                markiseFields.push(['Position:', String(markiseData.position)]);
              }
              if (markiseData.zip) {
                markiseFields.push(['ZIP:', String(markiseData.zip)]);
              }
              if (markiseData.volanTyp) {
                markiseFields.push(['Volan Typ:', String(markiseData.volanTyp)]);
              }

              markiseFields.forEach(([label, value]) => {
                if (value && value !== '-') {
                  checkNewPage();
                  pdf.setFont('helvetica', 'bold');
                  pdf.text(label, margin + 10, yPos);
                  pdf.setFont('helvetica', 'normal');
                  pdf.text(value, margin + 52, yPos);
                  yPos += 6;
                }
              });

              yPos += 5; // Space between markisen
            });

            // Add Markise bemerkungen if exists - RED + UPPERCASE + BOLD
            const markiseBemerkungen = formData.specifications.markiseBemerkungen as string;
            if (markiseBemerkungen && markiseBemerkungen.trim()) {
              checkNewPage(15);
              pdf.setFont('helvetica', 'bold');
              pdf.text('Markise Bemerkungen:', margin + 5, yPos);
              yPos += 6;
              pdf.setTextColor(220, 38, 38); // Red color
              pdf.setFont('helvetica', 'bold');
              const markiseBemerkungenText = markiseBemerkungen.toUpperCase();
              const bemerkungenLines = pdf.splitTextToSize(markiseBemerkungenText, pageWidth - margin - 30);
              bemerkungenLines.forEach((line: string) => {
                checkNewPage();
                pdf.text(line, margin + 10, yPos);
                yPos += 5;
              });
              pdf.setTextColor(0, 0, 0); // Reset color
            }
          }
        } catch (e) {
          // Skip markise data if parsing fails
        }
      }

      // ============ INTEGRATED AUFGLAS/UNTERGLAS MARKISE (for ÜBERDACHUNG) ============
      const glasMarkiseType = formData.specifications.glasMarkiseType as string;
      if (glasMarkiseType && glasMarkiseType !== 'Keine') {
        checkNewPage(30);
        yPos += 5;

        // Section header
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setFillColor(127, 169, 61);
        pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.text(glasMarkiseType, margin + 2, yPos);
        pdf.setTextColor(0, 0, 0);
        yPos += 10;

        pdf.setFontSize(10);
        const glasMarkiseFields: [string, string][] = [];

        if (formData.specifications.glasMarkiseAufteilung) {
          glasMarkiseFields.push(['Aufteilung:', String(formData.specifications.glasMarkiseAufteilung)]);
        }
        if (formData.specifications.glasMarkiseStoffNummer) {
          glasMarkiseFields.push(['Stoff Nummer:', String(formData.specifications.glasMarkiseStoffNummer)]);
        }
        if (formData.specifications.glasMarkiseZip) {
          glasMarkiseFields.push(['ZIP:', String(formData.specifications.glasMarkiseZip)]);
        }
        if (formData.specifications.glasMarkiseAntrieb) {
          glasMarkiseFields.push(['Antrieb:', String(formData.specifications.glasMarkiseAntrieb)]);
        }
        if (formData.specifications.glasMarkiseAntriebseite) {
          glasMarkiseFields.push(['Antriebseite:', String(formData.specifications.glasMarkiseAntriebseite)]);
        }

        glasMarkiseFields.forEach(([label, value]) => {
          checkNewPage();
          pdf.setFont('helvetica', 'bold');
          pdf.text(label, margin + 5, yPos);
          pdf.setFont('helvetica', 'normal');
          pdf.text(value, margin + 52, yPos);
          yPos += 6;
        });

        yPos += 5;
      }

      // ============ INTEGRATED SENKRECHT MARKISE (for ÜBERDACHUNG) ============
      const senkrechtActive = formData.specifications.senkrechtMarkiseActive as string;
      if (senkrechtActive === 'Ja' && formData.specifications.senkrechtMarkiseData) {
        try {
          const senkrechtData = JSON.parse(formData.specifications.senkrechtMarkiseData as string);
          if (Array.isArray(senkrechtData) && senkrechtData.length > 0) {
            checkNewPage(30);
            yPos += 5;

            // Section header
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setFillColor(127, 169, 61);
            pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.text(`SENKRECHT MARKISE (${senkrechtData.length} Stück)`, margin + 2, yPos);
            pdf.setTextColor(0, 0, 0);
            yPos += 10;

            pdf.setFontSize(10);

            senkrechtData.forEach((senkrecht: Record<string, unknown>, index: number) => {
              checkNewPage(25);

              // Item header
              pdf.setFont('helvetica', 'bold');
              pdf.text(`Senkrecht ${index + 1}${senkrecht.position ? ` - ${senkrecht.position}` : ''}:`, margin + 5, yPos);
              yPos += 7;
              pdf.setFont('helvetica', 'normal');

              const senkrechtFields: [string, string][] = [];

              if (senkrecht.position) senkrechtFields.push(['Position:', String(senkrecht.position)]);
              if (senkrecht.modell) senkrechtFields.push(['Modell:', String(senkrecht.modell)]);
              if (senkrecht.befestigungsart) senkrechtFields.push(['Befestigungsart:', String(senkrecht.befestigungsart)]);
              if (senkrecht.breite) senkrechtFields.push(['Breite:', `${senkrecht.breite} mm`]);
              if (senkrecht.hoehe) senkrechtFields.push(['Höhe:', `${senkrecht.hoehe} mm`]);
              if (senkrecht.zip) senkrechtFields.push(['ZIP:', String(senkrecht.zip)]);
              if (senkrecht.antrieb) senkrechtFields.push(['Antrieb:', String(senkrecht.antrieb)]);
              if (senkrecht.antriebseite) senkrechtFields.push(['Antriebseite:', String(senkrecht.antriebseite)]);
              if (senkrecht.anschlussseite) senkrechtFields.push(['Anschlussseite:', String(senkrecht.anschlussseite)]);
              if (senkrecht.gestellfarbe) senkrechtFields.push(['Gestellfarbe:', String(senkrecht.gestellfarbe)]);
              if (senkrecht.stoffNummer) senkrechtFields.push(['Stoff Nummer:', String(senkrecht.stoffNummer)]);

              senkrechtFields.forEach(([label, value]) => {
                checkNewPage();
                pdf.setFont('helvetica', 'bold');
                pdf.text(label, margin + 10, yPos);
                pdf.setFont('helvetica', 'normal');
                pdf.text(value, margin + 55, yPos);
                yPos += 6;
              });

              yPos += 5;
            });
          }
        } catch (e) {
          // Skip senkrecht data if parsing fails
        }
      }

      yPos += 8;
    }
  }

  // ============ UNTERBAUELEMENTE ============
  if (formData.productSelection.category === 'UNTERBAUELEMENTE' && formData.specifications.unterbauelementeData) {
    try {
      const elements = JSON.parse(formData.specifications.unterbauelementeData as string);
      if (Array.isArray(elements) && elements.length > 0) {
        checkNewPage(25);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setFillColor(127, 169, 61);
        pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.text(`UNTERBAUELEMENTE (${elements.length} Stück)`, margin + 2, yPos);
        yPos += 15;

        pdf.setTextColor(0, 0, 0);

        // Draw each element in a card-like box
        elements.forEach((el: Record<string, unknown>, index: number) => {
          // Calculate required height for this element
          const requiredHeight = 70;
          if (yPos + requiredHeight > pageHeight - 30) {
            pdf.addPage();
            yPos = 20;
          }

          // Draw element box background
          const boxStartY = yPos - 3;
          pdf.setFillColor(248, 250, 245); // Light green-ish background
          pdf.setDrawColor(127, 169, 61);
          pdf.roundedRect(margin, boxStartY, pageWidth - 2 * margin, 60, 3, 3, 'FD');

          // Element header with green background
          pdf.setFillColor(127, 169, 61);
          pdf.rect(margin, boxStartY, pageWidth - 2 * margin, 10, 'F');

          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(255, 255, 255);
          const elementLabel = el.produktTyp
            ? `${index + 1}. ${el.produktTyp}${el.position ? ` - ${el.position}` : ''}`
            : `Unterbauelement ${index + 1}`;
          pdf.text(elementLabel, margin + 5, boxStartY + 7);

          yPos = boxStartY + 17;
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(9);

          // Left column
          const leftColX = margin + 5;
          const rightColX = margin + (pageWidth - 2 * margin) / 2 + 5;
          let leftY = yPos;
          let rightY = yPos;

          const addField = (label: string, value: string, side: 'left' | 'right') => {
            const x = side === 'left' ? leftColX : rightColX;
            const y = side === 'left' ? leftY : rightY;

            pdf.setFont('helvetica', 'bold');
            pdf.text(label, x, y);
            pdf.setFont('helvetica', 'normal');
            pdf.text(value, x + 35, y);

            if (side === 'left') leftY += 7;
            else rightY += 7;
          };

          // Build fields based on produktTyp
          if (el.produktTyp) addField('Typ:', String(el.produktTyp), 'left');
          if (el.modell) addField('Modell:', String(el.modell), 'right');

          // Dimension fields - handle Keil and Festes Element with conditional fields
          if (el.produktTyp === 'Keil') {
            if (el.laenge) addField('Länge:', `${el.laenge} mm`, 'left');
            if (el.hintenHoehe) addField('Hinten:', `${el.hintenHoehe} mm`, 'right');
            if (el.vorneHoehe) addField('Vorne:', `${el.vorneHoehe} mm`, 'left');
          } else if (el.produktTyp === 'Festes Element') {
            // Festes Element has conditional fields based on elementForm
            if (el.elementForm) addField('Form:', String(el.elementForm), 'left');
            if (el.breite) addField('Breite:', `${el.breite} mm`, 'right');
            // Show hoehe only for Rechteck, hintenHoehe/vorneHoehe only for Trapez
            if (el.elementForm === 'Rechteck' && el.hoehe) {
              addField('Höhe:', `${el.hoehe} mm`, 'left');
            } else if (el.elementForm === 'Trapez') {
              if (el.hintenHoehe) addField('Hinten Höhe:', `${el.hintenHoehe} mm`, 'left');
              if (el.vorneHoehe) addField('Vorne Höhe:', `${el.vorneHoehe} mm`, 'right');
            }
          } else {
            if (el.breite) addField('Breite:', `${el.breite} mm`, 'left');
            if (el.hoehe) addField('Höhe:', `${el.hoehe} mm`, 'right');
          }

          if (el.gestellfarbe) addField('Farbe:', String(el.gestellfarbe), 'left');
          if (el.position) addField('Position:', String(el.position), 'right');
          if (el.oeffnungsrichtung) addField('Öffnung:', String(el.oeffnungsrichtung), 'left');
          if (el.anzahlFluegel) addField('Flügel:', String(el.anzahlFluegel), 'right');
          if (el.fundament) {
            let fundamentText = String(el.fundament);
            if (el.fundamentValue) fundamentText += ` - ${el.fundamentValue}`;
            addField('Fundament:', fundamentText, 'left');
          }
          if (el.drehrichtung) addField('Drehricht.:', String(el.drehrichtung), 'left');
          if (el.schloss) addField('Schloss:', String(el.schloss), 'right');

          yPos = boxStartY + 68; // Move past the box
        });

        // Add Unterbauelemente bemerkungen if exists - RED + UPPERCASE + BOLD
        const unterbauelementeBemerkungen = formData.specifications.unterbauelementeBemerkungen as string;
        if (unterbauelementeBemerkungen && unterbauelementeBemerkungen.trim()) {
          checkNewPage(20);
          yPos += 5;
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Bemerkungen:', margin + 2, yPos);
          yPos += 6;
          pdf.setTextColor(220, 38, 38); // Red color
          pdf.setFont('helvetica', 'bold');
          const unterbauBemerkungenText = unterbauelementeBemerkungen.toUpperCase();
          const bemerkungenLines = pdf.splitTextToSize(unterbauBemerkungenText, pageWidth - margin - 20);
          bemerkungenLines.forEach((line: string) => {
            checkNewPage();
            pdf.text(line, margin + 8, yPos);
            yPos += 5;
          });
          pdf.setTextColor(0, 0, 0); // Reset color
        }

        yPos += 10;
      }
    } catch (e) {
      // Skip unterbauelemente data if parsing fails
    }
  }

  // ============ WEITERE PRODUKTE ============
  console.log('PDF Generator - weitereProdukte:', formData.weitereProdukte);
  console.log('PDF Generator - weitereProdukte length:', formData.weitereProdukte?.length);
  if (formData.weitereProdukte && formData.weitereProdukte.length > 0) {
    // Start on a new page
    pdf.addPage();
    yPos = 20;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(127, 169, 61);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text(`WEITERE PRODUKTE (${formData.weitereProdukte.length} Stück)`, margin + 2, yPos);
    yPos += 10;

    pdf.setTextColor(0, 0, 0);

    formData.weitereProdukte.forEach((produkt, index) => {
      checkNewPage(40);

      // Product header
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      const produktLabel = produkt.category && produkt.productType
        ? `${index + 1}. ${produkt.category} - ${produkt.productType}${produkt.model ? ` (${produkt.model})` : ''}`
        : `Weiteres Produkt ${index + 1}`;
      pdf.text(produktLabel, margin + 2, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      // Get fields for this product type
      const produktFields = productConfig[produkt.category]?.[produkt.productType]?.fields || [];

      // Build display fields
      const displayFields: { label: string; value: string; isConditional: boolean }[] = [];

      if (produkt.category) displayFields.push({ label: 'Kategorie:', value: produkt.category, isConditional: false });
      if (produkt.productType) displayFields.push({ label: 'Produkttyp:', value: produkt.productType, isConditional: false });
      if (produkt.model) displayFields.push({ label: 'Modell:', value: produkt.model, isConditional: false });

      // Add specification fields
      produktFields.forEach((field: FieldConfig) => {
        // Check showWhen condition
        if (field.showWhen) {
          const dependentValue = produkt.specifications[field.showWhen.field];
          if (dependentValue !== field.showWhen.value) {
            return; // Skip this field
          }
        }

        const value = produkt.specifications[field.name];

        // Handle seitenmarkise field type separately for Weitere Produkte
        if (field.type === 'seitenmarkise' && value) {
          try {
            const seitenmarkiseData = typeof value === 'string' ? JSON.parse(value) : value;
            const activePositions = Object.keys(seitenmarkiseData).filter(
              pos => seitenmarkiseData[pos]?.active
            );

            if (activePositions.length > 0) {
              displayFields.push({ label: 'Seitenmarkise:', value: '', isConditional: false });
              activePositions.forEach(position => {
                const posData = seitenmarkiseData[position];
                let details = '';
                if (posData.aufteilung === 'mit') {
                  details = `${position}: Mit Aufteilung - Links: ${posData.links || 0} mm, Rechts: ${posData.rechts || 0} mm`;
                } else if (posData.aufteilung === 'ohne') {
                  details = `${position}: Ohne Aufteilung - Breite: ${posData.breite || 0} mm`;
                }
                if (details) {
                  displayFields.push({ label: '', value: details, isConditional: false });
                }
              });
            }
          } catch (e) {
            // Skip if parsing fails
          }
          return; // Skip normal processing for seitenmarkise
        }

        if (value !== undefined && value !== null && value !== '') {
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

          // For fundament field, append the additional details if available
          if (field.type === 'fundament' && produkt.specifications[`${field.name}Value`]) {
            displayValue += ` - ${produkt.specifications[`${field.name}Value`]}`;
          }

          // For conditional fields with valueUnit (like Dämmung, Überstand), append unit
          if (field.type === 'conditional' && field.valueUnit && value) {
            displayValue += ` ${field.valueUnit}`;
          }

          // Check if conditional field has Active flag set
          const isCondActive = field.type === 'conditional' &&
            produkt.specifications[`${field.name}Active`] === true;
          const isBauActive = field.type === 'bauform' &&
            (displayValue.includes('EINGERÜCKT') || displayValue.includes('EINGERUCKT'));

          displayFields.push({
            label: `${field.label}:`,
            value: displayValue,
            isConditional: isCondActive || isBauActive
          });
        }
      });

      displayFields.forEach((item) => {
        checkNewPage();
        pdf.setFont('helvetica', 'bold');
        pdf.text(item.label, margin + 8, yPos);
        pdf.setFont('helvetica', 'normal');

        // Set red color + bold + uppercase for conditional/bauform fields with "Ja" values
        let displayValue = item.value;
        if (item.isConditional) {
          pdf.setTextColor(220, 38, 38); // Red color
          pdf.setFont('helvetica', 'bold');
          displayValue = item.value.toUpperCase();
        }

        const lines = pdf.splitTextToSize(displayValue, pageWidth - margin - 70);
        pdf.text(lines, margin + 52, yPos);

        // Reset text color and font
        if (item.isConditional) {
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
        }
        yPos += 6 * lines.length;
      });

      yPos += 5; // Space between products
    });

    yPos += 8;
  }

  // ============ BEMERKUNGEN ============
  console.log('PDF Generator - bemerkungen value:', formData.bemerkungen);
  console.log('PDF Generator - bemerkungen type:', typeof formData.bemerkungen);
  if (formData.bemerkungen && formData.bemerkungen.trim()) {
    checkNewPage(25);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(127, 169, 61);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('BEMERKUNGEN', margin + 2, yPos);
    yPos += 10;

    // Use RED color and UPPERCASE for Bemerkungen text
    pdf.setTextColor(220, 38, 38); // Red color for Bemerkungen
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');

    // Convert to uppercase
    const bemerkText = formData.bemerkungen.toUpperCase();
    const lines = pdf.splitTextToSize(bemerkText, pageWidth - 2 * margin - 4);

    lines.forEach((line: string) => {
      checkNewPage();
      pdf.text(line, margin + 2, yPos);
      yPos += 6;
    });

    // Reset text color
    pdf.setTextColor(0, 0, 0);
  }

  // ============ BILDER & ANHÄNGE (skip for signature PDF) ============
  const bilder = formData.bilder as (File | ServerImage)[];
  if (bilder && bilder.length > 0 && !forSignature) {
    // Separate images and PDFs - handle both File and ServerImage objects
    const imageItems: (File | ServerImage)[] = [];
    const pdfFiles: File[] = [];
    const serverPdfFiles: ServerImage[] = [];

    for (const item of bilder) {
      if (!item) continue;

      if (item instanceof File) {
        // It's a File object
        if (item.type.startsWith('image/')) {
          imageItems.push(item);
        } else if (item.type === 'application/pdf' || item.name?.toLowerCase().endsWith('.pdf')) {
          pdfFiles.push(item);
        } else {
          // Check by extension
          const ext = item.name?.toLowerCase().split('.').pop();
          if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '')) {
            imageItems.push(item);
          }
        }
      } else if (isServerImage(item)) {
        // It's a server image/file object
        if (item.file_type.startsWith('image/')) {
          imageItems.push(item);
        } else if (item.file_type === 'application/pdf' || item.file_name?.toLowerCase().endsWith('.pdf')) {
          serverPdfFiles.push(item);
        }
      }
    }

    // Start attachments on a new page if we have any images
    if (imageItems.length > 0) {
      pdf.addPage();
      yPos = 20;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(127, 169, 61);
      pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.text('BILDER', margin + 2, yPos);
      yPos += 15;

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);

      // Process each image (both File and ServerImage)
      for (let i = 0; i < imageItems.length; i++) {
        const item = imageItems[i];
        let base64: string;
        let fileName: string;

        try {
          if (item instanceof File) {
            // It's a File object - get EXIF orientation and fix if needed
            const orientation = await getExifOrientation(item);
            base64 = await fileToBase64(item);
            base64 = await fixImageOrientation(base64, orientation);
            fileName = item.name;
          } else if (isServerImage(item)) {
            // It's a server image - fetch from server and fix orientation
            base64 = await fetchServerImageAsBase64(item.id);
            // Try to fix orientation for server images too
            base64 = await fixImageOrientationAuto(base64);
            fileName = item.file_name;
          } else {
            continue;
          }

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
          pdf.text(`Bild ${i + 1}: ${fileName}`, margin, yPos);
          yPos += 5;

          // Add image - center it horizontally
          const xPos = margin + (maxWidth - imgWidth) / 2;
          pdf.addImage(base64, 'JPEG', xPos, yPos, imgWidth, imgHeight);

          yPos += imgHeight + 15;

        } catch (error) {
          // If image fails to load, add a placeholder message
          const name = item instanceof File ? item.name : (isServerImage(item) ? item.file_name : 'Unbekannt');
          pdf.setFont('helvetica', 'italic');
          pdf.text(`Bild ${i + 1}: ${name} - Konnte nicht geladen werden`, margin, yPos);
          yPos += 10;
        }
      }
    }

    // PDF attachments are accessible via the application dashboard, not embedded in this PDF
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

  // Generate filename
  const customerName = `${formData.kundeVorname || ''}_${formData.kundeNachname || ''}`.trim().replace(/\s+/g, '_') || 'Kunde';
  const date = formData.datum || new Date().toISOString().split('T')[0];
  const fileName = `Aufmass_${customerName}_${date}.pdf`;

  // Return blob for preview or save directly
  if (options?.returnBlob) {
    const blob = pdf.output('blob');
    return { blob, fileName };
  }

  pdf.save(fileName);
};
