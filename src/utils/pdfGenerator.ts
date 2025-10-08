import { jsPDF } from 'jspdf';
import { FormData } from '../types';

export const generatePDF = (formData: FormData) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;


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

  yPos = 40;

  // Basic Information
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Grunddaten', margin, yPos);
  yPos += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const basicInfo = [
    ['Aufmasser / Berater:', formData.aufmasser || '-'],
    ['Montageteam:', formData.montageteam || '-'],
    ['Kunde:', formData.kunde || '-'],
    ['Datum:', formData.datum || '-'],
  ];

  basicInfo.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, margin + 50, yPos);
    yPos += 6;
  });

  yPos += 5;

  // Dimensions
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Abmessungen', margin, yPos);
  yPos += 7;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const dimensions = [
    ['Anzahl Stützen:', formData.anzahlStutzen || '-'],
    ['Höhe Stützen:', formData.hoheStutzen ? `${formData.hoheStutzen} cm` : '-'],
    ['Gestellfarbe:', formData.gestellfarbe || '-'],
  ];

  dimensions.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, margin + 50, yPos);
    yPos += 6;
  });

  yPos += 5;

  // Eindeckung
  pdf.setFont('helvetica', 'bold');
  pdf.text('Eindeckung:', margin, yPos);
  pdf.setFont('helvetica', 'normal');
  const eindeckungMap: { [key: string]: string } = {
    '8mm': '8mm VSG (klar / milchig)',
    '10mm': '10mm VSG (klar / milchig)',
    '16mm': '16mm PCS (klar / milchig)'
  };
  pdf.text(eindeckungMap[formData.eindeckung] || formData.eindeckung || '-', margin + 50, yPos);
  yPos += 10;

  // Products
  if (yPos > 250) {
    pdf.addPage();
    yPos = 20;
  }

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Produkte', margin, yPos);
  yPos += 7;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  if (formData.produkte && formData.produkte.length > 0) {
    const productNames: { [key: string]: string } = {
      'trendline': 'Trendline',
      'topline': 'Topline',
      'designline': 'Designline',
      'ultraline': 'Ultraline',
      'm-integrale': 'M. Integrale',
      'm-integrale-z': 'M. Integrale Z',
      'm-vetro': 'M. Vetro',
      'm-puro': 'M. Puro',
      'sqope': 'Sqope',
      'lamellendach': 'Lamellendach',
      'premiumline': 'Premiumline',
      'pergola': 'Pergola'
    };
    formData.produkte.forEach((product) => {
      pdf.text(`• ${productNames[product] || product}`, margin + 5, yPos);
      yPos += 5;
    });
  } else {
    pdf.text('Keine Produkte ausgewählt', margin + 5, yPos);
    yPos += 5;
  }

  yPos += 5;

  // Extras
  if (yPos > 240) {
    pdf.addPage();
    yPos = 20;
  }

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Extras', margin, yPos);
  yPos += 7;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const extras = [
    ['Statikträger:', formData.extras.statiktrager ? (formData.extras.statiktrager === 'ja' ? 'Ja' : 'Nein') : '-'],
    ['Freistehend:', formData.extras.freistehend ? (formData.extras.freistehend === 'ja' ? 'Ja' : 'Nein') : '-'],
    ['LED-Beleuchtung:', formData.extras.ledBeleuchtung || '-'],
    ['Fundament:', formData.extras.fundament || '-'],
    ['Wasserablauf:', formData.extras.wasserablauf?.join(', ') || '-'],
    ['Bauform:', formData.extras.bauform || '-'],
    ['Stützen:', formData.extras.stutzen || '-'],
  ];

  extras.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, margin + 50, yPos);
    yPos += 6;
  });

  yPos += 10;

  // Beschattung
  if (yPos > 230) {
    pdf.addPage();
    yPos = 20;
  }

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Beschattung', margin, yPos);
  yPos += 7;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const beschattungTypes = [];
  if (formData.beschattung.ancUnterglas) beschattungTypes.push('Anc. Unterglas');
  if (formData.beschattung.ancAufglas) beschattungTypes.push('Anc. Aufglas');
  if (formData.beschattung.capri) beschattungTypes.push('Capri');

  const beschattung = [
    ['Typ:', beschattungTypes.join(', ') || '-'],
    ['Markise:', formData.beschattung.markise || '-'],
    ['Breite:', formData.beschattung.breite || '-'],
    ['Tiefe:', formData.beschattung.tiefe || '-'],
    ['Volan Typ:', formData.beschattung.volanTyp ? (formData.beschattung.volanTyp === 'f-motor' ? 'F-Motor mit Handsender' : 'E-Motor') : '-'],
    ['Antrieb:', formData.beschattung.antrieb || '-'],
    ['Antriebsseite:', formData.beschattung.antriebsseite || '-'],
  ];

  beschattung.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, margin + 50, yPos);
    yPos += 6;
  });

  yPos += 10;

  // Zeichnung & Bemerkung
  if (formData.zeichnung) {
    if (yPos > 220) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Zeichnung & Bemerkung', margin, yPos);
    yPos += 7;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(formData.zeichnung, pageWidth - 2 * margin);
    pdf.text(lines, margin, yPos);
  }

  // Save PDF
  const fileName = `Aufmass_${formData.kunde || 'Kunde'}_${formData.datum || new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
};
