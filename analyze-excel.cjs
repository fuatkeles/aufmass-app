const data = require('./excel-data.json');

// Header row
const headers = data[0];

// Categories and their products
const categories = {
  'ÜBERDACHUNG': [],
  'MARKISE': [],
  'UNTERBAUELEMENTE': []
};

let currentCategory = null;

// Parse each row
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const title = row[0];

  if (!title || title.trim() === '') continue;

  // Check if it's a category header
  if (title.includes('Produktkategorie')) {
    currentCategory = title.replace('Produktkategorie ', '').trim();
    continue;
  }

  // It's a product/model
  if (currentCategory && title) {
    const product = {
      name: title,
      fields: {}
    };

    // Map each field that has an X or value
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = row[j];

      if (value && value !== '' && header && header !== '') {
        // Store the value or options
        if (value === 'X') {
          product.fields[header] = true;
        } else if (value.includes('\r\n') || value.includes('  ')) {
          // It's a list of options
          const options = value.split(/[\r\n]+/)
            .map(opt => opt.trim())
            .filter(opt => opt !== '');
          product.fields[header] = options.length > 1 ? options : value;
        } else {
          product.fields[header] = value;
        }
      }
    }

    categories[currentCategory].push(product);
  }
}

console.log('=== PARSED PRODUCT STRUCTURE ===\n');

Object.keys(categories).forEach(catName => {
  console.log(`\n📦 ${catName} (${categories[catName].length} products)`);
  console.log('─'.repeat(50));

  categories[catName].forEach(product => {
    console.log(`\n  ✓ ${product.name}`);
    console.log(`    Fields: ${Object.keys(product.fields).length}`);

    // Show key fields
    const fieldNames = Object.keys(product.fields)
      .filter(f => !['Überdachung', 'Markise', 'Glasdach', 'Lamellendach', 'Pergola', 'Vordach'].includes(f))
      .slice(0, 5);

    if (fieldNames.length > 0) {
      console.log(`    → ${fieldNames.join(', ')}...`);
    }
  });
});

// Save detailed JSON
const fs = require('fs');
fs.writeFileSync('product-config.json', JSON.stringify(categories, null, 2));
console.log('\n\n✅ Detailed configuration saved to product-config.json');
