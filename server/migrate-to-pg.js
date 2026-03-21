import sql from 'mssql';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ============ AZURE SQL (SOURCE) ============
const mssqlConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: { encrypt: true, trustServerCertificate: false },
  requestTimeout: 600000,
  connectionTimeout: 30000
};

// ============ POSTGRESQL (TARGET) ============
const pgConfig = {
  host: '72.62.34.253',
  port: 5432,
  database: 'aylux_aufmass_db',
  user: 'aylux_admin',
  password: 'Aylux2026DB',
  max: 3,
  idleTimeoutMillis: 600000,
  connectionTimeoutMillis: 30000,
  statement_timeout: 600000
};

// ============ SCHEMA ============
const PG_SCHEMA = `
DROP TABLE IF EXISTS aufmass_abnahme_bilder CASCADE;
DROP TABLE IF EXISTS aufmass_bilder CASCADE;
DROP TABLE IF EXISTS aufmass_temp_files CASCADE;
DROP TABLE IF EXISTS aufmass_esignature_requests CASCADE;
DROP TABLE IF EXISTS aufmass_esignatures CASCADE;
DROP TABLE IF EXISTS aufmass_status_history CASCADE;
DROP TABLE IF EXISTS aufmass_angebot_items CASCADE;
DROP TABLE IF EXISTS aufmass_angebot CASCADE;
DROP TABLE IF EXISTS aufmass_abnahme CASCADE;
DROP TABLE IF EXISTS aufmass_form_produkte CASCADE;
DROP TABLE IF EXISTS aufmass_forms CASCADE;
DROP TABLE IF EXISTS aufmass_lead_extras CASCADE;
DROP TABLE IF EXISTS aufmass_lead_items CASCADE;
DROP TABLE IF EXISTS aufmass_lead_products CASCADE;
DROP TABLE IF EXISTS aufmass_leads CASCADE;
DROP TABLE IF EXISTS aufmass_invitations CASCADE;
DROP TABLE IF EXISTS aufmass_users CASCADE;
DROP TABLE IF EXISTS aufmass_montageteams CASCADE;
DROP TABLE IF EXISTS aufmass_branch_settings CASCADE;
DROP TABLE IF EXISTS aufmass_branches CASCADE;

CREATE TABLE aufmass_branches (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE aufmass_branch_settings (
  id SERIAL PRIMARY KEY,
  branch_slug VARCHAR(100) NOT NULL,
  esignature_enabled BOOLEAN DEFAULT FALSE,
  esignature_sandbox BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  esignature_provider VARCHAR(40) DEFAULT 'openapi'
);

CREATE TABLE aufmass_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  branch_id VARCHAR(100)
);

CREATE TABLE aufmass_invitations (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  invited_by INT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  branch_id VARCHAR(100)
);

CREATE TABLE aufmass_montageteams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  branch_id VARCHAR(100)
);

CREATE TABLE aufmass_forms (
  id SERIAL PRIMARY KEY,
  datum DATE NOT NULL,
  aufmasser VARCHAR(100) NOT NULL,
  kunde_vorname VARCHAR(100) NOT NULL,
  kunde_nachname VARCHAR(100) NOT NULL,
  kundenlokation VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  product_type VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  specifications TEXT,
  markise_data TEXT,
  bemerkungen TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INT,
  kunde_email VARCHAR(255),
  montage_datum DATE,
  status_date DATE,
  generated_pdf BYTEA,
  pdf_generated_at TIMESTAMP,
  branch_id VARCHAR(100),
  papierkorb_date DATE,
  customer_signature TEXT,
  signature_name VARCHAR(255),
  signature_date TIMESTAMP,
  kunde_telefon VARCHAR(50),
  lead_id INT
);

CREATE TABLE aufmass_form_produkte (
  id SERIAL PRIMARY KEY,
  form_id INT NOT NULL REFERENCES aufmass_forms(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 1,
  category VARCHAR(200) NOT NULL,
  product_type VARCHAR(200) NOT NULL,
  model VARCHAR(200) NOT NULL,
  specifications TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE aufmass_bilder (
  id SERIAL PRIMARY KEY,
  form_id INT NOT NULL REFERENCES aufmass_forms(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_data BYTEA NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE aufmass_abnahme (
  id SERIAL PRIMARY KEY,
  form_id INT NOT NULL REFERENCES aufmass_forms(id) ON DELETE CASCADE,
  ist_fertig BOOLEAN DEFAULT FALSE,
  hat_probleme BOOLEAN DEFAULT FALSE,
  problem_beschreibung TEXT,
  kunde_name VARCHAR(200),
  kunde_unterschrift BOOLEAN DEFAULT FALSE,
  abnahme_datum TIMESTAMP,
  bemerkungen TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  maengel_liste TEXT,
  baustelle_sauber VARCHAR(10),
  monteur_note INT,
  signature_status VARCHAR(100)
);

CREATE TABLE aufmass_abnahme_bilder (
  id SERIAL PRIMARY KEY,
  form_id INT NOT NULL REFERENCES aufmass_forms(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_data BYTEA NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE aufmass_angebot (
  id SERIAL PRIMARY KEY,
  form_id INT NOT NULL REFERENCES aufmass_forms(id) ON DELETE CASCADE,
  netto_summe DECIMAL(10,2) NOT NULL,
  mwst_satz DECIMAL(5,2) DEFAULT 19.00,
  mwst_betrag DECIMAL(10,2) NOT NULL,
  brutto_summe DECIMAL(10,2) NOT NULL,
  angebot_datum TIMESTAMP,
  bemerkungen TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE aufmass_angebot_items (
  id SERIAL PRIMARY KEY,
  form_id INT NOT NULL REFERENCES aufmass_forms(id) ON DELETE CASCADE,
  bezeichnung VARCHAR(500) NOT NULL,
  menge DECIMAL(10,2) NOT NULL DEFAULT 1,
  einzelpreis DECIMAL(10,2) NOT NULL,
  gesamtpreis DECIMAL(10,2) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE aufmass_status_history (
  id SERIAL PRIMARY KEY,
  form_id INT NOT NULL REFERENCES aufmass_forms(id) ON DELETE CASCADE,
  status VARCHAR(100) NOT NULL,
  changed_by INT,
  changed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  status_date DATE
);

CREATE TABLE aufmass_esignature_requests (
  id SERIAL PRIMARY KEY,
  form_id INT NOT NULL REFERENCES aufmass_forms(id) ON DELETE CASCADE,
  signature_type VARCHAR(40) NOT NULL,
  openapi_signature_id VARCHAR(200),
  status VARCHAR(100) DEFAULT 'pending',
  signer_email VARCHAR(255),
  signer_name VARCHAR(255),
  signing_url VARCHAR(500),
  signed_document BYTEA,
  signed_at TIMESTAMP,
  callback_received_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  provider VARCHAR(40) DEFAULT 'openapi',
  boldsign_document_id VARCHAR(200),
  document_type VARCHAR(40) DEFAULT 'aufmass',
  branch_id VARCHAR(100)
);

CREATE TABLE aufmass_esignatures (
  id SERIAL PRIMARY KEY,
  form_id INT NOT NULL,
  signature_id VARCHAR(255) NOT NULL,
  state VARCHAR(100) DEFAULT 'pending',
  signed_document_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE aufmass_temp_files (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_data BYTEA NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE aufmass_leads (
  id SERIAL PRIMARY KEY,
  customer_firstname VARCHAR(200) NOT NULL,
  customer_lastname VARCHAR(200) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_address VARCHAR(500),
  notes TEXT,
  total_price DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(100) DEFAULT 'draft',
  branch_id VARCHAR(100),
  created_by INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  subtotal DECIMAL(10,2) DEFAULT 0,
  total_discount DECIMAL(10,2) DEFAULT 0
);

CREATE TABLE aufmass_lead_items (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES aufmass_leads(id) ON DELETE CASCADE,
  product_id INT,
  product_name VARCHAR(255) NOT NULL,
  breite INT,
  tiefe INT,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  pi_ober_kante VARCHAR(200),
  pi_unter_kante VARCHAR(200),
  pi_gestell_farbe VARCHAR(200),
  pi_sicherheitglas VARCHAR(200),
  pi_pfostenanzahl VARCHAR(200),
  pricing_type VARCHAR(40) DEFAULT 'dimension',
  unit_label VARCHAR(200),
  custom_field_values TEXT
);

CREATE TABLE aufmass_lead_extras (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES aufmass_leads(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

CREATE TABLE aufmass_lead_products (
  id SERIAL PRIMARY KEY,
  product_name VARCHAR(255) NOT NULL,
  breite INT NOT NULL,
  tiefe INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  branch_id VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  category VARCHAR(200),
  product_type VARCHAR(200),
  pricing_type VARCHAR(40) DEFAULT 'dimension',
  unit_label VARCHAR(200),
  description TEXT,
  custom_fields TEXT
);
`;

