const XLSX = require('xlsx');
const fs = require('fs');

// Read the Excel file
const workbook = XLSX.readFile('C:\\Users\\fuatk\\OneDrive\\Masaüstü\\Aylux-Anforderungen-20251016-1.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

console.log('=== Starting Excel Parse ===');
console.log('Total rows:', data.length);

// Header row is at index 0
const headers = data[0];
console.log('\nHeaders:', headers.slice(0, 10));

// Find column indices
const titleCol = 0; // "Title" column
const überdachungCol = headers.indexOf('Überdachung');
const markiseCol = headers.indexOf('Markise');

console.log('\nColumn indices:');
console.log('Überdachung:', überdachungCol);
console.log('Markise:', markiseCol);

const productConfig = {
  "ÜBERDACHUNG": {},
  "MARKISE": {},
  "UNTERBAUELEMENTE": {}
};

// Process each row
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const title = row[titleCol];

  if (!title || title.trim() === '') continue;

  console.log(`\nRow ${i}: ${title}`);

  // Check if this is a product type row (has X marks in category columns)
  const isÜberdachung = row[überdachungCol] === 'X';
  const isMarkise = row[markiseCol] === 'X';

  if (isÜberdachung) {
    console.log(`  -> ÜBERDACHUNG product: ${title}`);
    if (!productConfig.ÜBERDACHUNG[title]) {
      productConfig.ÜBERDACHUNG[title] = {
        models: [],
        fields: []
      };
    }
  } else if (isMarkise) {
    console.log(`  -> MARKISE product: ${title}`);
    if (!productConfig.MARKISE[title]) {
      productConfig.MARKISE[title] = {
        models: [],
        fields: []
      };
    }
  }
}

console.log('\n=== Product structure created ===');
console.log(JSON.stringify(productConfig, null, 2));

// Save the config
fs.writeFileSync('src/config/productConfig.json', JSON.stringify(productConfig, null, 2));
console.log('\n✅ Product config saved to src/config/productConfig.json');
