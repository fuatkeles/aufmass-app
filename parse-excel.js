const XLSX = require('xlsx');
const fs = require('fs');

// Read the Excel file
const workbook = XLSX.readFile('C:\\Users\\fuatk\\OneDrive\\Masaüstü\\Aylux-Anforderungen-20251016-1.xlsx');

// Get the first sheet
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

// Save as JSON for analysis
fs.writeFileSync('excel-data.json', JSON.stringify(data, null, 2));

console.log('Excel parsed successfully!');
console.log('Total rows:', data.length);
console.log('First row (headers):', data[0]);
console.log('\nData saved to excel-data.json');
