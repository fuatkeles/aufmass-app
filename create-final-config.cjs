const fs = require('fs');

// COMPLETE AND CORRECT product configuration
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
        { "name": "oberkante", "label": "Oberkante", "type": "boolean", "required": false },
        { "name": "unterkante", "label": "Unterkante", "type": "boolean", "required": false },
        { "name": "anzahlStützen", "label": "Anzahl Stützen", "type": "number", "required": false },
        { "name": "höheStützen", "label": "Höhe Stützen", "type": "number", "unit": "mm", "required": false },
        { "name": "anzahlFlügel", "label": "Anzahl Flügel", "type": "number", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
        { "name": "überstand", "label": "Überstand", "type": "boolean", "required": false },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Wand", "Decke", "Freistehend", "Untenbalkon"], "required": false },
        { "name": "eindeckung", "label": "Eindeckung", "type": "select", "options": ["8MM KLAR", "8MM MILCH", "10MM KLAR", "10MM MILCH", "16MM PCS KLAR", "16MM PCS MILCH"], "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
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
        { "name": "oberkante", "label": "Oberkante", "type": "boolean", "required": false },
        { "name": "unterkante", "label": "Unterkante", "type": "boolean", "required": false },
        { "name": "anzahlStützen", "label": "Anzahl Stützen", "type": "number", "required": false },
        { "name": "höheStützen", "label": "Höhe Stützen", "type": "number", "unit": "mm", "required": false },
        { "name": "anzahlFlügel", "label": "Anzahl Flügel", "type": "number", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
        { "name": "überstand", "label": "Überstand", "type": "boolean", "required": false },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Wand", "Decke", "Freistehend", "Untenbalkon"], "required": false },
        { "name": "eindeckung", "label": "Eindeckung", "type": "select", "options": ["8MM KLAR", "8MM MILCH", "10MM KLAR", "10MM MILCH", "16MM PCS KLAR", "16MM PCS MILCH"], "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "statikträger", "label": "Statikträger", "type": "select", "options": ["Für Überstand", "Für Decke", "Wand Extra"], "required": false },
        { "name": "freistehend", "label": "Freistehend", "type": "radio", "options": ["JA", "NEIN"], "required": false },
        { "name": "ledBeleuchtung", "label": "LED Beleuchtung", "type": "select", "options": ["6 Stück", "9 Stück", "12 Stück"], "required": false },
        { "name": "fundament", "label": "Fundament", "type": "radio", "options": ["Aylux", "Kunde"], "required": false },
        { "name": "wasserablauf", "label": "Wasserablauf", "type": "radio", "options": ["Links", "Rechts"], "required": false },
        { "name": "bauform", "label": "Bauform", "type": "select", "options": ["BUNDIG", "EINGERUCKT LINKS 50 CM", "EINGERUCKT RECHTS 50 CM"], "required": false },
        { "name": "stützen", "label": "Stützen", "type": "select", "options": ["2", "3", "4", "5"], "required": false },
        { "name": "markisenbreite", "label": "Markisenbreite", "type": "number", "unit": "mm", "required": false },
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
        { "name": "oberkante", "label": "Oberkante", "type": "boolean", "required": false },
        { "name": "unterkante", "label": "Unterkante", "type": "boolean", "required": false },
        { "name": "anzahlStützen", "label": "Anzahl Stützen", "type": "number", "required": false },
        { "name": "höheStützen", "label": "Höhe Stützen", "type": "number", "unit": "mm", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
        { "name": "überstand", "label": "Überstand", "type": "boolean", "required": false },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Wand", "Decke", "Freistehend", "Untenbalkon"], "required": false },
        { "name": "eindeckung", "label": "Eindeckung", "type": "select", "options": ["8MM KLAR", "8MM MILCH", "10MM KLAR", "10MM MILCH", "16MM PCS KLAR", "16MM PCS MILCH"], "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "statikträger", "label": "Statikträger", "type": "select", "options": ["Für Überstand", "Für Decke", "Wand Extra"], "required": false },
        { "name": "freistehend", "label": "Freistehend", "type": "radio", "options": ["JA", "NEIN"], "required": false },
        { "name": "ledBeleuchtung", "label": "LED Beleuchtung", "type": "select", "options": ["6 Stück", "9 Stück", "12 Stück"], "required": false },
        { "name": "fundament", "label": "Fundament", "type": "radio", "options": ["Aylux", "Kunde"], "required": false },
        { "name": "wasserablauf", "label": "Wasserablauf", "type": "radio", "options": ["Links", "Rechts"], "required": false },
        { "name": "bauform", "label": "Bauform", "type": "select", "options": ["BUNDIG", "EINGERUCKT LINKS 50 CM", "EINGERUCKT RECHTS 50 CM"], "required": false },
        { "name": "stützen", "label": "Stützen", "type": "select", "options": ["2", "3", "4", "5"], "required": false },
        { "name": "volanTyp", "label": "Volan Typ", "type": "text", "required": false },
        { "name": "antrieb", "label": "Antrieb", "type": "text", "required": false },
        { "name": "antriebsseite", "label": "Antriebsseite", "type": "text", "required": false },
        { "name": "markisenlänge", "label": "Markisenlänge", "type": "number", "unit": "mm", "required": false }
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
        { "name": "oberkante", "label": "Oberkante", "type": "boolean", "required": false },
        { "name": "unterkante", "label": "Unterkante", "type": "boolean", "required": false },
        { "name": "anzahlStützen", "label": "Anzahl Stützen", "type": "number", "required": false },
        { "name": "höheStützen", "label": "Höhe Stützen", "type": "number", "unit": "mm", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
        { "name": "überstand", "label": "Überstand", "type": "boolean", "required": false },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Wand", "Decke", "Freistehend", "Untenbalkon"], "required": false },
        { "name": "eindeckung", "label": "Eindeckung", "type": "select", "options": ["8MM KLAR", "8MM MILCH", "10MM KLAR", "10MM MILCH", "16MM PCS KLAR", "16MM PCS MILCH"], "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "statikträger", "label": "Statikträger", "type": "select", "options": ["Für Überstand", "Für Decke", "Wand Extra"], "required": false },
        { "name": "freistehend", "label": "Freistehend", "type": "radio", "options": ["JA", "NEIN"], "required": false },
        { "name": "ledBeleuchtung", "label": "LED Beleuchtung", "type": "select", "options": ["6 Stück", "9 Stück", "12 Stück"], "required": false },
        { "name": "fundament", "label": "Fundament", "type": "radio", "options": ["Aylux", "Kunde"], "required": false },
        { "name": "wasserablauf", "label": "Wasserablauf", "type": "radio", "options": ["Links", "Rechts"], "required": false },
        { "name": "bauform", "label": "Bauform", "type": "select", "options": ["BUNDIG", "EINGERUCKT LINKS 50 CM", "EINGERUCKT RECHTS 50 CM"], "required": false },
        { "name": "stützen", "label": "Stützen", "type": "select", "options": ["2", "3", "4", "5"], "required": false }
      ]
    }
  },
  "MARKISE": {
    "AUFGLAS": {
      "models": ["W350", "ANCONA AG"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
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
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
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
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Zwischen Pfosten", "Vor Pfosten"], "required": false },
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
    "VOLKASSETTE": {
      "models": ["TRENTINO"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Wand", "Decke", "Untenbalkon"], "required": false },
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
    "HALBEKASSETTE": {
      "models": ["AGUERO"],
      "fields": [
        { "name": "breite", "label": "Breite", "type": "number", "unit": "mm", "required": true },
        { "name": "tiefe", "label": "Tiefe", "type": "number", "unit": "mm", "required": true },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "befestigungsart", "label": "Befestigungsart", "type": "radio", "options": ["Wand", "Decke", "Untenbalkon"], "required": false },
        { "name": "volanTyp", "label": "Volan Typ", "type": "text", "required": false },
        { "name": "antrieb", "label": "Antrieb", "type": "text", "required": false },
        { "name": "antriebsseite", "label": "Antriebsseite", "type": "text", "required": false },
        { "name": "bemerkungen", "label": "Bemerkungen", "type": "textarea", "required": false },
        { "name": "markisenbreite", "label": "Markisenbreite", "type": "number", "unit": "mm", "required": false },
        { "name": "markisenlänge", "label": "Markisenlänge", "type": "number", "unit": "mm", "required": false },
        { "name": "stoffNummer", "label": "Stoff Nummer", "type": "text", "required": false },
        { "name": "zip", "label": "ZIP", "type": "radio", "options": ["JA", "NEIN"], "required": false }
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
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
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
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
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
        { "name": "anzahlStützen", "label": "Anzahl Stützen", "type": "number", "required": false },
        { "name": "anzahlFlügel", "label": "Anzahl Flügel", "type": "number", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "position", "label": "Position", "type": "radio", "options": ["LINKS", "RECHTS", "FRONT"], "required": false },
        { "name": "fundament", "label": "Fundament", "type": "radio", "options": ["STREIFEN", "AUSGLEICH"], "required": false }
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
        { "name": "anzahlStützen", "label": "Anzahl Stützen", "type": "number", "required": false },
        { "name": "anzahlFlügel", "label": "Anzahl Flügel", "type": "number", "required": false },
        { "name": "gestellfarbe", "label": "Gestellfarbe", "type": "text", "required": false },
        { "name": "montageteam", "label": "Montageteam", "type": "radio", "options": ["SENOL", "APO"], "required": true },
        { "name": "position", "label": "Position", "type": "radio", "options": ["LINKS", "RECHTS", "FRONT"], "required": false },
        { "name": "öffnungsrichtung", "label": "Öffnungsrichtung", "type": "radio", "options": ["INNEN", "AUSSEN"], "required": false },
        { "name": "fundament", "label": "Fundament", "type": "radio", "options": ["STREIFEN", "AUSGLEICH"], "required": false }
      ]
    }
  }
};

// Save the complete config
fs.writeFileSync('src/config/productConfig.json', JSON.stringify(productConfig, null, 2));

console.log('✅ COMPLETE PRODUCT CONFIG SAVED!');
console.log('\n📊 SUMMARY:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Categories:', Object.keys(productConfig).length);
console.log('\nÜBERDACHUNG:');
Object.keys(productConfig.ÜBERDACHUNG).forEach(product => {
  const p = productConfig.ÜBERDACHUNG[product];
  console.log(`  - ${product}: ${p.models.length} models, ${p.fields.length} fields`);
});
console.log('\nMARKISE:');
Object.keys(productConfig.MARKISE).forEach(product => {
  const p = productConfig.MARKISE[product];
  console.log(`  - ${product}: ${p.models.length} models, ${p.fields.length} fields`);
});
console.log('\nUNTERBAUELEMENTE:');
Object.keys(productConfig.UNTERBAUELEMENTE).forEach(product => {
  const p = productConfig.UNTERBAUELEMENTE[product];
  console.log(`  - ${product}: ${p.models.length} models, ${p.fields.length} fields`);
});
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