// Tables in dependency order
const TABLES_ORDER = [
  'aufmass_branches', 'aufmass_branch_settings', 'aufmass_users',
  'aufmass_invitations', 'aufmass_montageteams', 'aufmass_forms',
  'aufmass_form_produkte', 'aufmass_bilder', 'aufmass_abnahme',
  'aufmass_abnahme_bilder', 'aufmass_angebot', 'aufmass_angebot_items',
  'aufmass_status_history', 'aufmass_esignature_requests', 'aufmass_esignatures',
  'aufmass_temp_files', 'aufmass_leads', 'aufmass_lead_items',
  'aufmass_lead_extras', 'aufmass_lead_products'
];

// Large binary tables - fetch row by row from MSSQL
const BINARY_TABLES = new Set([
  'aufmass_bilder', 'aufmass_abnahme_bilder', 'aufmass_temp_files',
  'aufmass_forms', 'aufmass_esignature_requests'
]);

function convertValue(val, colName) {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString();
  if (Buffer.isBuffer(val)) return val;
  // BIT -> BOOLEAN
  if (typeof val === 'boolean') return val;
  return val;
}

async function migrateBinaryTable(mssqlPool, pgPool, tableName) {
  // Get IDs first (small query)
  const idsResult = await mssqlPool.request().query(`SELECT id FROM ${tableName} ORDER BY id`);
  const ids = idsResult.recordset.map(r => r.id);

  if (ids.length === 0) {
    console.log(`  ⏭️  ${tableName}: 0 rows (skipped)`);
    return 0;
  }

  console.log(`  📤 Migrating ${ids.length} rows (binary, row-by-row)...`);

  let inserted = 0;
  for (const id of ids) {
    try {
      // Fetch single row from MSSQL
      const row = (await mssqlPool.request()
        .input('id', sql.Int, id)
        .query(`SELECT * FROM ${tableName} WHERE id = @id`)
      ).recordset[0];

      if (!row) continue;

      // Insert into PG with fresh client
      const columns = Object.keys(row);
      const values = columns.map(c => convertValue(row[c], c));
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      const colNames = columns.map(c => `"${c}"`).join(', ');

      const pgClient = await pgPool.connect();
      try {
        await pgClient.query(
          `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders.join(', ')})`,
          values
        );
      } finally {
        pgClient.release();
      }

      inserted++;
      if (inserted % 25 === 0 || inserted === ids.length) {
        console.log(`    ... ${inserted}/${ids.length}`);
      }
    } catch (err) {
      console.error(`    ⚠️  Row id=${id} failed: ${err.message.substring(0, 100)}`);
    }
  }

  // Reset sequence
  if (ids.length > 0) {
    const maxId = Math.max(...ids);
    const pgClient = await pgPool.connect();
    await pgClient.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), $1, true)`, [maxId]);
    pgClient.release();
  }

  console.log(`  ✅ ${tableName}: ${inserted}/${ids.length} rows migrated`);
  return inserted;
}

async function migrateSmallTable(mssqlPool, pgPool, tableName) {
  const result = await mssqlPool.request().query(`SELECT * FROM ${tableName}`);
  const rows = result.recordset;

  if (rows.length === 0) {
    console.log(`  ⏭️  ${tableName}: 0 rows (skipped)`);
    return 0;
  }

  console.log(`  📤 Writing ${rows.length} rows...`);

  const pgClient = await pgPool.connect();
  try {
    await pgClient.query('BEGIN');

    for (const row of rows) {
      const columns = Object.keys(row);
      const values = columns.map(c => convertValue(row[c], c));
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      const colNames = columns.map(c => `"${c}"`).join(', ');

      await pgClient.query(
        `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders.join(', ')})`,
        values
      );
    }

    // Reset sequence
    if (rows.length > 0 && 'id' in rows[0]) {
      const maxId = Math.max(...rows.map(r => r.id));
      await pgClient.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), $1, true)`, [maxId]);
    }

    await pgClient.query('COMMIT');
    console.log(`  ✅ ${tableName}: ${rows.length} rows migrated`);
    return rows.length;
  } catch (err) {
    await pgClient.query('ROLLBACK');
    throw err;
  } finally {
    pgClient.release();
  }
}

