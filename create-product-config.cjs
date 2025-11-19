const data = require('./excel-data.json');
const fs = require('fs');

// Helper function to parse options from string
function parseOptions(value) {
  if (!value || value === 'X' || value === true) return null;

  // Split by multiple spaces, newlines, or specific delimiters
  const options = value
    .split(/[\r\n]+|(?:\s{2,})/)
    .map(opt => opt.trim())
    .filter(opt => opt !== '' && opt !== 'X');

  return options.length > 1 ? options : null;
}

// Field type detection
function detectFieldType(fieldName, value) {
  const name = fieldName.toLowerCase();

  // Radio/Select fields with JA/NEIN
  if (value && (value.includes('JA') || value.includes('NEIN'))) {
    return { type: 'radio', options: ['JA', 'NEIN'] };
  }

  // Select/Radio with multiple options
  const options = parseOptions(value);
  if (options && options.length > 0) {
    // If more than 4 options, use select dropdown
    return {
      type: options.length > 4 ? 'select' : 'radio',
      options
    };
  }

  // Number fields
  if (name.includes('breite') || name.includes('tiefe') ||
      name.includes('höhe') || name.includes('höhe') ||
      name.includes('anzahl') || name.includes('länge')) {
    return { type: 'number', unit: 'mm' };
  }

  // Boolean fields (marked with X)
  if (value === true || value === 'X') {
    return { type: 'boolean' };
  }

  // Text input as default
  return { type: 'text' };
}

// Field labels in German
const fieldLabels = {
  'Modell': 'Modell',
  'Breite': 'Breite',
  'Tiefe': 'Tiefe',
  'Höhe': 'Höhe',
  'Oberkante': 'Oberkante',
  'Unterkante': 'Unterkante',
  'Anzahl Stützen': 'Anzahl Stützen',
  'Höhe Stützen': 'Höhe Stützen',
  'Anzahl Flügel': 'Anzahl Flügel',
  'Gestellfarbe': 'Gestellfarbe',
  'Überstand': 'Überstand',
  'Befestingugnsart': 'Befestigungsart',
  'Êindeckung': 'Eindeckung',
  'Montageteam': 'Montageteam',
  'Kundenlokation': 'Kundenlokation',
  'Aufmesser / Berater': 'Aufmesser / Berater',
  'Kunde': 'Kunde',
  'Bilder': 'Bilder hochladen',
  'Statikträger': 'Statikträger',
  'Freistehend (JA/NEIN)': 'Freistehend',
  'Position (Links / Rechts / Front)': 'Position',
  'Öffnungsrichtung ': 'Öffnungsrichtung',
  'LED Belechtung': 'LED Beleuchtung',
  'Fundament': 'Fundament',
  'Wasserablauf (Links/Rechts)': 'Wasserablauf',
  'Bauform': 'Bauform',
  'Stützen': 'Stützen',
  'Volan Typ': 'Volan Typ',
  'Antrieb': 'Antrieb',
  'Antriebsseite': 'Antriebsseite',
  'Bemerkungen': 'Bemerkungen',
  'Markisenbreite': 'Markisenbreite',
  'Markisenlänge': 'Markisenlänge',
  'Stoff Nummer': 'Stoff Nummer',
  'ZIP (JA/NEIN)': 'ZIP'
};

// Fields to exclude (not product-specific)
const excludeFields = [
  'Title',
  'Überdachung',
  'Markise',
  'Glasdach',
  'Lamellendach',
  'Pergola',
  'Vordach',
  'Bilder', // Will be handled separately
  'Bemerkungen' // Will be handled separately
];

const headers = data[0];
const config = {};

let currentCategory = null;

// Parse each row
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const title = row[0];

  if (!title || title.trim() === '') continue;

  // Check if it's a category header
  if (title.includes('Produktkategorie')) {
    currentCategory = title.replace('Produktkategorie ', '').trim();
    config[currentCategory] = {};
    continue;
  }

  // Skip subcategory markers (Glasdach, Lamellendach without "Modell")
  if (!title.includes('Modell') && !title.includes('GLAS') &&
      !title.includes('SENKRECHT') && !title.includes('KASSE') &&
      !title.includes('Element') && !title.includes('Keil') && !title.includes('Tür')) {
    continue;
  }

  // Parse product
  if (currentCategory) {
    // Get product type name
    let productType = title
      .replace('Modell ', '')
      .replace('Model ', '')
      .trim();

    // Get models from the "Modell" column
    const modellColumnIndex = headers.indexOf('Modell');
    const modellValue = row[modellColumnIndex];

    let models = [];
    if (modellValue && modellValue !== 'X' && modellValue !== true) {
      models = modellValue
        .split(/[\r\n]+/)
        .map(m => m.trim())
        .filter(m => m !== '');
    }

    // If no models found, use the product type as the only model
    if (models.length === 0) {
      models = [productType];
    }

    // Parse fields for this product
    const fields = [];

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = row[j];

      // Skip excluded fields and empty values
      if (!header || excludeFields.includes(header) || !value || value === '') {
        continue;
      }

      // Detect field type
      const fieldConfig = detectFieldType(header, value);

      // Create field definition
      const field = {
        name: header.toLowerCase().replace(/[^a-z0-9]/g, ''),
        label: fieldLabels[header] || header,
        ...fieldConfig,
        required: ['Breite', 'Tiefe', 'Modell'].includes(header)
      };

      fields.push(field);
    }

    // Store configuration
    config[currentCategory][productType] = {
      models,
      fields
    };
  }
}

// Save configuration
fs.writeFileSync('src/config/productConfig.json', JSON.stringify(config, null, 2));

console.log('\n✅ Product configuration created successfully!');
console.log('\n📊 Summary:');

Object.keys(config).forEach(category => {
  console.log(`\n${category}:`);
  Object.keys(config[category]).forEach(product => {
    const productConfig = config[category][product];
    console.log(`  - ${product}`);
    console.log(`    Models: ${productConfig.models.length}`);
    console.log(`    Fields: ${productConfig.fields.length}`);
  });
});
