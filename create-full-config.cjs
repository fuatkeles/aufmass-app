const fs = require('fs');

// Complete product configuration based on requirements
const productConfig = {
  "ÜBERDACHUNG": {
    "Glasdach": {
      "models": [
        "Premiumline",
        "Orangeline",
        "Trendline",
        "Topline",
        "Designline",
        "Ultraline",
        "Skyline",
        "Murano Puro",
        "Murano Int. Zip"
      ],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "oberkante", "label": "Oberkante", "type": "checkbox", "required": false },
        { "name": "unterkante", "label": "Unterkante", "type": "checkbox", "required": false },
        { "name": "anzahlStützen", "label": "Anzahl Stützen", "type": "number", "required": false },
        { "name": "höheStützen", "label": "Höhe Stützen", "type": "number", "unit": "mm", "required": false },
        { "name": "anzahlFlügel", "label": "Anzahl Flügel", "type": "number", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "überstand", "label": "Überstand", "type": "checkbox", "required": false },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Wand", "Decke", "Freistehend", "Untenbalkon"], "required": false },
        { "name": "eindeckung", "label": "Eindeckung", "type": "select", "options": ["8MM KLAR", "8MM MILCH", "10MM KLAR", "10MM MILCH", "16MM PCS KLAR", "16MM PCS MILCH"], "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "kundenlokation", "label": "Kundenlokation", "type": "checkbox", "required": false },
        { "name": "aufmesserBerater", "label": "Aufmesser / Berater", "type": "checkbox", "required": false },
        { "name": "kunde", "label": "Kunde", "type": "checkbox", "required": false },
        { "name": "statikträger", "label": "Statikträger", "type": "select", "options": ["Für Überstand", "Für Decke", "Wand Extra"], "required": false },
        { "name": "freistehend", "label": "Freistehend", "type": "radio", "options": ["JA", "NEIN"], "required": false },
        { "name": "ledBeleuchtung", "label": "LED Beleuchtung", "type": "select", "options": ["6 Stück", "9 Stück", "12 Stück"], "required": false },
        { "name": "fundament", "label": "Fundament", "type": "radio", "options": ["Aylux", "Kunde"], "required": false },
        { "name": "wasserablauf", "label": "Wasserablauf", "type": "radio", "options": ["Links", "Rechts"], "required": false },
        { "name": "bauform", "label": "Bauform", "type": "select", "options": ["BUNDIG", "EINGERUCKT LINKS 50 CM", "EINGERUCKT RECHTS 50 CM"], "required": false },
        { "name": "stützen", "label": "Stützen", "type": "select", "options": ["2", "3", "4", "5"], "required": false },
        { "name": "markisenbreite", "label": "Markisenbreite", "type": "number", "unit": "mm", "required": false }
      ]
    },
    "Lamellendach": {
      "models": [
        "X Roof",
        "Tarasola Essential",
        "Tarasola Technik",
        "Tarasola Puro",
        "Brustor"
      ],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "oberkante", "label": "Oberkante", "type": "checkbox", "required": false },
        { "name": "unterkante", "label": "Unterkante", "type": "checkbox", "required": false },
        { "name": "anzahlStützen", "label": "Anzahl Stützen", "type": "number", "required": false },
        { "name": "höheStützen", "label": "Höhe Stützen", "type": "number", "unit": "mm", "required": false },
        { "name": "anzahlFlügel", "label": "Anzahl Flügel", "type": "number", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "überstand", "label": "Überstand", "type": "checkbox", "required": false },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Wand", "Decke", "Freistehend", "Untenbalkon"], "required": false },
        { "name": "eindeckung", "label": "Eindeckung", "type": "select", "options": ["8MM KLAR", "8MM MILCH", "10MM KLAR", "10MM MILCH", "16MM PCS KLAR", "16MM PCS MILCH"], "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "volanTyp", "label": "Volan Typ", "type": "text", "required": false },
        { "name": "antrieb", "label": "Antrieb", "type": "text", "required": false },
        { "name": "antriebsseite", "label": "Antriebsseite", "type": "text", "required": false }
      ]
    },
    "Pergola": {
      "models": [
        "Flat 125",
        "Flat 135",
        "Pergola Markise"
      ],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "volanTyp", "label": "Volan Typ", "type": "text", "required": false },
        { "name": "antrieb", "label": "Antrieb", "type": "text", "required": false },
        { "name": "antriebsseite", "label": "Antriebsseite", "type": "text", "required": false },
        { "name": "markisenlänge", "label": "Markisenlänge", "type": "number", "unit": "mm", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true }
      ]
    },
    "Vordach": {
      "models": [
        "Premiumline Vordach",
        "Panther",
        "Tarasola Vordach"
      ],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "oberkante", "label": "Oberkante", "type": "checkbox", "required": false },
        { "name": "unterkante", "label": "Unterkante", "type": "checkbox", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true }
      ]
    }
  },
  "MARKISE": {
    "AUFGLAS": {
      "models": ["W350", "ANCONA AG"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "volanTyp", "label": "Volan Typ", "type": "text", "required": false },
        { "name": "antrieb", "label": "Antrieb", "type": "text", "required": false },
        { "name": "antriebsseite", "label": "Antriebsseite", "type": "text", "required": false },
        { "name": "bemerkungen", "label": "Bemerkungen", "type": "textarea", "required": false },
        { "name": "markisenbreite", "label": "Markisenbreite", "type": "number", "unit": "mm", "required": false },
        { "name": "markisenlänge", "label": "Markisenlänge", "type": "number", "unit": "mm", "required": false },
        { "name": "stoffNummer", "label": "Stoff Nummer", "type": "text", "required": false },
        { "name": "zip", "label": "ZIP", "type": "radio", "options": ["JA", "NEIN"], "required": false }
      ]
    },
    "UNTERGLAS": {
      "models": ["T350", "ANCONA UG"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "volanTyp", "label": "Volan Typ", "type": "text", "required": false },
        { "name": "antrieb", "label": "Antrieb", "type": "text", "required": false },
        { "name": "antriebsseite", "label": "Antriebsseite", "type": "text", "required": false },
        { "name": "bemerkungen", "label": "Bemerkungen", "type": "textarea", "required": false },
        { "name": "markisenbreite", "label": "Markisenbreite", "type": "number", "unit": "mm", "required": false },
        { "name": "markisenlänge", "label": "Markisenlänge", "type": "number", "unit": "mm", "required": false },
        { "name": "stoffNummer", "label": "Stoff Nummer", "type": "text", "required": false },
        { "name": "zip", "label": "ZIP", "type": "radio", "options": ["JA", "NEIN"], "required": false }
      ]
    },
    "SENKRECHT": {
      "models": ["2020Z", "1616Z"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "höhe", "label": "Höhe", "type": "number", "unit": "mm", "required": true },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Zwischen Pfosten", "Vor Pfosten"], "required": false },
        { "name": "volanTyp", "label": "Volan Typ", "type": "text", "required": false },
        { "name": "antrieb", "label": "Antrieb", "type": "text", "required": false },
        { "name": "stoffNummer", "label": "Stoff Nummer", "type": "text", "required": false }
      ]
    },
    "VOLKASSETTE": {
      "models": ["TRENTINO"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Wand", "Decke", "Untenbalkon"], "required": false },
        { "name": "volanTyp", "label": "Volan Typ", "type": "text", "required": false },
        { "name": "antrieb", "label": "Antrieb", "type": "text", "required": false },
        { "name": "stoffNummer", "label": "Stoff Nummer", "type": "text", "required": false }
      ]
    },
    "HALBEKASSETTE": {
      "models": ["AGUERO"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Wand", "Decke", "Untenbalkon"], "required": false },
        { "name": "volanTyp", "label": "Volan Typ", "type": "text", "required": false },
        { "name": "antrieb", "label": "Antrieb", "type": "text", "required": false },
        { "name": "stoffNummer", "label": "Stoff Nummer", "type": "text", "required": false }
      ]
    }
  },
  "UNTERBAUELEMENTE": {
    "GG Schiebe Element": {
      "models": ["AL22", "AL23", "AL24", "BELLAVISTA", "APT"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "höhe", "label": "Höhe", "type": "number", "unit": "mm", "required": true },
        { "name": "anzahlStützen", "label": "Anzahl Stützen", "type": "number", "required": false },
        { "name": "anzahlFlügel", "label": "Anzahl Flügel", "type": "number", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "position", "label": "Position", "type": "radio", "options": ["LINKS", "RECHTS", "FRONT", "FRONT LINKS", "FRONT RECHTS"], "required": false },
        { "name": "öffnungsrichtung", "label": "Öffnungsrichtung", "type": "radio", "options": ["NACH WAND", "NACH PFOSTEN", "NACH LINKS", "NACH RECHTS", "MITTIG ÖFFNEN"], "required": false },
        { "name": "fundament", "label": "Fundament", "type": "radio", "options": ["STREIFEN", "AUSGLEICH"], "required": false }
      ]
    },
    "Rahmen Schiebe Element": {
      "models": ["ALUXE", "APT", "BELLAVISTA"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "höhe", "label": "Höhe", "type": "number", "unit": "mm", "required": true },
        { "name": "anzahlStützen", "label": "Anzahl Stützen", "type": "number", "required": false },
        { "name": "anzahlFlügel", "label": "Anzahl Flügel", "type": "number", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "position", "label": "Position", "type": "radio", "options": ["LINKS", "RECHTS", "FRONT", "FRONT LINKS", "FRONT RECHTS"], "required": false },
        { "name": "öffnungsrichtung", "label": "Öffnungsrichtung", "type": "radio", "options": ["NACH WAND", "NACH PFOSTEN", "NACH LINKS", "NACH RECHTS", "MITTIG ÖFFNEN"], "required": false },
        { "name": "fundament", "label": "Fundament", "type": "radio", "options": ["STREIFEN", "AUSGLEICH"], "required": false }
      ]
    },
    "Festes Element": {
      "models": ["ALUXE", "APT", "BELLAVISTA"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "höhe", "label": "Höhe", "type": "number", "unit": "mm", "required": true },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "position", "label": "Position", "type": "radio", "options": ["LINKS", "RECHTS", "FRONT"], "required": false }
      ]
    },
    "Keil": {
      "models": ["ALUXE", "APT", "BELLAVISTA"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "höhe", "label": "Höhe", "type": "number", "unit": "mm", "required": true },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "position", "label": "Position", "type": "radio", "options": ["LINKS", "RECHTS"], "required": false }
      ]
    },
    "Dreh Tür": {
      "models": ["ALUXE", "APT", "BELLAVISTA"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "höhe", "label": "Höhe", "type": "number", "unit": "mm", "required": true },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "checkbox", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "position", "label": "Position", "type": "radio", "options": ["LINKS", "RECHTS", "FRONT"], "required": false },
        { "name": "öffnungsrichtung", "label": "Öffnungsrichtung", "type": "radio", "options": ["INNEN", "AUSSEN"], "required": false }
      ]
    }
  }
};

// Save the complete config
fs.writeFileSync('src/config/productConfig.json', JSON.stringify(productConfig, null, 2));
console.log('✅ Complete product config saved!');
console.log('\nCategories:', Object.keys(productConfig));
console.log('ÜBERDACHUNG products:', Object.keys(productConfig.ÜBERDACHUNG));
console.log('MARKISE products:', Object.keys(productConfig.MARKISE));
console.log('UNTERBAUELEMENTE products:', Object.keys(productConfig.UNTERBAUELEMENTE));