async function main() {
  console.log('🚀 MSSQL → PostgreSQL Migration v2');
  console.log('===================================\n');

  console.log('1️⃣  Connecting to Azure SQL...');
  const mssqlPool = await sql.connect(mssqlConfig);
  console.log('   ✅ Connected\n');

  console.log('2️⃣  Connecting to PostgreSQL...');
  const pgPool2 = new pg.Pool(pgConfig);
  const testClient = await pgPool2.connect();
  console.log(`   ✅ Connected: ${(await testClient.query('SELECT current_database()')).rows[0].current_database}\n`);
  testClient.release();

  console.log('3️⃣  Creating schema...');
  const schemaClient = await pgPool2.connect();
  await schemaClient.query(PG_SCHEMA);
  schemaClient.release();
  console.log('   ✅ 20 tables created\n');

  console.log('4️⃣  Migrating data...');
  console.log('─'.repeat(50));

  const results = {};
  for (const table of TABLES_ORDER) {
    try {
      console.log(`\n📋 ${table}`);
      if (BINARY_TABLES.has(table)) {
        results[table] = await migrateBinaryTable(mssqlPool, pgPool2, table);
      } else {
        results[table] = await migrateSmallTable(mssqlPool, pgPool2, table);
      }
    } catch (err) {
      console.error(`  ❌ FAILED: ${err.message}`);
      results[table] = -1;
    }
  }

  console.log('\n\n5️⃣  VERIFICATION');
  console.log('═'.repeat(50));

  let allGood = true;
  for (const table of TABLES_ORDER) {
    const msCnt = (await mssqlPool.request().query(`SELECT COUNT(*) as cnt FROM ${table}`)).recordset[0].cnt;
    const pgCnt = (await pgPool2.query(`SELECT COUNT(*) as cnt FROM ${table}`)).rows[0].cnt;
    const match = parseInt(msCnt) === parseInt(pgCnt);
    const icon = match ? '✅' : '❌';
    console.log(`${icon} ${table.padEnd(30)} MSSQL=${String(msCnt).padStart(4)} PG=${String(pgCnt).padStart(4)}`);
    if (!match) allGood = false;
  }

  console.log('\n' + '═'.repeat(50));
  console.log(allGood ? '🎉 ALL DATA VERIFIED - ZERO LOSS!' : '⚠️  MISMATCHES FOUND - CHECK ABOVE');

  await sql.close();
  await pgPool2.end();
}

main().catch(err => { console.error('💀 FATAL:', err.message); process.exit(1); });
