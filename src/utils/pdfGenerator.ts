import { jsPDF } from 'jspdf';
import { FormData } from '../types';
import productConfigData from '../config/productConfig.json';
import type { ProductConfig, FieldConfig } from '../types/productConfig';
import { getImageUrl, getStoredToken } from '../services/api';

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

  // ============ ABNAHME SECTION - If exists ============
  if (formData.abnahme) {
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

    // Problem description (if any)
    if (abnahme.hatProbleme && abnahme.problemBeschreibung) {
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

    // Notes (if any)
    if (abnahme.bemerkungen) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Bemerkungen:', margin + 2, yPos);
      yPos += 5;
      pdf.setFont('helvetica', 'normal');
      const notesLines = pdf.splitTextToSize(abnahme.bemerkungen, pageWidth - 2 * margin - 10);
      notesLines.forEach((line: string) => {
        pdf.text(line, margin + 8, yPos);
        yPos += 5;
      });
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
                  details = `Mit Aufteilung - Links: ${posData.links || 0} cm, Rechts: ${posData.rechts || 0} cm`;
                } else if (posData.aufteilung === 'ohne') {
                  details = `Ohne Aufteilung - Breite: ${posData.breite || 0} cm`;
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

            // Add Markise bemerkungen if exists
            const markiseBemerkungen = formData.specifications.markiseBemerkungen as string;
            if (markiseBemerkungen && markiseBemerkungen.trim()) {
              checkNewPage(15);
              pdf.setFont('helvetica', 'bold');
              pdf.text('Markise Bemerkungen:', margin + 5, yPos);
              yPos += 6;
              pdf.setFont('helvetica', 'normal');
              const bemerkungenLines = pdf.splitTextToSize(markiseBemerkungen, pageWidth - margin - 30);
              bemerkungenLines.forEach((line: string) => {
                checkNewPage();
                pdf.text(line, margin + 10, yPos);
                yPos += 5;
              });
            }
          }
        } catch (e) {
          // Skip markise data if parsing fails
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

        // Add Unterbauelemente bemerkungen if exists
        const unterbauelementeBemerkungen = formData.specifications.unterbauelementeBemerkungen as string;
        if (unterbauelementeBemerkungen && unterbauelementeBemerkungen.trim()) {
          checkNewPage(20);
          yPos += 5;
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Bemerkungen:', margin + 2, yPos);
          yPos += 6;
          pdf.setFont('helvetica', 'normal');
          const bemerkungenLines = pdf.splitTextToSize(unterbauelementeBemerkungen, pageWidth - margin - 20);
          bemerkungenLines.forEach((line: string) => {
            checkNewPage();
            pdf.text(line, margin + 8, yPos);
            yPos += 5;
          });
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
      const displayFields: [string, string][] = [];

      if (produkt.category) displayFields.push(['Kategorie:', produkt.category]);
      if (produkt.productType) displayFields.push(['Produkttyp:', produkt.productType]);
      if (produkt.model) displayFields.push(['Modell:', produkt.model]);

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
              displayFields.push(['Seitenmarkise:', '']);
              activePositions.forEach(position => {
                const posData = seitenmarkiseData[position];
                let details = '';
                if (posData.aufteilung === 'mit') {
                  details = `${position}: Mit Aufteilung - Links: ${posData.links || 0} cm, Rechts: ${posData.rechts || 0} cm`;
                } else if (posData.aufteilung === 'ohne') {
                  details = `${position}: Ohne Aufteilung - Breite: ${posData.breite || 0} cm`;
                }
                if (details) {
                  displayFields.push(['', details]);
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

          displayFields.push([`${field.label}:`, displayValue]);
        }
      });

      displayFields.forEach(([label, value]) => {
        checkNewPage();
        pdf.setFont('helvetica', 'bold');
        pdf.text(label, margin + 8, yPos);
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(value, pageWidth - margin - 70);
        pdf.text(lines, margin + 52, yPos);
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
  const bilder = formData.bilder as (File | ServerImage)[];
  if (bilder && bilder.length > 0) {
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

  // Save PDF
  const customerName = `${formData.kundeVorname || ''}_${formData.kundeNachname || ''}`.trim().replace(/\s+/g, '_') || 'Kunde';
  const date = formData.datum || new Date().toISOString().split('T')[0];
  const fileName = `Aufmass_${customerName}_${date}.pdf`;

  pdf.save(fileName);
};
