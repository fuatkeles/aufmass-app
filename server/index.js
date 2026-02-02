import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import dotenv from 'dotenv';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://aufmass-app.vercel.app',
      'https://aufmass-api.conais.com',
      'http://localhost:5173',
      'http://localhost:5174'
    ];

    // Allow *.cnsform.com domains (branch subdomains)
    if (origin.match(/^https?:\/\/[a-z0-9-]+\.cnsform\.com$/i)) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Database configuration
const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

// Database connection pool
let pool;

async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to Azure SQL Database');
    await initializeTables();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
}

// Initialize tables
async function initializeTables() {
  try {
    // Forms table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_forms' AND xtype='U')
      CREATE TABLE aufmass_forms (
        id INT IDENTITY(1,1) PRIMARY KEY,
        datum DATE NOT NULL,
        aufmasser NVARCHAR(100) NOT NULL,
        kunde_vorname NVARCHAR(100) NOT NULL,
        kunde_nachname NVARCHAR(100) NOT NULL,
        kunde_email NVARCHAR(255),
        kunde_telefon NVARCHAR(50),
        kundenlokation NVARCHAR(255) NOT NULL,
        category NVARCHAR(100) NOT NULL,
        product_type NVARCHAR(100) NOT NULL,
        model NVARCHAR(100) NOT NULL,
        specifications NVARCHAR(MAX),
        markise_data NVARCHAR(MAX),
        bemerkungen NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'neu',
        created_by INT,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Add kunde_email column if it doesn't exist (migration for existing tables)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'kunde_email')
      BEGIN
        ALTER TABLE aufmass_forms ADD kunde_email NVARCHAR(255)
      END
    `);

    // Add kunde_telefon column if it doesn't exist (migration for existing tables)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'kunde_telefon')
      BEGIN
        ALTER TABLE aufmass_forms ADD kunde_telefon NVARCHAR(50)
      END
    `);

    // Add montage_datum column if it doesn't exist (for planned montage date)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'montage_datum')
      BEGIN
        ALTER TABLE aufmass_forms ADD montage_datum DATE
      END
    `);

    // Add status_date column if it doesn't exist (for current status date)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'status_date')
      BEGIN
        ALTER TABLE aufmass_forms ADD status_date DATE
      END
    `);

    // Add papierkorb_date column for trash auto-delete after 30 days
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'papierkorb_date')
      BEGIN
        ALTER TABLE aufmass_forms ADD papierkorb_date DATE
      END
    `);

    // Set papierkorb_date for existing papierkorb items that don't have it
    await pool.request().query(`
      UPDATE aufmass_forms
      SET papierkorb_date = CAST(GETDATE() AS DATE)
      WHERE status = 'papierkorb' AND papierkorb_date IS NULL
    `);

    // Add generated_pdf column to store pre-generated PDF
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'generated_pdf')
      BEGIN
        ALTER TABLE aufmass_forms ADD generated_pdf VARBINARY(MAX)
      END
    `);

    // Add pdf_generated_at column to track when PDF was last generated
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'pdf_generated_at')
      BEGIN
        ALTER TABLE aufmass_forms ADD pdf_generated_at DATETIME
      END
    `);

    // Add lead_id column to link form back to its originating lead
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'lead_id')
      BEGIN
        ALTER TABLE aufmass_forms ADD lead_id INT
      END
    `);

    // Add missing columns to aufmass_abnahme table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_abnahme') AND name = 'maengel_liste')
      BEGIN
        ALTER TABLE aufmass_abnahme ADD maengel_liste NVARCHAR(MAX)
      END
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_abnahme') AND name = 'baustelle_sauber')
      BEGIN
        ALTER TABLE aufmass_abnahme ADD baustelle_sauber NVARCHAR(10)
      END
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_abnahme') AND name = 'monteur_note')
      BEGIN
        ALTER TABLE aufmass_abnahme ADD monteur_note INT
      END
    `);

    // Abnahme/Mängel images table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_abnahme_bilder' AND xtype='U')
      CREATE TABLE aufmass_abnahme_bilder (
        id INT IDENTITY(1,1) PRIMARY KEY,
        form_id INT NOT NULL,
        file_name NVARCHAR(255) NOT NULL,
        file_data VARBINARY(MAX) NOT NULL,
        file_type NVARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (form_id) REFERENCES aufmass_forms(id) ON DELETE CASCADE
      )
    `);

    // Images table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_bilder' AND xtype='U')
      CREATE TABLE aufmass_bilder (
        id INT IDENTITY(1,1) PRIMARY KEY,
        form_id INT NOT NULL,
        file_name NVARCHAR(255) NOT NULL,
        file_data VARBINARY(MAX) NOT NULL,
        file_type NVARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (form_id) REFERENCES aufmass_forms(id) ON DELETE CASCADE
      )
    `);

    // Users table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_users' AND xtype='U')
      CREATE TABLE aufmass_users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        name NVARCHAR(100) NOT NULL,
        role NVARCHAR(50) DEFAULT 'user',
        is_active BIT DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Invitations table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_invitations' AND xtype='U')
      CREATE TABLE aufmass_invitations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        token NVARCHAR(255) NOT NULL UNIQUE,
        email NVARCHAR(255) NOT NULL,
        role NVARCHAR(50) DEFAULT 'user',
        invited_by INT NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Montageteams table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_montageteams' AND xtype='U')
      CREATE TABLE aufmass_montageteams (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL UNIQUE,
        is_active BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Form Products table (for multiple products per form)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_form_produkte' AND xtype='U')
      CREATE TABLE aufmass_form_produkte (
        id INT IDENTITY(1,1) PRIMARY KEY,
        form_id INT NOT NULL,
        sort_order INT NOT NULL DEFAULT 1,
        category NVARCHAR(100) NOT NULL,
        product_type NVARCHAR(100) NOT NULL,
        model NVARCHAR(100) NOT NULL,
        specifications NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (form_id) REFERENCES aufmass_forms(id) ON DELETE CASCADE
      )
    `);

    // Add created_by column to aufmass_forms if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'created_by')
      BEGIN
        ALTER TABLE aufmass_forms ADD created_by INT NULL
      END
    `);

    // Migrate old status values to new ones (draft/completed -> neu)
    await pool.request().query(`
      UPDATE aufmass_forms
      SET status = 'neu'
      WHERE status IN ('draft', 'completed')
    `);

    // Status History table - tracks all status changes with timestamps
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_status_history' AND xtype='U')
      CREATE TABLE aufmass_status_history (
        id INT IDENTITY(1,1) PRIMARY KEY,
        form_id INT NOT NULL,
        status NVARCHAR(50) NOT NULL,
        changed_by INT,
        changed_at DATETIME DEFAULT GETDATE(),
        status_date DATE,
        notes NVARCHAR(MAX),
        FOREIGN KEY (form_id) REFERENCES aufmass_forms(id) ON DELETE CASCADE
      )
    `);

    // Add status_date column if not exists (for existing tables)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_status_history') AND name = 'status_date')
      ALTER TABLE aufmass_status_history ADD status_date DATE
    `);

    // Abnahme (acceptance/completion) data table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_abnahme' AND xtype='U')
      CREATE TABLE aufmass_abnahme (
        id INT IDENTITY(1,1) PRIMARY KEY,
        form_id INT NOT NULL UNIQUE,
        ist_fertig BIT DEFAULT 0,
        hat_probleme BIT DEFAULT 0,
        problem_beschreibung NVARCHAR(MAX),
        kunde_name NVARCHAR(200),
        kunde_unterschrift BIT DEFAULT 0,
        abnahme_datum DATETIME,
        bemerkungen NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (form_id) REFERENCES aufmass_forms(id) ON DELETE CASCADE
      )
    `);

    // ============ ANGEBOT (QUOTE) TABLES ============

    // Angebot items table for line-item pricing
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_angebot_items' AND xtype='U')
      CREATE TABLE aufmass_angebot_items (
        id INT IDENTITY(1,1) PRIMARY KEY,
        form_id INT NOT NULL,
        bezeichnung NVARCHAR(500) NOT NULL,
        menge DECIMAL(10,2) NOT NULL DEFAULT 1,
        einzelpreis DECIMAL(10,2) NOT NULL,
        gesamtpreis DECIMAL(10,2) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (form_id) REFERENCES aufmass_forms(id) ON DELETE CASCADE
      )
    `);

    // Angebot summary table for totals
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_angebot' AND xtype='U')
      CREATE TABLE aufmass_angebot (
        id INT IDENTITY(1,1) PRIMARY KEY,
        form_id INT NOT NULL UNIQUE,
        netto_summe DECIMAL(10,2) NOT NULL,
        mwst_satz DECIMAL(5,2) DEFAULT 19.00,
        mwst_betrag DECIMAL(10,2) NOT NULL,
        brutto_summe DECIMAL(10,2) NOT NULL,
        angebot_datum DATETIME,
        bemerkungen NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (form_id) REFERENCES aufmass_forms(id) ON DELETE CASCADE
      )
    `);

    // ============ MULTI-TENANCY TABLES ============

    // Branches table (for multi-tenant support)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_branches' AND xtype='U')
      CREATE TABLE aufmass_branches (
        id INT IDENTITY(1,1) PRIMARY KEY,
        slug NVARCHAR(50) NOT NULL UNIQUE,
        name NVARCHAR(100) NOT NULL,
        is_active BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Add branch_id to aufmass_forms
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'branch_id')
      BEGIN
        ALTER TABLE aufmass_forms ADD branch_id NVARCHAR(50)
      END
    `);

    // Add branch_id to aufmass_users
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_users') AND name = 'branch_id')
      BEGIN
        ALTER TABLE aufmass_users ADD branch_id NVARCHAR(50)
      END
    `);

    // Add branch_id to aufmass_montageteams
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_montageteams') AND name = 'branch_id')
      BEGIN
        ALTER TABLE aufmass_montageteams ADD branch_id NVARCHAR(50)
      END
    `);

    // Add branch_id to aufmass_invitations
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_invitations') AND name = 'branch_id')
      BEGIN
        ALTER TABLE aufmass_invitations ADD branch_id NVARCHAR(50)
      END
    `);

    // Create indexes for branch_id (for performance)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_aufmass_forms_branch_id')
      CREATE INDEX IX_aufmass_forms_branch_id ON aufmass_forms(branch_id)
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_aufmass_users_branch_id')
      CREATE INDEX IX_aufmass_users_branch_id ON aufmass_users(branch_id)
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_aufmass_montageteams_branch_id')
      CREATE INDEX IX_aufmass_montageteams_branch_id ON aufmass_montageteams(branch_id)
    `);

    // Insert default branch (koblenz) if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM aufmass_branches WHERE slug = 'koblenz')
      INSERT INTO aufmass_branches (slug, name) VALUES ('koblenz', 'Aylux Koblenz')
    `);

    // Migrate existing montageteams with NULL branch_id to 'koblenz' (one-time migration)
    await pool.request().query(`
      UPDATE aufmass_montageteams SET branch_id = 'koblenz' WHERE branch_id IS NULL
    `);

    // ============ E-SIGNATURE TABLES ============

    // Branch settings table (for e-signature feature flags per branch)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_branch_settings' AND xtype='U')
      CREATE TABLE aufmass_branch_settings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        branch_slug NVARCHAR(50) NOT NULL UNIQUE,
        esignature_enabled BIT DEFAULT 0,
        esignature_sandbox BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    // E-Signature requests table (tracks all signature requests)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_esignature_requests' AND xtype='U')
      CREATE TABLE aufmass_esignature_requests (
        id INT IDENTITY(1,1) PRIMARY KEY,
        form_id INT NOT NULL,
        signature_type NVARCHAR(20) NOT NULL,
        openapi_signature_id NVARCHAR(100),
        status NVARCHAR(50) DEFAULT 'pending',
        signer_email NVARCHAR(255),
        signer_name NVARCHAR(255),
        signing_url NVARCHAR(500),
        signed_document VARBINARY(MAX),
        signed_at DATETIME,
        callback_received_at DATETIME,
        error_message NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (form_id) REFERENCES aufmass_forms(id) ON DELETE CASCADE
      )
    `);

    // Create index for esignature_requests
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_aufmass_esignature_requests_form_id')
      CREATE INDEX IX_aufmass_esignature_requests_form_id ON aufmass_esignature_requests(form_id)
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_aufmass_esignature_requests_openapi_id')
      CREATE INDEX IX_aufmass_esignature_requests_openapi_id ON aufmass_esignature_requests(openapi_signature_id)
    `);

    // Add provider column for dual eSignature support (OpenAPI + BoldSign)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_esignature_requests') AND name = 'provider')
      ALTER TABLE aufmass_esignature_requests ADD provider NVARCHAR(20) DEFAULT 'openapi'
    `);

    // Add BoldSign document ID column
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_esignature_requests') AND name = 'boldsign_document_id')
      ALTER TABLE aufmass_esignature_requests ADD boldsign_document_id NVARCHAR(100)
    `);

    // Add index for BoldSign document ID
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_aufmass_esignature_requests_boldsign_id')
      CREATE INDEX IX_aufmass_esignature_requests_boldsign_id ON aufmass_esignature_requests(boldsign_document_id)
    `);

    // Add esignature_provider to branch_settings (allows per-branch default provider selection)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_branch_settings') AND name = 'esignature_provider')
      ALTER TABLE aufmass_branch_settings ADD esignature_provider NVARCHAR(20) DEFAULT 'openapi'
    `);

    // Add document_type column to distinguish aufmass, abnahme signatures
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_esignature_requests') AND name = 'document_type')
      ALTER TABLE aufmass_esignature_requests ADD document_type NVARCHAR(20) DEFAULT 'aufmass'
    `);

    // Add branch_id column for branch isolation
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_esignature_requests') AND name = 'branch_id')
      ALTER TABLE aufmass_esignature_requests ADD branch_id NVARCHAR(50)
    `);

    // Add index for branch_id on esignature_requests
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_aufmass_esignature_requests_branch_id')
      CREATE INDEX IX_aufmass_esignature_requests_branch_id ON aufmass_esignature_requests(branch_id)
    `);

    // Lead price matrix table (product catalog with prices)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_lead_products' AND xtype='U')
      CREATE TABLE aufmass_lead_products (
        id INT IDENTITY(1,1) PRIMARY KEY,
        product_name NVARCHAR(255) NOT NULL,
        breite INT NOT NULL,
        tiefe INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        branch_id NVARCHAR(50),
        is_active BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Leads table (customer quotes/angebote)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_leads' AND xtype='U')
      CREATE TABLE aufmass_leads (
        id INT IDENTITY(1,1) PRIMARY KEY,
        customer_firstname NVARCHAR(100) NOT NULL,
        customer_lastname NVARCHAR(100) NOT NULL,
        customer_email NVARCHAR(255),
        customer_phone NVARCHAR(50),
        customer_address NVARCHAR(500),
        notes NVARCHAR(MAX),
        total_price DECIMAL(10,2) DEFAULT 0,
        status NVARCHAR(50) DEFAULT 'offen',
        branch_id NVARCHAR(50),
        created_by INT,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Lead items (products in a lead)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_lead_items' AND xtype='U')
      CREATE TABLE aufmass_lead_items (
        id INT IDENTITY(1,1) PRIMARY KEY,
        lead_id INT NOT NULL,
        product_id INT,
        product_name NVARCHAR(255) NOT NULL,
        breite INT,
        tiefe INT,
        quantity INT DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (lead_id) REFERENCES aufmass_leads(id) ON DELETE CASCADE
      )
    `);

    // Lead extras (additional costs)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_lead_extras' AND xtype='U')
      CREATE TABLE aufmass_lead_extras (
        id INT IDENTITY(1,1) PRIMARY KEY,
        lead_id INT NOT NULL,
        description NVARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (lead_id) REFERENCES aufmass_leads(id) ON DELETE CASCADE
      )
    `);

    // Check if admin exists, create default admin if not
    const adminCheck = await pool.request().query(
      "SELECT COUNT(*) as count FROM aufmass_users WHERE role = 'admin'"
    );

    if (adminCheck.recordset[0].count === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await pool.request()
        .input('email', sql.NVarChar, 'admin@aylux.de')
        .input('password_hash', sql.NVarChar, hashedPassword)
        .input('name', sql.NVarChar, 'Administrator')
        .input('role', sql.NVarChar, 'admin')
        .query(`
          INSERT INTO aufmass_users (email, password_hash, name, role)
          VALUES (@email, @password_hash, @name, @role)
        `);
      console.log('✅ Default admin created: admin@aylux.de / admin123');
    }

    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('❌ Table initialization failed:', err.message);
  }
}

// ============ AUTH MIDDLEWARE ============
const authenticateToken = (req, res, next) => {
  // Check Authorization header first, then query param (for direct PDF links)
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireAdminOrOffice = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'office') {
    return res.status(403).json({ error: 'Admin or Office access required' });
  }
  next();
};

// ============ BRANCH DETECTION MIDDLEWARE ============
// Detects branch from subdomain (e.g., koblenz.cnsform.com -> branchId = 'koblenz')
// Dev domains (aufmass-api.conais.com, localhost) -> branchId = null (sees all data)
const detectBranch = (req, res, next) => {
  const host = req.headers.host || '';
  const origin = req.headers.origin || '';

  // Check both host and origin for branch detection
  const hostToCheck = origin ? new URL(origin).hostname : host.split(':')[0];

  // Dev/admin domains - no branch filter (sees all)
  const devDomains = ['localhost', 'aufmass-api.conais.com', 'aufmass-app.vercel.app'];
  if (devDomains.some(d => hostToCheck.includes(d))) {
    req.branchId = null;
    return next();
  }

  // Branch domains: {branch}.cnsform.com
  const cnsformMatch = hostToCheck.match(/^([a-z0-9-]+)\.cnsform\.com$/i);
  if (cnsformMatch) {
    req.branchId = cnsformMatch[1].toLowerCase();
    return next();
  }

  // Default: no branch filter
  req.branchId = null;
  next();
};

// Apply branch detection to all API routes
app.use('/api', detectBranch);

// ============ AUTH ROUTES ============

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Branch-specific login: allow users from the same branch OR global users (branch_id IS NULL)
    const branchFilter = req.branchId ? 'AND (branch_id = @branch_id OR branch_id IS NULL)' : '';
    const request = pool.request()
      .input('email', sql.NVarChar, email.toLowerCase());

    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }

    const result = await request.query(`SELECT * FROM aufmass_users WHERE email = @email AND is_active = 1 ${branchFilter}`);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.recordset[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.request()
      .input('id', sql.Int, user.id)
      .query('UPDATE aufmass_users SET last_login = GETDATE() WHERE id = @id');

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT id, email, name, role, created_at, last_login FROM aufmass_users WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Change password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT password_hash FROM aufmass_users WHERE id = @id');

    const validPassword = await bcrypt.compare(currentPassword, result.recordset[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.request()
      .input('id', sql.Int, req.user.id)
      .input('password_hash', sql.NVarChar, hashedPassword)
      .query('UPDATE aufmass_users SET password_hash = @password_hash, updated_at = GETDATE() WHERE id = @id');

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ============ USER MANAGEMENT (Admin only) ============

// Get all users (branch filtered)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const branchFilter = req.branchId ? 'WHERE branch_id = @branch_id' : '';
    const request = pool.request();
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    const result = await request.query(`
      SELECT id, email, name, role, is_active, last_login, created_at, branch_id
      FROM aufmass_users
      ${branchFilter}
      ORDER BY created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create invitation (with branch_id)
app.post('/api/invitations', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Branch subdomain required for creating invitations
    if (!req.branchId) {
      return res.status(400).json({ error: 'Invitations can only be created from branch subdomains' });
    }

    // Check if user already exists in this branch
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .input('branch_id', sql.NVarChar, req.branchId)
      .query('SELECT id FROM aufmass_users WHERE email = @email AND branch_id = @branch_id');

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists in this branch' });
    }

    // Check for existing valid invitation in this branch
    const existingInvite = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .input('branch_id', sql.NVarChar, req.branchId)
      .query('SELECT id FROM aufmass_invitations WHERE email = @email AND branch_id = @branch_id AND used_at IS NULL AND expires_at > GETDATE()');

    if (existingInvite.recordset.length > 0) {
      return res.status(400).json({ error: 'Valid invitation already exists for this email' });
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days validity

    await pool.request()
      .input('token', sql.NVarChar, token)
      .input('email', sql.NVarChar, email.toLowerCase())
      .input('role', sql.NVarChar, role || 'user')
      .input('invited_by', sql.Int, req.user.id)
      .input('expires_at', sql.DateTime, expiresAt)
      .input('branch_id', sql.NVarChar, req.branchId)
      .query(`
        INSERT INTO aufmass_invitations (token, email, role, invited_by, expires_at, branch_id)
        VALUES (@token, @email, @role, @invited_by, @expires_at, @branch_id)
      `);

    res.json({
      message: 'Invitation created',
      inviteLink: `/register?token=${token}`,
      token,
      expiresAt
    });
  } catch (err) {
    console.error('Create invitation error:', err);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// Get all invitations (branch filtered)
app.get('/api/invitations', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const branchFilter = req.branchId ? 'WHERE i.branch_id = @branch_id' : '';
    const request = pool.request();
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    const result = await request.query(`
      SELECT i.*, u.name as invited_by_name
      FROM aufmass_invitations i
      LEFT JOIN aufmass_users u ON i.invited_by = u.id
      ${branchFilter}
      ORDER BY i.created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get invitations error:', err);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Delete invitation (branch filtered)
app.delete('/api/invitations/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';
    const request = pool.request().input('id', sql.Int, req.params.id);
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    await request.query(`DELETE FROM aufmass_invitations WHERE id = @id ${branchFilter}`);
    res.json({ message: 'Invitation deleted' });
  } catch (err) {
    console.error('Delete invitation error:', err);
    res.status(500).json({ error: 'Failed to delete invitation' });
  }
});

// Register with invitation token
app.post('/api/auth/register', async (req, res) => {
  try {
    const { token, name, password } = req.body;

    if (!token || !name || !password) {
      return res.status(400).json({ error: 'Token, name and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Find valid invitation
    const invitation = await pool.request()
      .input('token', sql.NVarChar, token)
      .query(`
        SELECT * FROM aufmass_invitations
        WHERE token = @token AND used_at IS NULL AND expires_at > GETDATE()
      `);

    if (invitation.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const invite = invitation.recordset[0];

    // Create user with branch_id from invitation
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.request()
      .input('email', sql.NVarChar, invite.email)
      .input('password_hash', sql.NVarChar, hashedPassword)
      .input('name', sql.NVarChar, name)
      .input('role', sql.NVarChar, invite.role)
      .input('branch_id', sql.NVarChar, invite.branch_id || null)
      .query(`
        INSERT INTO aufmass_users (email, password_hash, name, role, branch_id)
        OUTPUT INSERTED.id
        VALUES (@email, @password_hash, @name, @role, @branch_id)
      `);

    // Mark invitation as used
    await pool.request()
      .input('id', sql.Int, invite.id)
      .query('UPDATE aufmass_invitations SET used_at = GETDATE() WHERE id = @id');

    const userId = result.recordset[0].id;
    const jwtToken = jwt.sign(
      { id: userId, email: invite.email, name, role: invite.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Registration successful',
      token: jwtToken,
      user: {
        id: userId,
        email: invite.email,
        name,
        role: invite.role
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify invitation token
app.get('/api/auth/verify-invite/:token', async (req, res) => {
  try {
    const result = await pool.request()
      .input('token', sql.NVarChar, req.params.token)
      .query(`
        SELECT email, role, expires_at FROM aufmass_invitations
        WHERE token = @token AND used_at IS NULL AND expires_at > GETDATE()
      `);

    if (result.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Verify invite error:', err);
    res.status(500).json({ error: 'Failed to verify invitation' });
  }
});

// Update user (Admin only, branch filtered)
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, role, is_active } = req.body;
    const userId = parseInt(req.params.id);
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';

    // Prevent admin from deactivating themselves
    if (userId === req.user.id && is_active === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const request = pool.request()
      .input('id', sql.Int, userId)
      .input('name', sql.NVarChar, name)
      .input('role', sql.NVarChar, role)
      .input('is_active', sql.Bit, is_active);

    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }

    await request.query(`
      UPDATE aufmass_users SET
        name = @name,
        role = @role,
        is_active = @is_active,
        updated_at = GETDATE()
      WHERE id = @id ${branchFilter}
    `);

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (Admin only, branch filtered)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const request = pool.request().input('id', sql.Int, userId);
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    await request.query(`DELETE FROM aufmass_users WHERE id = @id ${branchFilter}`);

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ============ API ROUTES (Protected) ============

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Get current branch info (from subdomain)
app.get('/api/branch', async (req, res) => {
  try {
    if (!req.branchId) {
      return res.json({ branch: null, name: 'Development', isDevMode: true });
    }

    const result = await pool.request()
      .input('slug', sql.NVarChar, req.branchId)
      .query('SELECT * FROM aufmass_branches WHERE slug = @slug AND is_active = 1');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    res.json({ branch: result.recordset[0], isDevMode: false });
  } catch (err) {
    console.error('Error fetching branch:', err);
    res.status(500).json({ error: 'Failed to fetch branch info' });
  }
});

// Get all branches (admin only)
app.get('/api/branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.request().query('SELECT * FROM aufmass_branches ORDER BY name');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching branches:', err);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// Get all forms
app.get('/api/forms', authenticateToken, async (req, res) => {
  try {
    // Auto-delete forms in Papierkorb older than 30 days
    await pool.request().query(`
      DELETE FROM aufmass_forms
      WHERE status = 'papierkorb'
      AND papierkorb_date IS NOT NULL
      AND DATEDIFF(day, papierkorb_date, GETDATE()) > 30
    `);

    // Build query with optional branch filter
    const branchFilter = req.branchId ? 'WHERE f.branch_id = @branch_id' : '';
    const request = pool.request();
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }

    // Explicitly select columns EXCLUDING generated_pdf (VARBINARY) to avoid loading huge binary data
    const result = await request.query(`
      SELECT
        f.id, f.datum, f.aufmasser, f.kunde_vorname, f.kunde_nachname, f.kunde_email, f.kunde_telefon,
        f.kundenlokation, f.category, f.product_type, f.model, f.specifications,
        f.markise_data, f.bemerkungen, f.status, f.created_by, f.created_at, f.updated_at,
        f.montage_datum, f.status_date, f.pdf_generated_at, f.branch_id, f.papierkorb_date, f.lead_id,
        (SELECT COUNT(*) FROM aufmass_bilder WHERE form_id = f.id AND file_type LIKE 'image/%') as image_count,
        (SELECT COUNT(*) FROM aufmass_bilder WHERE form_id = f.id AND (file_type = 'application/pdf' OR file_name LIKE '%.pdf')) as pdf_count
      FROM aufmass_forms f
      ${branchFilter}
      ORDER BY f.created_at DESC
    `);

    // Batch fetch all bilder metadata in ONE query instead of N+1
    const formIds = result.recordset.map(f => f.id);
    let bilderMap = {};
    if (formIds.length > 0) {
      const bilderRequest = pool.request();
      if (req.branchId) {
        bilderRequest.input('branch_id', sql.NVarChar, req.branchId);
      }
      const bilderResult = await bilderRequest.query(`
        SELECT b.id, b.form_id, b.file_name, b.file_type
        FROM aufmass_bilder b
        INNER JOIN aufmass_forms f ON b.form_id = f.id
        ${req.branchId ? 'WHERE f.branch_id = @branch_id' : ''}
      `);

      // Group by form_id
      bilderMap = {};
      for (const bild of bilderResult.recordset) {
        if (!bilderMap[bild.form_id]) {
          bilderMap[bild.form_id] = [];
        }
        bilderMap[bild.form_id].push(bild);
      }
    }

    // Map bilder to forms
    const formsWithFiles = result.recordset.map(form => {
      const allBilder = bilderMap[form.id] || [];
      return {
        ...form,
        pdf_files: allBilder.filter(b => b.file_type === 'application/pdf' || b.file_name.endsWith('.pdf')),
        media_files: allBilder.filter(b => b.file_type.startsWith('image/') || b.file_type.startsWith('video/'))
      };
    });

    res.json(formsWithFiles);
  } catch (err) {
    console.error('Error fetching forms:', err);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// Get single form by ID (branch filtered)
app.get('/api/forms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Branch filter for isolation
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';
    const request = pool.request().input('id', sql.Int, id);
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    const result = await request.query(`
      SELECT id, datum, aufmasser, kunde_vorname, kunde_nachname, kunde_email, kunde_telefon,
      kundenlokation, category, product_type, model, specifications,
      markise_data, bemerkungen, status, created_by, created_at, updated_at,
      montage_datum, status_date, pdf_generated_at
      FROM aufmass_forms WHERE id = @id ${branchFilter}
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Get images for this form
    const images = await pool.request()
      .input('form_id', sql.Int, id)
      .query('SELECT id, file_name, file_type FROM aufmass_bilder WHERE form_id = @form_id');

    // Get additional products for this form
    const produkte = await pool.request()
      .input('form_id', sql.Int, id)
      .query('SELECT * FROM aufmass_form_produkte WHERE form_id = @form_id ORDER BY sort_order');

    // Transform produkte to match frontend format
    const transformedProdukte = produkte.recordset.map(p => ({
      id: String(p.id),
      category: p.category,
      productType: p.product_type,
      model: p.model,
      specifications: typeof p.specifications === 'string' ? JSON.parse(p.specifications) : (p.specifications || {})
    }));

    res.json({
      ...result.recordset[0],
      bilder: images.recordset,
      weitereProdukte: transformedProdukte
    });
  } catch (err) {
    console.error('Error fetching form:', err);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// Create new form
app.post('/api/forms', authenticateToken, async (req, res) => {
  try {
    const {
      datum,
      aufmasser,
      kundeVorname,
      kundeNachname,
      kundeEmail,
      kundeTelefon,
      kundenlokation,
      category,
      productType,
      model,
      specifications,
      markiseData,
      bemerkungen,
      status,
      weitereProdukte,
      leadId
    } = req.body;

    // Auto-set status_date to form datum (Aufmaß date) when form is created
    // Set branch_id from subdomain detection
    const result = await pool.request()
      .input('datum', sql.Date, datum)
      .input('aufmasser', sql.NVarChar, aufmasser)
      .input('kunde_vorname', sql.NVarChar, kundeVorname)
      .input('kunde_nachname', sql.NVarChar, kundeNachname)
      .input('kunde_email', sql.NVarChar, kundeEmail || null)
      .input('kunde_telefon', sql.NVarChar, kundeTelefon || null)
      .input('kundenlokation', sql.NVarChar, kundenlokation)
      .input('category', sql.NVarChar, category)
      .input('product_type', sql.NVarChar, productType)
      .input('model', sql.NVarChar, model)
      .input('specifications', sql.NVarChar, JSON.stringify(specifications || {}))
      .input('markise_data', sql.NVarChar, JSON.stringify(markiseData || null))
      .input('bemerkungen', sql.NVarChar, bemerkungen || '')
      .input('status', sql.NVarChar, status || 'neu')
      .input('status_date', sql.Date, datum)
      .input('branch_id', sql.NVarChar, req.branchId || null)
      .input('created_by', sql.Int, req.user.id)
      .input('lead_id', sql.Int, leadId || null)
      .query(`
        INSERT INTO aufmass_forms
        (datum, aufmasser, kunde_vorname, kunde_nachname, kunde_email, kunde_telefon, kundenlokation, category, product_type, model, specifications, markise_data, bemerkungen, status, status_date, branch_id, created_by, lead_id)
        OUTPUT INSERTED.id
        VALUES (@datum, @aufmasser, @kunde_vorname, @kunde_nachname, @kunde_email, @kunde_telefon, @kundenlokation, @category, @product_type, @model, @specifications, @markise_data, @bemerkungen, @status, @status_date, @branch_id, @created_by, @lead_id)
      `);

    const newId = result.recordset[0].id;

    // Insert additional products if provided
    if (weitereProdukte && Array.isArray(weitereProdukte) && weitereProdukte.length > 0) {
      for (let i = 0; i < weitereProdukte.length; i++) {
        const produkt = weitereProdukte[i];
        await pool.request()
          .input('form_id', sql.Int, newId)
          .input('sort_order', sql.Int, i + 1)
          .input('category', sql.NVarChar, produkt.category)
          .input('product_type', sql.NVarChar, produkt.productType)
          .input('model', sql.NVarChar, produkt.model)
          .input('specifications', sql.NVarChar, JSON.stringify(produkt.specifications || {}))
          .query(`
            INSERT INTO aufmass_form_produkte (form_id, sort_order, category, product_type, model, specifications)
            VALUES (@form_id, @sort_order, @category, @product_type, @model, @specifications)
          `);
      }
    }

    res.status(201).json({ id: newId, message: 'Form created successfully' });
  } catch (err) {
    console.error('Error creating form:', err);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

// Update form (supports partial updates, branch filtered)
app.put('/api/forms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Branch filter for isolation
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';

    // Build dynamic update query based on provided fields
    const fieldMappings = {
      datum: { column: 'datum', type: sql.Date },
      aufmasser: { column: 'aufmasser', type: sql.NVarChar },
      kundeVorname: { column: 'kunde_vorname', type: sql.NVarChar },
      kundeNachname: { column: 'kunde_nachname', type: sql.NVarChar },
      kundeEmail: { column: 'kunde_email', type: sql.NVarChar },
      kundeTelefon: { column: 'kunde_telefon', type: sql.NVarChar },
      kundenlokation: { column: 'kundenlokation', type: sql.NVarChar },
      category: { column: 'category', type: sql.NVarChar },
      productType: { column: 'product_type', type: sql.NVarChar },
      model: { column: 'model', type: sql.NVarChar },
      specifications: { column: 'specifications', type: sql.NVarChar, transform: v => JSON.stringify(v || {}) },
      markiseData: { column: 'markise_data', type: sql.NVarChar, transform: v => JSON.stringify(v || null) },
      bemerkungen: { column: 'bemerkungen', type: sql.NVarChar },
      status: { column: 'status', type: sql.NVarChar },
      montageDatum: { column: 'montage_datum', type: sql.Date },
      statusDate: { column: 'status_date', type: sql.Date },
      papierkorbDate: { column: 'papierkorb_date', type: sql.Date }
    };

    // Auto-set papierkorb_date when moving to trash, clear when restoring
    if (updates.status === 'papierkorb') {
      updates.papierkorbDate = new Date().toISOString().split('T')[0];
    } else if (updates.status && updates.status !== 'papierkorb') {
      updates.papierkorbDate = null;
    }

    const setClauses = [];
    const request = pool.request().input('id', sql.Int, id);
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }

    for (const [key, mapping] of Object.entries(fieldMappings)) {
      if (updates[key] !== undefined) {
        const value = mapping.transform ? mapping.transform(updates[key]) : updates[key];
        request.input(mapping.column, mapping.type, value);
        setClauses.push(`${mapping.column} = @${mapping.column}`);
      }
    }

    // Handle weitereProdukte separately
    if (updates.weitereProdukte !== undefined) {
      // Delete existing products and re-insert
      await pool.request()
        .input('form_id', sql.Int, id)
        .query('DELETE FROM aufmass_form_produkte WHERE form_id = @form_id');

      if (Array.isArray(updates.weitereProdukte) && updates.weitereProdukte.length > 0) {
        for (let i = 0; i < updates.weitereProdukte.length; i++) {
          const produkt = updates.weitereProdukte[i];
          await pool.request()
            .input('form_id', sql.Int, id)
            .input('sort_order', sql.Int, i + 1)
            .input('category', sql.NVarChar, produkt.category)
            .input('product_type', sql.NVarChar, produkt.productType)
            .input('model', sql.NVarChar, produkt.model)
            .input('specifications', sql.NVarChar, JSON.stringify(produkt.specifications || {}))
            .query(`
              INSERT INTO aufmass_form_produkte (form_id, sort_order, category, product_type, model, specifications)
              VALUES (@form_id, @sort_order, @category, @product_type, @model, @specifications)
            `);
        }
      }
    }

    if (setClauses.length === 0 && updates.weitereProdukte === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (setClauses.length > 0) {
      setClauses.push('updated_at = GETDATE()');
      await request.query(`
        UPDATE aufmass_forms SET ${setClauses.join(', ')} WHERE id = @id ${branchFilter}
      `);

      // If status was changed, add to status history
      if (updates.status !== undefined) {
        await pool.request()
          .input('form_id', sql.Int, id)
          .input('status', sql.NVarChar, updates.status)
          .input('changed_by', sql.Int, req.user?.id || null)
          .input('status_date', sql.Date, updates.statusDate || null)
          .input('notes', sql.NVarChar, updates.statusNotes || null)
          .query(`
            INSERT INTO aufmass_status_history (form_id, status, changed_by, status_date, notes)
            VALUES (@form_id, @status, @changed_by, @status_date, @notes)
          `);
      }
    }

    // Delete stored PDF so next preview generates fresh one
    const pdfPath = path.join(PDF_DIR, `${id}.pdf`);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    res.json({ message: 'Form updated successfully' });
  } catch (err) {
    console.error('Error updating form:', err);
    res.status(500).json({ error: 'Failed to update form' });
  }
});

// Delete form (branch filtered)
app.delete('/api/forms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';
    const request = pool.request().input('id', sql.Int, id);
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    await request.query(`DELETE FROM aufmass_forms WHERE id = @id ${branchFilter}`);

    res.json({ message: 'Form deleted successfully' });
  } catch (err) {
    console.error('Error deleting form:', err);
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

// ============ PDF STORAGE ENDPOINTS ============

// PDF storage directory
const PDF_DIR = '/var/www/aufmass-pdfs';

// Ensure PDF directory exists
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

// Save generated PDF for a form (to filesystem - much faster than database)
app.post('/api/forms/:id/pdf', authenticateToken, upload.single('pdf'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    // Save PDF to filesystem
    const pdfPath = path.join(PDF_DIR, `${id}.pdf`);
    fs.writeFileSync(pdfPath, req.file.buffer);

    // Update database - save PDF binary and mark as generated (non-blocking)
    // Filesystem is the primary storage, DB is secondary for e-signature
    const dbRequest = pool.request();
    dbRequest.timeout = 60000;
    dbRequest.input('id', sql.Int, id);
    dbRequest.input('pdfData', sql.VarBinary(sql.MAX), req.file.buffer);
    dbRequest.query(`
        UPDATE aufmass_forms
        SET generated_pdf = @pdfData, pdf_generated_at = GETDATE(), updated_at = GETDATE()
        WHERE id = @id
      `)
      .catch(dbErr => console.error('DB PDF save failed (filesystem copy exists):', dbErr.message));

    res.json({ message: 'PDF saved successfully' });
  } catch (err) {
    console.error('Error saving PDF:', err);
    res.status(500).json({ error: 'Failed to save PDF' });
  }
});

// Get generated PDF for a form (from filesystem - very fast)
app.get('/api/forms/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const pdfPath = path.join(PDF_DIR, `${id}.pdf`);

    // Check if PDF file exists
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'No PDF generated for this form', needsGeneration: true });
    }

    // Get file stats for headers
    const stats = fs.statSync(pdfPath);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="aufmass_${id}.pdf"`,
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });

    // Stream file directly - very fast
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error getting PDF:', err);
    res.status(500).json({ error: 'Failed to get PDF' });
  }
});

// Check if PDF exists for a form
app.get('/api/forms/:id/pdf/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const pdfPath = path.join(PDF_DIR, `${id}.pdf`);

    // Check filesystem for PDF
    const hasPdf = fs.existsSync(pdfPath);
    let pdfGeneratedAt = null;
    let isOutdated = false;

    if (hasPdf) {
      const stats = fs.statSync(pdfPath);
      pdfGeneratedAt = stats.mtime.toISOString();

      // Check if form was updated after PDF was generated
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT updated_at FROM aufmass_forms WHERE id = @id');

      if (result.recordset.length > 0) {
        const { updated_at } = result.recordset[0];
        isOutdated = updated_at && new Date(updated_at) > stats.mtime;
      }
    }

    res.json({
      hasPdf,
      pdfGeneratedAt: pdfGeneratedAt,
      isOutdated,
      needsRegeneration: !hasPdf || isOutdated
    });
  } catch (err) {
    console.error('Error checking PDF status:', err);
    res.status(500).json({ error: 'Failed to check PDF status' });
  }
});

// ============ STATUS HISTORY ENDPOINTS ============

// Get status history for a form
app.get('/api/forms/:id/status-history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.request()
      .input('form_id', sql.Int, id)
      .query(`
        SELECT sh.*, u.name as changed_by_name
        FROM aufmass_status_history sh
        LEFT JOIN aufmass_users u ON sh.changed_by = u.id
        WHERE sh.form_id = @form_id
        ORDER BY sh.changed_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error getting status history:', err);
    res.status(500).json({ error: 'Failed to get status history' });
  }
});

// ============ ABNAHME ENDPOINTS ============

// Get abnahme data for a form
app.get('/api/forms/:id/abnahme', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.request()
      .input('form_id', sql.Int, id)
      .query('SELECT * FROM aufmass_abnahme WHERE form_id = @form_id');

    if (result.recordset.length === 0) {
      return res.json(null);
    }

    const abnahme = result.recordset[0];
    res.json({
      id: abnahme.id,
      formId: abnahme.form_id,
      istFertig: abnahme.ist_fertig,
      hatProbleme: abnahme.hat_probleme,
      problemBeschreibung: abnahme.problem_beschreibung,
      maengelListe: abnahme.maengel_liste ? JSON.parse(abnahme.maengel_liste) : [],
      baustelleSauber: abnahme.baustelle_sauber,
      monteurNote: abnahme.monteur_note,
      kundeName: abnahme.kunde_name,
      kundeUnterschrift: abnahme.kunde_unterschrift,
      abnahmeDatum: abnahme.abnahme_datum,
      bemerkungen: abnahme.bemerkungen,
      createdAt: abnahme.created_at,
      updatedAt: abnahme.updated_at
    });
  } catch (err) {
    console.error('Error getting abnahme:', err);
    res.status(500).json({ error: 'Failed to get abnahme data' });
  }
});

// Create or update abnahme data
app.post('/api/forms/:id/abnahme', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { istFertig, hatProbleme, problemBeschreibung, maengelListe, baustelleSauber, monteurNote, kundeName, kundeUnterschrift, bemerkungen } = req.body;

    // Serialize maengelListe to JSON
    const maengelListeJson = maengelListe ? JSON.stringify(maengelListe) : null;

    // Check if abnahme already exists
    const existing = await pool.request()
      .input('form_id', sql.Int, id)
      .query('SELECT id FROM aufmass_abnahme WHERE form_id = @form_id');

    if (existing.recordset.length > 0) {
      // Update existing
      await pool.request()
        .input('form_id', sql.Int, id)
        .input('ist_fertig', sql.Bit, istFertig ? 1 : 0)
        .input('hat_probleme', sql.Bit, hatProbleme ? 1 : 0)
        .input('problem_beschreibung', sql.NVarChar, problemBeschreibung || null)
        .input('maengel_liste', sql.NVarChar, maengelListeJson)
        .input('baustelle_sauber', sql.NVarChar, baustelleSauber || null)
        .input('monteur_note', sql.Int, monteurNote || null)
        .input('kunde_name', sql.NVarChar, kundeName || null)
        .input('kunde_unterschrift', sql.Bit, kundeUnterschrift ? 1 : 0)
        .input('abnahme_datum', sql.DateTime, new Date())
        .input('bemerkungen', sql.NVarChar, bemerkungen || null)
        .query(`
          UPDATE aufmass_abnahme SET
            ist_fertig = @ist_fertig,
            hat_probleme = @hat_probleme,
            problem_beschreibung = @problem_beschreibung,
            maengel_liste = @maengel_liste,
            baustelle_sauber = @baustelle_sauber,
            monteur_note = @monteur_note,
            kunde_name = @kunde_name,
            kunde_unterschrift = @kunde_unterschrift,
            abnahme_datum = @abnahme_datum,
            bemerkungen = @bemerkungen,
            updated_at = GETDATE()
          WHERE form_id = @form_id
        `);
    } else {
      // Create new
      await pool.request()
        .input('form_id', sql.Int, id)
        .input('ist_fertig', sql.Bit, istFertig ? 1 : 0)
        .input('hat_probleme', sql.Bit, hatProbleme ? 1 : 0)
        .input('problem_beschreibung', sql.NVarChar, problemBeschreibung || null)
        .input('maengel_liste', sql.NVarChar, maengelListeJson)
        .input('baustelle_sauber', sql.NVarChar, baustelleSauber || null)
        .input('monteur_note', sql.Int, monteurNote || null)
        .input('kunde_name', sql.NVarChar, kundeName || null)
        .input('kunde_unterschrift', sql.Bit, kundeUnterschrift ? 1 : 0)
        .input('abnahme_datum', sql.DateTime, new Date())
        .input('bemerkungen', sql.NVarChar, bemerkungen || null)
        .query(`
          INSERT INTO aufmass_abnahme (form_id, ist_fertig, hat_probleme, problem_beschreibung, maengel_liste, baustelle_sauber, monteur_note, kunde_name, kunde_unterschrift, abnahme_datum, bemerkungen)
          VALUES (@form_id, @ist_fertig, @hat_probleme, @problem_beschreibung, @maengel_liste, @baustelle_sauber, @monteur_note, @kunde_name, @kunde_unterschrift, @abnahme_datum, @bemerkungen)
        `);
    }

    // Delete stored PDF so next preview generates fresh one with abnahme data
    const pdfPath = path.join(PDF_DIR, `${id}.pdf`);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    res.json({ message: 'Abnahme saved successfully' });
  } catch (err) {
    console.error('Error saving abnahme:', err);
    res.status(500).json({ error: 'Failed to save abnahme data' });
  }
});

// Upload images for a form
app.post('/api/forms/:id/images', authenticateToken, upload.array('images', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    for (const file of files) {
      await pool.request()
        .input('form_id', sql.Int, id)
        .input('file_name', sql.NVarChar, file.originalname)
        .input('file_data', sql.VarBinary, file.buffer)
        .input('file_type', sql.NVarChar, file.mimetype)
        .query(`
          INSERT INTO aufmass_bilder (form_id, file_name, file_data, file_type)
          VALUES (@form_id, @file_name, @file_data, @file_type)
        `);
    }

    res.json({ message: `${files.length} images uploaded successfully` });
  } catch (err) {
    console.error('Error uploading images:', err);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Upload Mängel/Abnahme images for a form
app.post('/api/forms/:id/abnahme-images', authenticateToken, upload.array('images', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    for (const file of files) {
      await pool.request()
        .input('form_id', sql.Int, id)
        .input('file_name', sql.NVarChar, file.originalname)
        .input('file_data', sql.VarBinary, file.buffer)
        .input('file_type', sql.NVarChar, file.mimetype)
        .query(`
          INSERT INTO aufmass_abnahme_bilder (form_id, file_name, file_data, file_type)
          VALUES (@form_id, @file_name, @file_data, @file_type)
        `);
    }

    res.json({ message: `${files.length} Mängel images uploaded successfully` });
  } catch (err) {
    console.error('Error uploading Mängel images:', err);
    res.status(500).json({ error: 'Failed to upload Mängel images' });
  }
});

// Get Mängel/Abnahme images for a form
app.get('/api/forms/:id/abnahme-images', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.request()
      .input('form_id', sql.Int, id)
      .query('SELECT id, file_name, file_type, created_at FROM aufmass_abnahme_bilder WHERE form_id = @form_id ORDER BY created_at');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error getting Mängel images:', err);
    res.status(500).json({ error: 'Failed to get Mängel images' });
  }
});

// Get single Mängel image data
app.get('/api/abnahme-images/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT file_data, file_type, file_name FROM aufmass_abnahme_bilder WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const image = result.recordset[0];
    res.setHeader('Content-Type', image.file_type);
    res.setHeader('Content-Disposition', `inline; filename="${image.file_name}"`);
    res.send(image.file_data);
  } catch (err) {
    console.error('Error getting Mängel image:', err);
    res.status(500).json({ error: 'Failed to get image' });
  }
});

// Delete Mängel image
app.delete('/api/abnahme-images/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM aufmass_abnahme_bilder WHERE id = @id');

    res.json({ message: 'Image deleted successfully' });
  } catch (err) {
    console.error('Error deleting Mängel image:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ============ ANGEBOT (QUOTE) ENDPOINTS ============

// Get Angebot data for a form
app.get('/api/forms/:id/angebot', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get angebot summary
    const summaryResult = await pool.request()
      .input('form_id', sql.Int, id)
      .query('SELECT * FROM aufmass_angebot WHERE form_id = @form_id');

    // Get angebot items
    const itemsResult = await pool.request()
      .input('form_id', sql.Int, id)
      .query('SELECT * FROM aufmass_angebot_items WHERE form_id = @form_id ORDER BY sort_order, id');

    res.json({
      summary: summaryResult.recordset[0] || null,
      items: itemsResult.recordset
    });
  } catch (err) {
    console.error('Error fetching Angebot:', err);
    res.status(500).json({ error: 'Failed to fetch Angebot data' });
  }
});

// Save/Update Angebot data
app.post('/api/forms/:id/angebot', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, angebot_datum, bemerkungen, mwst_satz = 19 } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Validate items
    for (const item of items) {
      if (!item.bezeichnung || item.bezeichnung.trim() === '') {
        return res.status(400).json({ error: 'Bezeichnung is required for all items' });
      }
      if (!item.menge || item.menge <= 0) {
        return res.status(400).json({ error: 'Menge must be greater than 0' });
      }
      if (item.einzelpreis === undefined || item.einzelpreis < 0) {
        return res.status(400).json({ error: 'Einzelpreis is required for all items' });
      }
    }

    // Calculate totals
    const netto_summe = items.reduce((sum, item) => {
      const gesamtpreis = (parseFloat(item.menge) || 0) * (parseFloat(item.einzelpreis) || 0);
      return sum + gesamtpreis;
    }, 0);
    const mwst_betrag = netto_summe * (mwst_satz / 100);
    const brutto_summe = netto_summe + mwst_betrag;

    // Delete existing items
    await pool.request()
      .input('form_id', sql.Int, id)
      .query('DELETE FROM aufmass_angebot_items WHERE form_id = @form_id');

    // Insert new items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const gesamtpreis = (parseFloat(item.menge) || 0) * (parseFloat(item.einzelpreis) || 0);

      await pool.request()
        .input('form_id', sql.Int, id)
        .input('bezeichnung', sql.NVarChar, item.bezeichnung)
        .input('menge', sql.Decimal(10, 2), parseFloat(item.menge) || 1)
        .input('einzelpreis', sql.Decimal(10, 2), parseFloat(item.einzelpreis) || 0)
        .input('gesamtpreis', sql.Decimal(10, 2), gesamtpreis)
        .input('sort_order', sql.Int, i)
        .query(`
          INSERT INTO aufmass_angebot_items (form_id, bezeichnung, menge, einzelpreis, gesamtpreis, sort_order)
          VALUES (@form_id, @bezeichnung, @menge, @einzelpreis, @gesamtpreis, @sort_order)
        `);
    }

    // Upsert angebot summary
    const existingResult = await pool.request()
      .input('form_id', sql.Int, id)
      .query('SELECT id FROM aufmass_angebot WHERE form_id = @form_id');

    if (existingResult.recordset.length > 0) {
      await pool.request()
        .input('form_id', sql.Int, id)
        .input('netto_summe', sql.Decimal(10, 2), netto_summe)
        .input('mwst_satz', sql.Decimal(5, 2), mwst_satz)
        .input('mwst_betrag', sql.Decimal(10, 2), mwst_betrag)
        .input('brutto_summe', sql.Decimal(10, 2), brutto_summe)
        .input('angebot_datum', sql.DateTime, angebot_datum ? new Date(angebot_datum) : new Date())
        .input('bemerkungen', sql.NVarChar, bemerkungen || null)
        .query(`
          UPDATE aufmass_angebot
          SET netto_summe = @netto_summe, mwst_satz = @mwst_satz, mwst_betrag = @mwst_betrag,
              brutto_summe = @brutto_summe, angebot_datum = @angebot_datum, bemerkungen = @bemerkungen,
              updated_at = GETDATE()
          WHERE form_id = @form_id
        `);
    } else {
      await pool.request()
        .input('form_id', sql.Int, id)
        .input('netto_summe', sql.Decimal(10, 2), netto_summe)
        .input('mwst_satz', sql.Decimal(5, 2), mwst_satz)
        .input('mwst_betrag', sql.Decimal(10, 2), mwst_betrag)
        .input('brutto_summe', sql.Decimal(10, 2), brutto_summe)
        .input('angebot_datum', sql.DateTime, angebot_datum ? new Date(angebot_datum) : new Date())
        .input('bemerkungen', sql.NVarChar, bemerkungen || null)
        .query(`
          INSERT INTO aufmass_angebot (form_id, netto_summe, mwst_satz, mwst_betrag, brutto_summe, angebot_datum, bemerkungen)
          VALUES (@form_id, @netto_summe, @mwst_satz, @mwst_betrag, @brutto_summe, @angebot_datum, @bemerkungen)
        `);
    }

    res.json({
      message: 'Angebot saved successfully',
      summary: {
        netto_summe,
        mwst_satz,
        mwst_betrag,
        brutto_summe
      }
    });
  } catch (err) {
    console.error('Error saving Angebot:', err);
    res.status(500).json({ error: 'Failed to save Angebot data' });
  }
});

// Upload temporary file (for PDF links in exported PDF)
app.post('/api/upload-temp', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Create temp_files table if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aufmass_temp_files' AND xtype='U')
      CREATE TABLE aufmass_temp_files (
        id INT IDENTITY(1,1) PRIMARY KEY,
        file_name NVARCHAR(255) NOT NULL,
        file_data VARBINARY(MAX) NOT NULL,
        file_type NVARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Insert file and get ID
    const result = await pool.request()
      .input('file_name', sql.NVarChar, file.originalname)
      .input('file_data', sql.VarBinary, file.buffer)
      .input('file_type', sql.NVarChar, file.mimetype)
      .query(`
        INSERT INTO aufmass_temp_files (file_name, file_data, file_type)
        OUTPUT INSERTED.id
        VALUES (@file_name, @file_data, @file_type)
      `);

    const fileId = result.recordset[0].id;
    const fileUrl = `${req.protocol}://${req.get('host')}/api/files/${fileId}`;

    res.json({ id: fileId, url: fileUrl, fileName: file.originalname });
  } catch (err) {
    console.error('Error uploading temp file:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get temp file by ID (public)
app.get('/api/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT file_data, file_type, file_name FROM aufmass_temp_files WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.recordset[0];
    res.set('Content-Type', file.file_type);
    res.set('Content-Disposition', `inline; filename="${file.file_name}"`);
    res.send(file.file_data);
  } catch (err) {
    console.error('Error fetching file:', err);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// Get image by ID (public - for displaying images)
app.get('/api/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT file_data, file_type, file_name FROM aufmass_bilder WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const image = result.recordset[0];
    res.set('Content-Type', image.file_type);
    res.set('Content-Disposition', `inline; filename="${image.file_name}"`);
    res.send(image.file_data);
  } catch (err) {
    console.error('Error fetching image:', err);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Delete image
app.delete('/api/images/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM aufmass_bilder WHERE id = @id');

    res.json({ message: 'Image deleted successfully' });
  } catch (err) {
    console.error('Error deleting image:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Get dashboard stats
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    // Build branch filter
    const branchFilter = req.branchId ? 'WHERE branch_id = @branch_id' : '';
    const branchFilterAnd = req.branchId ? 'AND branch_id = @branch_id' : '';

    const totalReq = pool.request();
    const completedReq = pool.request();
    const draftReq = pool.request();

    if (req.branchId) {
      totalReq.input('branch_id', sql.NVarChar, req.branchId);
      completedReq.input('branch_id', sql.NVarChar, req.branchId);
      draftReq.input('branch_id', sql.NVarChar, req.branchId);
    }

    const total = await totalReq.query(`SELECT COUNT(*) as count FROM aufmass_forms ${branchFilter}`);
    const completed = await completedReq.query(`SELECT COUNT(*) as count FROM aufmass_forms WHERE status = 'abnahme' ${branchFilterAnd}`);
    const draft = await draftReq.query(`SELECT COUNT(*) as count FROM aufmass_forms WHERE status IN ('neu', 'angebot_versendet') ${branchFilterAnd}`);

    res.json({
      total: total.recordset[0].count,
      completed: completed.recordset[0].count,
      draft: draft.recordset[0].count
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get Montageteam stats (with project counts from forms)
app.get('/api/stats/montageteam', authenticateToken, async (req, res) => {
  try {
    // Get all montageteams with their project counts
    const result = await pool.request().query(`
      SELECT
        m.id,
        m.name as montageteam,
        m.is_active,
        m.created_at,
        ISNULL(f.count, 0) as count,
        ISNULL(f.neu, 0) as neu,
        ISNULL(f.abgeschlossen, 0) as abgeschlossen
      FROM aufmass_montageteams m
      LEFT JOIN (
        SELECT
          JSON_VALUE(specifications, '$.montageteam') as team_name,
          COUNT(*) as count,
          SUM(CASE WHEN status IN ('neu', 'draft', 'completed') THEN 1 ELSE 0 END) as neu,
          SUM(CASE WHEN status = 'abgeschlossen' THEN 1 ELSE 0 END) as abgeschlossen
        FROM aufmass_forms
        WHERE JSON_VALUE(specifications, '$.montageteam') IS NOT NULL
          AND JSON_VALUE(specifications, '$.montageteam') != ''
        GROUP BY JSON_VALUE(specifications, '$.montageteam')
      ) f ON m.name = f.team_name
      WHERE m.is_active = 1
      ORDER BY m.name ASC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching montageteam stats:', err);
    res.status(500).json({ error: 'Failed to fetch montageteam stats' });
  }
});

// ============ MONTAGETEAMS CRUD ============

// Get all montageteams
app.get('/api/montageteams', authenticateToken, async (req, res) => {
  try {
    // Filter by branch if set - strict isolation (no NULL fallback)
    const branchFilter = req.branchId ? 'WHERE branch_id = @branch_id' : '';
    const request = pool.request();
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }

    const result = await request.query(`
      SELECT * FROM aufmass_montageteams ${branchFilter} ORDER BY name ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching montageteams:', err);
    res.status(500).json({ error: 'Failed to fetch montageteams' });
  }
});

// Create montageteam
app.post('/api/montageteams', authenticateToken, requireAdminOrOffice, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.request()
      .input('name', sql.NVarChar, name.trim())
      .input('branch_id', sql.NVarChar, req.branchId || null)
      .query(`
        INSERT INTO aufmass_montageteams (name, branch_id)
        OUTPUT INSERTED.*
        VALUES (@name, @branch_id)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Montageteam name already exists' });
    }
    console.error('Error creating montageteam:', err);
    res.status(500).json({ error: 'Failed to create montageteam' });
  }
});

// Update montageteam (branch filtered)
app.put('/api/montageteams/:id', authenticateToken, requireAdminOrOffice, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';

    const request = pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('is_active', sql.Bit, is_active !== undefined ? is_active : true);

    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }

    await request.query(`
      UPDATE aufmass_montageteams SET
        name = @name,
        is_active = @is_active
      WHERE id = @id ${branchFilter}
    `);

    res.json({ message: 'Montageteam updated' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Montageteam name already exists' });
    }
    console.error('Error updating montageteam:', err);
    res.status(500).json({ error: 'Failed to update montageteam' });
  }
});

// Delete montageteam (branch filtered)
app.delete('/api/montageteams/:id', authenticateToken, requireAdminOrOffice, async (req, res) => {
  try {
    const { id } = req.params;
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';
    const request = pool.request().input('id', sql.Int, id);
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    await request.query(`DELETE FROM aufmass_montageteams WHERE id = @id ${branchFilter}`);

    res.json({ message: 'Montageteam deleted' });
  } catch (err) {
    console.error('Error deleting montageteam:', err);
    res.status(500).json({ error: 'Failed to delete montageteam' });
  }
});

// ============ E-SIGNATURE API HELPER ============

const ESIGN_API_URL = 'https://test.esignature.openapi.com';
const ESIGN_API_TOKEN = '6970ac597587b2a42b091184';  // Sandbox token - HARDCODED to avoid env override
const ESIGN_API_KEY = 'wwy8ndulhusbijf68wxgtv2zkx6mrevb';
const ESIGN_API_EMAIL = 'fkeles@conais.com';
const ESIGN_OAUTH_URL = process.env.ESIGN_OAUTH_URL || 'https://test.oauth.openapi.it';
const ESIGN_CERT_USERNAME = process.env.ESIGN_CERT_USERNAME || 'openapiSandboxUsername';
const ESIGN_CERT_PASSWORD = process.env.ESIGN_CERT_PASSWORD || 'openapiSandboxPassword';

// Verify token is valid before using
async function verifyOrRefreshToken() {
  try {
    // Basic Auth format: email:apikey
    const basicAuth = Buffer.from(`${ESIGN_API_EMAIL}:${ESIGN_API_KEY}`).toString('base64');
    console.log('OAuth Basic Auth (email:apikey):', ESIGN_API_EMAIL ? 'configured' : 'MISSING EMAIL!');

    // Check current token status via OAuth API
    const response = await fetch(`${ESIGN_OAUTH_URL}/token/${ESIGN_API_TOKEN}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    console.log('Token verification:', JSON.stringify(data, null, 2));

    if (data.success && data.token) {
      console.log('Token is valid. Scopes:', data.scopes);
      console.log('Token expires:', new Date(data.expire * 1000).toISOString());
      return ESIGN_API_TOKEN;
    } else {
      console.log('Token invalid or expired, creating new one...');
      return await createNewToken();
    }
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return ESIGN_API_TOKEN; // Fall back to existing token
  }
}

// Create new token with all eSignature scopes
async function createNewToken() {
  try {
    const basicAuth = Buffer.from(`${ESIGN_API_EMAIL}:${ESIGN_API_KEY}`).toString('base64');
    const response = await fetch(`${ESIGN_OAUTH_URL}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        scopes: ['*:esignature.openapi.com/*', '*:test.esignature.openapi.com/*'],
        ttl: 31536000 // 1 year
      })
    });

    const data = await response.json();
    console.log('New token created:', JSON.stringify(data, null, 2));

    if (data.success && data.token) {
      return data.token;
    }
    throw new Error('Failed to create token');
  } catch (error) {
    console.error('Token creation failed:', error.message);
    throw error;
  }
}

// Helper: Call OpenAPI eSignature API
async function callEsignatureAPI(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${ESIGN_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`Calling eSignature API: ${method} ${ESIGN_API_URL}${endpoint}`);
  console.log(`Full token: ${ESIGN_API_TOKEN}`);
  console.log(`Full URL: ${ESIGN_API_URL}`);
  const response = await fetch(`${ESIGN_API_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eSignature API error: ${response.status} - ${errorText}`);
  }

  // Check if response is JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const jsonResponse = await response.json();
    console.log('eSignature API Response:', JSON.stringify(jsonResponse, null, 2));
    return jsonResponse;
  }

  return response;
}

// Helper: Check if branch has e-signature enabled
async function isBranchEsignatureEnabled(branchSlug) {
  if (!branchSlug) return false; // Admin branch doesn't need check

  const result = await pool.request()
    .input('branch_slug', sql.NVarChar, branchSlug)
    .query('SELECT esignature_enabled FROM aufmass_branch_settings WHERE branch_slug = @branch_slug');

  return result.recordset.length > 0 && result.recordset[0].esignature_enabled;
}

// ============ BOLDSIGN API CONFIGURATION ============

const BOLDSIGN_API_URL = process.env.BOLDSIGN_API_URL || 'https://api-eu.boldsign.com/v1';
const BOLDSIGN_API_KEY = process.env.BOLDSIGN_API_KEY || ''; // Must be set in .env
const BOLDSIGN_WEBHOOK_SECRET = process.env.BOLDSIGN_WEBHOOK_SECRET || '';

// Helper: Call BoldSign API
async function callBoldSignAPI(endpoint, method = 'GET', body = null, isFormData = false) {
  const headers = {
    'X-API-KEY': BOLDSIGN_API_KEY,
    'Accept': 'application/json'
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const options = { method, headers };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  console.log(`Calling BoldSign API: ${method} ${BOLDSIGN_API_URL}${endpoint}`);
  const response = await fetch(`${BOLDSIGN_API_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BoldSign API error: ${response.status} - ${errorText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const jsonResponse = await response.json();
    console.log('BoldSign API Response:', JSON.stringify(jsonResponse, null, 2));
    return jsonResponse;
  }

  return response;
}

// Helper: Verify BoldSign webhook signature
function verifyBoldSignWebhook(payload, signature, secret) {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ============ E-SIGNATURE BRANCH SETTINGS ENDPOINTS ============

// Get all branch settings (admin only)
app.get('/api/esignature/branch-settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Only allow from admin branch
    if (req.branchId !== null) {
      return res.status(403).json({ error: 'Admin branch access required' });
    }

    // Get all branches with their e-signature settings
    const result = await pool.request().query(`
      SELECT
        b.slug,
        b.name,
        b.is_active,
        ISNULL(bs.esignature_enabled, 0) as esignature_enabled,
        ISNULL(bs.esignature_sandbox, 1) as esignature_sandbox,
        ISNULL(bs.esignature_provider, 'openapi') as esignature_provider
      FROM aufmass_branches b
      LEFT JOIN aufmass_branch_settings bs ON b.slug = bs.branch_slug
      ORDER BY b.name
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching branch settings:', err);
    res.status(500).json({ error: 'Failed to fetch branch settings' });
  }
});

// Update branch e-signature settings (admin only)
app.put('/api/esignature/branch-settings/:slug', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Only allow from admin branch
    if (req.branchId !== null) {
      return res.status(403).json({ error: 'Admin branch access required' });
    }

    const { slug } = req.params;
    const { esignature_enabled, esignature_sandbox, esignature_provider } = req.body;

    // Upsert branch settings
    await pool.request()
      .input('branch_slug', sql.NVarChar, slug)
      .input('esignature_enabled', sql.Bit, esignature_enabled ? 1 : 0)
      .input('esignature_sandbox', sql.Bit, esignature_sandbox ? 1 : 0)
      .input('esignature_provider', sql.NVarChar, esignature_provider || 'openapi')
      .query(`
        MERGE aufmass_branch_settings AS target
        USING (SELECT @branch_slug AS branch_slug) AS source
        ON target.branch_slug = source.branch_slug
        WHEN MATCHED THEN
          UPDATE SET
            esignature_enabled = @esignature_enabled,
            esignature_sandbox = @esignature_sandbox,
            esignature_provider = @esignature_provider,
            updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (branch_slug, esignature_enabled, esignature_sandbox, esignature_provider)
          VALUES (@branch_slug, @esignature_enabled, @esignature_sandbox, @esignature_provider);
      `);

    res.json({ message: 'Branch settings updated', slug, esignature_enabled, esignature_sandbox, esignature_provider });
  } catch (err) {
    console.error('Error updating branch settings:', err);
    res.status(500).json({ error: 'Failed to update branch settings' });
  }
});

// Get current branch features (for frontend to check)
// NOTE: E-Signature feature is temporarily deactivated for all branches.
// All esignature code is preserved but disabled via this endpoint.
app.get('/api/branch/features', authenticateToken, async (req, res) => {
  try {
    const branchSlug = req.branchId;

    // E-Signature is deactivated for now - always return false
    const ESIGNATURE_ACTIVE = false;

    // Admin branch (null) sees management UI
    if (branchSlug === null) {
      return res.json({
        isAdminBranch: true,
        esignature_enabled: ESIGNATURE_ACTIVE,
        esignature_management: ESIGNATURE_ACTIVE
      });
    }

    res.json({
      isAdminBranch: false,
      branchSlug,
      esignature_enabled: ESIGNATURE_ACTIVE,
      esignature_sandbox: false,
      esignature_management: false
    });
  } catch (err) {
    console.error('Error fetching branch features:', err);
    res.status(500).json({ error: 'Failed to fetch branch features' });
  }
});

// ============ E-SIGNATURE REQUEST ENDPOINTS ============

// Public endpoint to serve PDF for OpenAPI to fetch (much faster than base64 upload)
app.get('/api/esignature/pdf/:form_id/:token', async (req, res) => {
  try {
    const { form_id, token } = req.params;

    // Simple token validation - token is first 8 chars of form creation timestamp hash
    const formResult = await pool.request()
      .input('formId', sql.Int, form_id)
      .query(`SELECT generated_pdf, created_at FROM aufmass_forms WHERE id = @formId`);

    if (formResult.recordset.length === 0 || !formResult.recordset[0].generated_pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const form = formResult.recordset[0];
    // Generate expected token from created_at timestamp
    const expectedToken = crypto.createHash('md5')
      .update(form.created_at.toISOString() + form_id)
      .digest('hex')
      .substring(0, 8);

    if (token !== expectedToken) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    // Serve PDF directly
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="aufmass_${form_id}.pdf"`);
    res.send(form.generated_pdf);
  } catch (err) {
    console.error('Error serving PDF:', err);
    res.status(500).json({ error: 'Failed to serve PDF' });
  }
});

// Create QES signature request via OpenAPI (Aufmaß - customer receives signing link via email)
// EU-QES_mail_otp: Qualified Electronic Signature with email OTP - customer signs themselves
app.post('/api/esignature/send-ses', authenticateToken, async (req, res) => {
  try {
    const { form_id } = req.body;

    if (!form_id) {
      return res.status(400).json({ error: 'form_id is required' });
    }

    // Get form data from database
    const formResult = await pool.request()
      .input('formId', sql.Int, form_id)
      .query(`SELECT * FROM aufmass_forms WHERE id = @formId`);

    if (formResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formResult.recordset[0];
    const signer_firstname = form.kunde_vorname || 'Kunde';
    const signer_lastname = form.kunde_nachname || '';
    const signer_name = `${signer_firstname} ${signer_lastname}`.trim();
    const signer_email = form.kunde_email;
    const signer_phone = form.kunde_telefon || '';

    // Email is required for EU-SES
    if (!signer_email) {
      return res.status(400).json({ error: 'Kunden-E-Mail ist erforderlich für die Signatur.' });
    }

    // Check if PDF exists
    if (!form.generated_pdf) {
      return res.status(400).json({ error: 'PDF nicht gefunden. Bitte zuerst PDF erstellen (PDF Vorschau Button).' });
    }

    // Use base64 format
    const pdf_base64 = form.generated_pdf.toString('base64');
    console.log('OpenAPI QES Aufmaß: Base64 format, PDF size:', Math.round(pdf_base64.length / 1024), 'KB');
    console.log('OpenAPI QES Aufmaß: Signer:', signer_name, signer_email);

    // Call OpenAPI EU-QES_mail_otp endpoint - QES level signature
    // Customer receives signing link, signs with email OTP verification
    // QES = Qualified Electronic Signature (highest legal level)
    const signatureResponse = await callEsignatureAPI('/EU-QES_mail_otp', 'POST', {
      title: `Aufmaß Bestätigung - ${form_id}`,
      description: `Aufmaß Dokument für ${signer_name}`,
      certificateUsername: ESIGN_CERT_USERNAME,
      certificatePassword: ESIGN_CERT_PASSWORD,
      inputDocuments: [{
        sourceType: 'base64',
        payload: pdf_base64
      }],
      signers: [{
        name: signer_firstname,
        surname: signer_lastname || signer_firstname,
        email: signer_email,
        mobile: signer_phone || undefined,
        authentication: ['email'],  // OTP via email
        signatures: [{
          page: 1,
          x: '350',
          y: '750'
        }]
      }],
      callback: {
        url: `${process.env.CALLBACK_BASE_URL || 'https://aufmass-api.conais.com'}/api/webhooks/esignature`
      }
    });

    // Extract data from API response
    const responseData = signatureResponse.data || signatureResponse;
    const openapi_id = responseData.id;
    const status = responseData.state || 'WAIT_VALIDATION';
    // EU-SES returns signing URLs for each signer
    const signing_url = responseData.signers?.[0]?.url || responseData.signingUrl || null;

    console.log('OpenAPI QES Response:', JSON.stringify(responseData, null, 2));

    // Save signature request to database
    const insertResult = await pool.request()
      .input('form_id', sql.Int, form_id)
      .input('signature_type', sql.NVarChar, 'QES_AUFMASS')
      .input('openapi_signature_id', sql.NVarChar, openapi_id)
      .input('status', sql.NVarChar, status)
      .input('signer_email', sql.NVarChar, signer_email)
      .input('signer_name', sql.NVarChar, signer_name)
      .input('signing_url', sql.NVarChar, signing_url)
      .input('provider', sql.NVarChar, 'openapi')
      .query(`
        INSERT INTO aufmass_esignature_requests
        (form_id, signature_type, openapi_signature_id, status, signer_email, signer_name, signing_url, provider)
        OUTPUT INSERTED.id
        VALUES (@form_id, @signature_type, @openapi_signature_id, @status, @signer_email, @signer_name, @signing_url, @provider)
      `);

    res.json({
      success: true,
      request_id: insertResult.recordset[0].id,
      openapi_id: openapi_id,
      signing_url: signing_url,
      status: status,
      provider: 'openapi',
      message: signing_url
        ? `Imza linki oluşturuldu. Müşteri (${signer_email}) email ile bilgilendirildi.`
        : `Imza talebi oluşturuldu. Müşteri (${signer_email}) email ile bilgilendirilecek.`
    });
  } catch (err) {
    console.error('Error creating OpenAPI QES signature:', err);
    res.status(500).json({ error: 'Failed to create signature request', details: err.message });
  }
});

// Create QES signature request (Aufmass, Angebot or Abnahme) - customer receives signing link via email
// EU-QES_mail_otp: Qualified Electronic Signature with email OTP verification - customer signs themselves
app.post('/api/esignature/send-qes', authenticateToken, async (req, res) => {
  try {
    const { form_id, signature_type } = req.body;

    if (!form_id || !signature_type) {
      return res.status(400).json({ error: 'form_id and signature_type are required' });
    }

    // Validate signature_type
    if (!['aufmass', 'angebot', 'abnahme'].includes(signature_type)) {
      return res.status(400).json({ error: 'signature_type must be aufmass, angebot or abnahme' });
    }

    // Get form data from database
    const formResult = await pool.request()
      .input('formId', sql.Int, form_id)
      .query(`SELECT * FROM aufmass_forms WHERE id = @formId`);

    if (formResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formResult.recordset[0];
    const signer_firstname = form.kunde_vorname || 'Kunde';
    const signer_lastname = form.kunde_nachname || '';
    const signer_name = `${signer_firstname} ${signer_lastname}`.trim();
    const signer_email = form.kunde_email;
    const signer_phone = form.kunde_telefon || '';

    if (!signer_email) {
      return res.status(400).json({ error: 'Kunden-E-Mail ist erforderlich. Bitte E-Mail zum Formular hinzufügen.' });
    }

    // Get stored PDF from database
    let pdf_base64;
    if (form.generated_pdf) {
      pdf_base64 = form.generated_pdf.toString('base64');
    } else {
      return res.status(400).json({ error: 'PDF nicht gefunden. Bitte zuerst PDF erstellen (PDF Vorschau Button).' });
    }

    const purposeMap = {
      'aufmass': 'QES_AUFMASS',
      'angebot': 'QES_ANGEBOT',
      'abnahme': 'QES_ABNAHME'
    };
    const signature_purpose = purposeMap[signature_type];
    const titleMap = {
      'QES_AUFMASS': `Aufmaß Bestätigung - ${form_id}`,
      'QES_ANGEBOT': `Angebot Bestätigung - ${form_id}`,
      'QES_ABNAHME': `Abnahmeprotokoll - ${form_id}`
    };
    const descriptionMap = {
      'QES_AUFMASS': `Aufmaß Dokument für ${signer_name} - Bitte unterschreiben Sie zur Bestätigung`,
      'QES_ANGEBOT': `Angebot Dokument für ${signer_name} - Bitte unterschreiben Sie zur Auftragserteilung`,
      'QES_ABNAHME': `Abnahmeprotokoll für ${signer_name} - Bitte unterschreiben Sie zur Bestätigung`
    };

    console.log(`OpenAPI QES ${signature_type}: Signer:`, signer_name, signer_email);

    // Call OpenAPI EU-QES_mail_otp endpoint - QES level signature
    // Customer receives signing link, signs with email OTP verification
    const signatureResponse = await callEsignatureAPI('/EU-QES_mail_otp', 'POST', {
      title: titleMap[signature_purpose],
      description: descriptionMap[signature_purpose],
      certificateUsername: ESIGN_CERT_USERNAME,
      certificatePassword: ESIGN_CERT_PASSWORD,
      inputDocuments: [{
        sourceType: 'base64',
        payload: pdf_base64
      }],
      signers: [{
        name: signer_firstname,
        surname: signer_lastname || signer_firstname,
        email: signer_email,
        mobile: signer_phone || undefined,
        authentication: ['email'],
        signatures: [{
          page: 1,
          x: '350',
          y: '750'
        }]
      }],
      callback: {
        url: `${process.env.CALLBACK_BASE_URL || 'https://aufmass-api.conais.com'}/api/webhooks/esignature`
      }
    });

    // Extract data from API response
    const responseData = signatureResponse.data || signatureResponse;
    const openapi_id = responseData.id;
    const status = responseData.state || 'WAIT_VALIDATION';
    const signing_url = responseData.signers?.[0]?.url || responseData.signingUrl || null;

    console.log(`OpenAPI QES ${signature_type} Response:`, JSON.stringify(responseData, null, 2));

    // Save signature request to database
    const insertResult = await pool.request()
      .input('form_id', sql.Int, form_id)
      .input('signature_type', sql.NVarChar, signature_purpose)
      .input('openapi_signature_id', sql.NVarChar, openapi_id)
      .input('status', sql.NVarChar, status)
      .input('signer_email', sql.NVarChar, signer_email)
      .input('signer_name', sql.NVarChar, signer_name)
      .input('signing_url', sql.NVarChar, signing_url)
      .input('provider', sql.NVarChar, 'openapi')
      .query(`
        INSERT INTO aufmass_esignature_requests
        (form_id, signature_type, openapi_signature_id, status, signer_email, signer_name, signing_url, provider)
        OUTPUT INSERTED.id
        VALUES (@form_id, @signature_type, @openapi_signature_id, @status, @signer_email, @signer_name, @signing_url, @provider)
      `);

    res.json({
      success: true,
      request_id: insertResult.recordset[0].id,
      openapi_id: openapi_id,
      signing_url: signing_url,
      status: status,
      provider: 'openapi',
      message: signing_url
        ? `Imza linki oluşturuldu. Müşteri (${signer_email}) email ile bilgilendirildi.`
        : `Imza talebi oluşturuldu. Müşteri (${signer_email}) email ile bilgilendirilecek.`
    });
  } catch (err) {
    console.error('Error creating QES signature:', err);
    res.status(500).json({ error: 'Failed to create signature request', details: err.message });
  }
});

// Get signature status for a form (with branch isolation)
app.get('/api/esignature/status/:formId', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;

    // Branch filter for isolation - only show signatures from same branch
    const branchFilter = req.branchId ? 'AND (e.branch_id = @branch_id OR e.branch_id IS NULL)' : '';
    const request = pool.request().input('form_id', sql.Int, formId);
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }

    const result = await request.query(`
        SELECT
          e.id, e.signature_type, e.openapi_signature_id, e.boldsign_document_id, e.status,
          e.signer_email, e.signer_name, e.signing_url, e.document_type, e.provider,
          e.signed_at, e.created_at, e.updated_at, e.error_message
        FROM aufmass_esignature_requests e
        WHERE e.form_id = @form_id ${branchFilter}
        ORDER BY e.created_at DESC
      `);

    res.json({
      form_id: formId,
      signatures: result.recordset
    });
  } catch (err) {
    console.error('Error fetching signature status:', err);
    res.status(500).json({ error: 'Failed to fetch signature status' });
  }
});

// Poll for new signature notifications (signed documents since last check)
// Each branch only sees their own signatures
app.get('/api/esignature/notifications', authenticateToken, async (req, res) => {
  try {
    const { since } = req.query; // ISO timestamp of last check
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000); // Default: last 60 seconds

    // Branch filter for isolation
    const branchFilter = req.branchId ? 'AND e.branch_id = @branch_id' : 'AND e.branch_id IS NULL';
    const request = pool.request()
      .input('since_date', sql.DateTime, sinceDate);

    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }

    const result = await request.query(`
      SELECT
        e.id, e.form_id, e.signature_type, e.document_type, e.status,
        e.signer_name, e.signed_at, e.updated_at,
        f.kunde_vorname, f.kunde_nachname
      FROM aufmass_esignature_requests e
      JOIN aufmass_forms f ON e.form_id = f.id
      WHERE e.status = 'signed'
        AND e.signed_at > @since_date
        ${branchFilter}
      ORDER BY e.signed_at DESC
    `);

    res.json({
      notifications: result.recordset,
      checked_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error fetching signature notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Download signed document
app.get('/api/esignature/download/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;

    const result = await pool.request()
      .input('id', sql.Int, requestId)
      .query('SELECT signed_document, signature_type, form_id FROM aufmass_esignature_requests WHERE id = @id');

    if (result.recordset.length === 0 || !result.recordset[0].signed_document) {
      return res.status(404).json({ error: 'Signed document not found' });
    }

    const { signed_document, signature_type, form_id } = result.recordset[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Aufmass_${form_id}_${signature_type}_signed.pdf"`);
    res.send(signed_document);
  } catch (err) {
    console.error('Error downloading signed document:', err);
    res.status(500).json({ error: 'Failed to download signed document' });
  }
});

// ============ E-SIGNATURE WEBHOOK ENDPOINT ============

// Webhook callback from OpenAPI
app.post('/api/webhooks/esignature', async (req, res) => {
  try {
    console.log('📩 E-Signature webhook received:', JSON.stringify(req.body, null, 2));

    const { id, status, signedDocument } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing signature id' });
    }

    // Find the signature request by openapi_signature_id
    const findResult = await pool.request()
      .input('openapi_signature_id', sql.NVarChar, id)
      .query('SELECT id, form_id, signature_type FROM aufmass_esignature_requests WHERE openapi_signature_id = @openapi_signature_id');

    if (findResult.recordset.length === 0) {
      console.warn('⚠️ Webhook received for unknown signature:', id);
      return res.status(200).json({ message: 'Signature not found, ignoring' });
    }

    const signatureRequest = findResult.recordset[0];

    // Update signature request status
    const updateRequest = pool.request()
      .input('id', sql.Int, signatureRequest.id)
      .input('status', sql.NVarChar, status === 'signed' ? 'signed' : status)
      .input('callback_received_at', sql.DateTime, new Date());

    // If signed, try to fetch and store the signed document
    if (status === 'signed' && signedDocument) {
      // signedDocument might be base64 encoded
      const signedBuffer = Buffer.from(signedDocument, 'base64');
      updateRequest.input('signed_document', sql.VarBinary(sql.MAX), signedBuffer);
      updateRequest.input('signed_at', sql.DateTime, new Date());

      await updateRequest.query(`
        UPDATE aufmass_esignature_requests
        SET status = @status, signed_document = @signed_document, signed_at = @signed_at,
            callback_received_at = @callback_received_at, updated_at = GETDATE()
        WHERE id = @id
      `);

      // Auto-update form status based on signature type
      const { form_id, signature_type } = signatureRequest;

      if (signature_type === 'QES_ANGEBOT') {
        // Angebot signed -> Auftrag Erteilt
        await pool.request()
          .input('form_id', sql.Int, form_id)
          .input('status', sql.NVarChar, 'auftrag_erteilt')
          .input('status_date', sql.Date, new Date())
          .query(`
            UPDATE aufmass_forms
            SET status = @status, status_date = @status_date, updated_at = GETDATE()
            WHERE id = @form_id
          `);

        console.log(`✅ Form ${form_id} status updated to auftrag_erteilt (QES_ANGEBOT signed)`);
      }
      // For SES and QES_ABNAHME, we don't auto-change status (manual confirmation may be needed)
    } else {
      await updateRequest.query(`
        UPDATE aufmass_esignature_requests
        SET status = @status, callback_received_at = @callback_received_at, updated_at = GETDATE()
        WHERE id = @id
      `);
    }

    console.log(`✅ Signature ${id} updated to status: ${status}`);
    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (err) {
    console.error('❌ Error processing webhook:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Generate mailto link with pre-filled content
app.post('/api/esignature/generate-mailto', authenticateToken, async (req, res) => {
  try {
    const { signature_type, signer_email, signer_name, signing_url, form_id } = req.body;

    if (!signature_type || !signer_email || !signing_url) {
      return res.status(400).json({ error: 'signature_type, signer_email, and signing_url are required' });
    }

    // Email templates in German
    const templates = {
      'SES': {
        subject: `Aufmaß-Bestätigung - Bitte unterschreiben`,
        body: `Sehr geehrte/r ${signer_name || 'Kunde'},

hiermit bestätigen wir die Aufnahme Ihrer Maße.

Bitte bestätigen Sie die Maßaufnahme über folgenden Link:
${signing_url}

Mit freundlichen Grüßen
AYLUX Team`
      },
      'QES_ANGEBOT': {
        subject: `Ihr Angebot von AYLUX - Elektronische Signatur erforderlich`,
        body: `Sehr geehrte/r ${signer_name || 'Kunde'},

anbei erhalten Sie unser Angebot für Ihr Projekt.

Bitte unterzeichnen Sie das Angebot elektronisch über folgenden Link:
${signing_url}

Nach Ihrer Unterschrift wird der Auftrag automatisch erteilt.

Mit freundlichen Grüßen
AYLUX Team`
      },
      'QES_ABNAHME': {
        subject: `Abnahmeprotokoll - Elektronische Signatur`,
        body: `Sehr geehrte/r ${signer_name || 'Kunde'},

die Montagearbeiten wurden abgeschlossen.

Bitte bestätigen Sie die Abnahme über folgenden Link:
${signing_url}

Mit freundlichen Grüßen
AYLUX Team`
      }
    };

    const template = templates[signature_type] || templates['SES'];

    const mailtoLink = `mailto:${encodeURIComponent(signer_email)}?subject=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}`;

    res.json({
      mailto_link: mailtoLink,
      subject: template.subject,
      body: template.body
    });
  } catch (err) {
    console.error('Error generating mailto link:', err);
    res.status(500).json({ error: 'Failed to generate mailto link' });
  }
});

// ============ OPENAPI ESIGNATURE CALLBACK ENDPOINTS ============

// In-memory storage for callback logs (for testing purposes)
const esignatureCallbackLogs = [];
const MAX_CALLBACK_LOGS = 100;

// Callback endpoint for OpenAPI eSignature service
app.post('/api/openapi/esignature/callback', (req, res) => {
  try {
    const payload = req.body;
    const receivedAt = new Date().toISOString();

    // Extract signature ID from payload (structure may vary based on OpenAPI docs)
    const signatureId = payload.signatureId || payload.id || payload.signature_id || 'unknown';
    const state = payload.state || payload.status || 'unknown';

    const logEntry = {
      receivedAt,
      signatureId,
      state,
      payload
    };

    // Add to in-memory log (keep last N entries)
    esignatureCallbackLogs.unshift(logEntry);
    if (esignatureCallbackLogs.length > MAX_CALLBACK_LOGS) {
      esignatureCallbackLogs.pop();
    }

    // Also write to file for persistence
    const logsDir = path.join(process.cwd(), 'openapi-callback-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const logFileName = `callback-${signatureId}-${receivedAt.replace(/[:.]/g, '-')}.json`;
    const logFilePath = path.join(logsDir, logFileName);
    fs.writeFileSync(logFilePath, JSON.stringify(logEntry, null, 2));

    console.log(`[OpenAPI Callback] Received callback for signature ${signatureId}, state: ${state}`);
    console.log(`[OpenAPI Callback] Payload logged to: ${logFilePath}`);

    // Return success to OpenAPI
    res.status(200).json({ success: true, receivedAt });
  } catch (err) {
    console.error('[OpenAPI Callback] Error processing callback:', err);
    res.status(500).json({ error: 'Failed to process callback' });
  }
});

// Get callback logs for test harness
app.get('/api/openapi/esignature/callback-log', (req, res) => {
  try {
    const { signatureId, limit = 50 } = req.query;

    let logs = [...esignatureCallbackLogs];

    // Filter by signatureId if provided
    if (signatureId) {
      logs = logs.filter(log => log.signatureId === signatureId);
    }

    // Limit results
    logs = logs.slice(0, parseInt(limit));

    res.json({
      count: logs.length,
      logs
    });
  } catch (err) {
    console.error('[OpenAPI Callback] Error retrieving logs:', err);
    res.status(500).json({ error: 'Failed to retrieve callback logs' });
  }
});

// ============ BOLDSIGN E-SIGNATURE ENDPOINTS ============

// In-memory storage for BoldSign callback logs
const boldSignCallbackLogs = [];
const MAX_BOLDSIGN_CALLBACK_LOGS = 100;

// Send document for signature via BoldSign (AES - Advanced Electronic Signature with Email OTP)
app.post('/api/boldsign/send-aes', authenticateToken, async (req, res) => {
  try {
    const { form_id } = req.body;

    if (!form_id) {
      return res.status(400).json({ error: 'form_id is required' });
    }

    if (!BOLDSIGN_API_KEY) {
      return res.status(500).json({ error: 'BoldSign API key not configured' });
    }

    // Get form with PDF
    const formResult = await pool.request()
      .input('form_id', sql.Int, form_id)
      .query('SELECT * FROM aufmass_forms WHERE id = @form_id');

    if (formResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formResult.recordset[0];

    if (!form.generated_pdf) {
      return res.status(400).json({ error: 'Form has no generated PDF. Bitte zuerst PDF erstellen.' });
    }

    const signer_email = form.kunde_email;
    const signer_name = `${form.kunde_vorname || ''} ${form.kunde_nachname || ''}`.trim() || 'Kunde';
    const signer_phone = form.kunde_telefon;

    if (!signer_email) {
      return res.status(400).json({ error: 'Form has no customer email for signing' });
    }

    if (!signer_phone) {
      return res.status(400).json({ error: 'Form has no customer phone number for SMS verification' });
    }

    // Parse phone number - extract country code and number
    let countryCode = '+49'; // Default Germany
    let phoneNumber = signer_phone.replace(/\s+/g, ''); // Remove spaces

    if (phoneNumber.startsWith('+')) {
      // Extract country code (assume format like +49123456789)
      const match = phoneNumber.match(/^(\+\d{1,3})(.+)$/);
      if (match) {
        countryCode = match[1];
        phoneNumber = match[2];
      }
    } else if (phoneNumber.startsWith('00')) {
      // Handle 00 prefix (e.g., 0049)
      phoneNumber = '+' + phoneNumber.substring(2);
      const match = phoneNumber.match(/^(\+\d{1,3})(.+)$/);
      if (match) {
        countryCode = match[1];
        phoneNumber = match[2];
      }
    } else if (phoneNumber.startsWith('0')) {
      // Local format, remove leading 0
      phoneNumber = phoneNumber.substring(1);
    }

    // Create FormData for BoldSign API (multipart/form-data)
    const FormData = (await import('form-data')).default;
    const axios = (await import('axios')).default;
    const formData = new FormData();

    // Add PDF file as buffer
    formData.append('Files', form.generated_pdf, {
      filename: `aufmass-${form_id}.pdf`,
      contentType: 'application/pdf'
    });

    // Add document metadata
    formData.append('Title', `Aufmaß Bestätigung - ${form_id}`);
    formData.append('Message', 'Bitte unterschreiben Sie das angehängte Aufmaß-Dokument.');
    formData.append('EnableSigningOrder', 'false');
    formData.append('ExpiryDays', '30');

    // Add signer with signature field - BoldSign AES (Advanced Electronic Signature) with SMS OTP
    // AES with SMS OTP: Signer receives SMS code to verify identity before signing
    formData.append('Signers[0][Name]', signer_name);
    formData.append('Signers[0][EmailAddress]', signer_email);
    formData.append('Signers[0][SignerType]', 'Signer');
    formData.append('Signers[0][AuthenticationType]', 'SMSOTP');
    formData.append('Signers[0][PhoneNumber][CountryCode]', countryCode);
    formData.append('Signers[0][PhoneNumber][Number]', phoneNumber);
    formData.append('Signers[0][FormFields][0][FieldType]', 'Signature');
    formData.append('Signers[0][FormFields][0][PageNumber]', '1');
    formData.append('Signers[0][FormFields][0][Bounds][X]', '350');
    formData.append('Signers[0][FormFields][0][Bounds][Y]', '750');
    formData.append('Signers[0][FormFields][0][Bounds][Width]', '150');
    formData.append('Signers[0][FormFields][0][Bounds][Height]', '50');
    formData.append('Signers[0][FormFields][0][IsRequired]', 'true');

    console.log('BoldSign AES Request - Title:', `Aufmaß Bestätigung - ${form_id}`);
    console.log('BoldSign AES Request - Signer:', signer_name, signer_email, `Phone: ${countryCode}${phoneNumber}`, '(SMS OTP)');

    // Call BoldSign API with axios
    const response = await axios.post(`${BOLDSIGN_API_URL}/document/send`, formData, {
      headers: {
        'X-API-KEY': BOLDSIGN_API_KEY,
        ...formData.getHeaders()
      }
    });

    const responseData = response.data;
    console.log('BoldSign AES Response:', JSON.stringify(responseData, null, 2));

    const documentId = responseData.documentId;

    // Save to database with document_type and branch_id
    const insertResult = await pool.request()
      .input('form_id', sql.Int, form_id)
      .input('signature_type', sql.NVarChar, 'AES')
      .input('provider', sql.NVarChar, 'boldsign')
      .input('boldsign_document_id', sql.NVarChar, documentId)
      .input('status', sql.NVarChar, 'pending')
      .input('signer_email', sql.NVarChar, signer_email)
      .input('signer_name', sql.NVarChar, signer_name)
      .input('document_type', sql.NVarChar, 'aufmass')
      .input('branch_id', sql.NVarChar, req.branchId || null)
      .query(`
        INSERT INTO aufmass_esignature_requests
        (form_id, signature_type, provider, boldsign_document_id, status, signer_email, signer_name, document_type, branch_id)
        OUTPUT INSERTED.id
        VALUES (@form_id, @signature_type, @provider, @boldsign_document_id, @status, @signer_email, @signer_name, @document_type, @branch_id)
      `);

    const requestId = insertResult.recordset[0].id;

    res.json({
      success: true,
      request_id: requestId,
      openapi_id: documentId,
      signing_url: null,  // BoldSign sends email directly
      status: 'SENT',
      provider: 'boldsign',
      message: 'Dokument wurde zur Signatur an ' + signer_email + ' gesendet'
    });

  } catch (err) {
    console.error('BoldSign SES error:', err.response?.data || err.message);
    const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    res.status(500).json({ error: 'Failed to send document for signature via BoldSign', details: errorDetails });
  }
});

// Send Abnahme (acceptance) document for AES signature via BoldSign
app.post('/api/boldsign/send-abnahme-aes', authenticateToken, async (req, res) => {
  try {
    const { form_id } = req.body;

    if (!form_id) {
      return res.status(400).json({ error: 'form_id is required' });
    }

    if (!BOLDSIGN_API_KEY) {
      return res.status(500).json({ error: 'BoldSign API key not configured' });
    }

    // Get form with PDF and abnahme data
    const formResult = await pool.request()
      .input('form_id', sql.Int, form_id)
      .query('SELECT * FROM aufmass_forms WHERE id = @form_id');

    if (formResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formResult.recordset[0];

    // Check if abnahme data exists
    const abnahmeResult = await pool.request()
      .input('form_id', sql.Int, form_id)
      .query('SELECT * FROM aufmass_abnahme WHERE form_id = @form_id');

    if (abnahmeResult.recordset.length === 0) {
      return res.status(400).json({ error: 'Abnahme data not found. Please complete Abnahme form first.' });
    }

    if (!form.generated_pdf) {
      return res.status(400).json({ error: 'Form has no generated PDF. Bitte zuerst PDF erstellen.' });
    }

    const signer_email = form.kunde_email;
    const signer_name = `${form.kunde_vorname || ''} ${form.kunde_nachname || ''}`.trim() || 'Kunde';
    const signer_phone = form.kunde_telefon;

    if (!signer_email) {
      return res.status(400).json({ error: 'Form has no customer email for signing' });
    }

    if (!signer_phone) {
      return res.status(400).json({ error: 'Form has no customer phone number for SMS verification' });
    }

    // Parse phone number
    let countryCode = '+49';
    let phoneNumber = signer_phone.replace(/\s+/g, '');

    if (phoneNumber.startsWith('+')) {
      const match = phoneNumber.match(/^(\+\d{1,3})(.+)$/);
      if (match) {
        countryCode = match[1];
        phoneNumber = match[2];
      }
    } else if (phoneNumber.startsWith('00')) {
      phoneNumber = '+' + phoneNumber.substring(2);
      const match = phoneNumber.match(/^(\+\d{1,3})(.+)$/);
      if (match) {
        countryCode = match[1];
        phoneNumber = match[2];
      }
    } else if (phoneNumber.startsWith('0')) {
      phoneNumber = phoneNumber.substring(1);
    }

    // Create FormData for BoldSign API
    const FormData = (await import('form-data')).default;
    const axios = (await import('axios')).default;
    const formData = new FormData();

    // Add PDF file
    formData.append('Files', form.generated_pdf, {
      filename: `abnahme-${form_id}.pdf`,
      contentType: 'application/pdf'
    });

    // Add document metadata for Abnahme
    formData.append('Title', `Abnahme Protokoll - ${form_id}`);
    formData.append('Message', 'Bitte unterschreiben Sie das Abnahme-Protokoll zur Bestätigung der abgeschlossenen Montage.');
    formData.append('EnableSigningOrder', 'false');
    formData.append('ExpiryDays', '30');

    // Add signer with SMS OTP authentication
    formData.append('Signers[0][Name]', signer_name);
    formData.append('Signers[0][EmailAddress]', signer_email);
    formData.append('Signers[0][SignerType]', 'Signer');
    formData.append('Signers[0][AuthenticationType]', 'SMSOTP');
    formData.append('Signers[0][PhoneNumber][CountryCode]', countryCode);
    formData.append('Signers[0][PhoneNumber][Number]', phoneNumber);
    formData.append('Signers[0][FormFields][0][FieldType]', 'Signature');
    formData.append('Signers[0][FormFields][0][PageNumber]', '1');
    formData.append('Signers[0][FormFields][0][Bounds][X]', '350');
    formData.append('Signers[0][FormFields][0][Bounds][Y]', '750');
    formData.append('Signers[0][FormFields][0][Bounds][Width]', '150');
    formData.append('Signers[0][FormFields][0][Bounds][Height]', '50');
    formData.append('Signers[0][FormFields][0][IsRequired]', 'true');

    console.log('BoldSign Abnahme AES Request - Title:', `Abnahme Protokoll - ${form_id}`);
    console.log('BoldSign Abnahme AES Request - Signer:', signer_name, signer_email, `Phone: ${countryCode}${phoneNumber}`);

    // Call BoldSign API
    const response = await axios.post(`${BOLDSIGN_API_URL}/document/send`, formData, {
      headers: {
        'X-API-KEY': BOLDSIGN_API_KEY,
        ...formData.getHeaders()
      }
    });

    const responseData = response.data;
    console.log('BoldSign Abnahme AES Response:', JSON.stringify(responseData, null, 2));

    const documentId = responseData.documentId;

    // Save to database with document_type='abnahme' and branch_id
    const insertResult = await pool.request()
      .input('form_id', sql.Int, form_id)
      .input('signature_type', sql.NVarChar, 'AES')
      .input('provider', sql.NVarChar, 'boldsign')
      .input('boldsign_document_id', sql.NVarChar, documentId)
      .input('status', sql.NVarChar, 'pending')
      .input('signer_email', sql.NVarChar, signer_email)
      .input('signer_name', sql.NVarChar, signer_name)
      .input('document_type', sql.NVarChar, 'abnahme')
      .input('branch_id', sql.NVarChar, req.branchId || null)
      .query(`
        INSERT INTO aufmass_esignature_requests
        (form_id, signature_type, provider, boldsign_document_id, status, signer_email, signer_name, document_type, branch_id)
        OUTPUT INSERTED.id
        VALUES (@form_id, @signature_type, @provider, @boldsign_document_id, @status, @signer_email, @signer_name, @document_type, @branch_id)
      `);

    const requestId = insertResult.recordset[0].id;

    res.json({
      success: true,
      request_id: requestId,
      openapi_id: documentId,
      signing_url: null,
      status: 'SENT',
      provider: 'boldsign',
      document_type: 'abnahme',
      message: 'Abnahme-Protokoll wurde zur Signatur an ' + signer_email + ' gesendet'
    });

  } catch (err) {
    console.error('BoldSign Abnahme AES error:', err.response?.data || err.message);
    const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    res.status(500).json({ error: 'Failed to send Abnahme document for signature via BoldSign', details: errorDetails });
  }
});

// Send Angebot (quote) document for AES signature via BoldSign
app.post('/api/boldsign/send-angebot-aes', authenticateToken, async (req, res) => {
  try {
    const { form_id } = req.body;

    if (!form_id) {
      return res.status(400).json({ error: 'form_id is required' });
    }

    if (!BOLDSIGN_API_KEY) {
      return res.status(500).json({ error: 'BoldSign API key not configured' });
    }

    // Get form with PDF
    const formResult = await pool.request()
      .input('form_id', sql.Int, form_id)
      .query('SELECT * FROM aufmass_forms WHERE id = @form_id');

    if (formResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formResult.recordset[0];

    // Check if angebot data exists
    const angebotResult = await pool.request()
      .input('form_id', sql.Int, form_id)
      .query('SELECT * FROM aufmass_angebot WHERE form_id = @form_id');

    if (angebotResult.recordset.length === 0) {
      return res.status(400).json({ error: 'Angebot data not found. Please complete Angebot form first.' });
    }

    if (!form.generated_pdf) {
      return res.status(400).json({ error: 'Form has no generated PDF. Bitte zuerst PDF erstellen.' });
    }

    const signer_email = form.kunde_email;
    const signer_name = `${form.kunde_vorname || ''} ${form.kunde_nachname || ''}`.trim() || 'Kunde';
    const signer_phone = form.kunde_telefon;

    if (!signer_email) {
      return res.status(400).json({ error: 'Form has no customer email for signing' });
    }

    if (!signer_phone) {
      return res.status(400).json({ error: 'Form has no customer phone number for SMS verification' });
    }

    // Parse phone number
    let countryCode = '+49';
    let phoneNumber = signer_phone.replace(/\s+/g, '');

    if (phoneNumber.startsWith('+')) {
      const match = phoneNumber.match(/^(\+\d{1,3})(.+)$/);
      if (match) {
        countryCode = match[1];
        phoneNumber = match[2];
      }
    } else if (phoneNumber.startsWith('00')) {
      phoneNumber = '+' + phoneNumber.substring(2);
      const match = phoneNumber.match(/^(\+\d{1,3})(.+)$/);
      if (match) {
        countryCode = match[1];
        phoneNumber = match[2];
      }
    } else if (phoneNumber.startsWith('0')) {
      phoneNumber = phoneNumber.substring(1);
    }

    // Create FormData for BoldSign API
    const FormData = (await import('form-data')).default;
    const axios = (await import('axios')).default;
    const formData = new FormData();

    // Add PDF file
    formData.append('Files', form.generated_pdf, {
      filename: `angebot-${form_id}.pdf`,
      contentType: 'application/pdf'
    });

    // Add document metadata for Angebot
    formData.append('Title', `Angebot - ${form_id}`);
    formData.append('Message', 'Bitte unterschreiben Sie das Angebot zur Auftragserteilung.');
    formData.append('EnableSigningOrder', 'false');
    formData.append('ExpiryDays', '30');

    // Add signer with SMS OTP authentication
    formData.append('Signers[0][Name]', signer_name);
    formData.append('Signers[0][EmailAddress]', signer_email);
    formData.append('Signers[0][SignerType]', 'Signer');
    formData.append('Signers[0][AuthenticationType]', 'SMSOTP');
    formData.append('Signers[0][PhoneNumber][CountryCode]', countryCode);
    formData.append('Signers[0][PhoneNumber][Number]', phoneNumber);
    formData.append('Signers[0][FormFields][0][FieldType]', 'Signature');
    formData.append('Signers[0][FormFields][0][PageNumber]', '1');
    formData.append('Signers[0][FormFields][0][Bounds][X]', '350');
    formData.append('Signers[0][FormFields][0][Bounds][Y]', '750');
    formData.append('Signers[0][FormFields][0][Bounds][Width]', '150');
    formData.append('Signers[0][FormFields][0][Bounds][Height]', '50');
    formData.append('Signers[0][FormFields][0][IsRequired]', 'true');

    console.log('BoldSign Angebot AES Request - Title:', `Angebot - ${form_id}`);
    console.log('BoldSign Angebot AES Request - Signer:', signer_name, signer_email, `Phone: ${countryCode}${phoneNumber}`);

    // Call BoldSign API
    const response = await axios.post(`${BOLDSIGN_API_URL}/document/send`, formData, {
      headers: {
        'X-API-KEY': BOLDSIGN_API_KEY,
        ...formData.getHeaders()
      }
    });

    const responseData = response.data;
    console.log('BoldSign Angebot AES Response:', JSON.stringify(responseData, null, 2));

    const documentId = responseData.documentId;

    // Save to database with document_type='angebot' and branch_id
    const insertResult = await pool.request()
      .input('form_id', sql.Int, form_id)
      .input('signature_type', sql.NVarChar, 'AES')
      .input('provider', sql.NVarChar, 'boldsign')
      .input('boldsign_document_id', sql.NVarChar, documentId)
      .input('status', sql.NVarChar, 'pending')
      .input('signer_email', sql.NVarChar, signer_email)
      .input('signer_name', sql.NVarChar, signer_name)
      .input('document_type', sql.NVarChar, 'angebot')
      .input('branch_id', sql.NVarChar, req.branchId || null)
      .query(`
        INSERT INTO aufmass_esignature_requests
        (form_id, signature_type, provider, boldsign_document_id, status, signer_email, signer_name, document_type, branch_id)
        OUTPUT INSERTED.id
        VALUES (@form_id, @signature_type, @provider, @boldsign_document_id, @status, @signer_email, @signer_name, @document_type, @branch_id)
      `);

    const requestId = insertResult.recordset[0].id;

    res.json({
      success: true,
      request_id: requestId,
      openapi_id: documentId,
      signing_url: null,
      status: 'SENT',
      provider: 'boldsign',
      document_type: 'angebot',
      message: 'Angebot wurde zur Signatur an ' + signer_email + ' gesendet'
    });

  } catch (err) {
    console.error('BoldSign Angebot AES error:', err.response?.data || err.message);
    const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    res.status(500).json({ error: 'Failed to send Angebot document for signature via BoldSign', details: errorDetails });
  }
});

// Get BoldSign document status
app.get('/api/esignature/boldsign/status/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!BOLDSIGN_API_KEY) {
      return res.status(500).json({ error: 'BoldSign API key not configured' });
    }

    const response = await callBoldSignAPI(`/document/properties?documentId=${documentId}`);
    res.json(response);
  } catch (err) {
    console.error('BoldSign status error:', err);
    res.status(500).json({ error: 'Failed to get document status', details: err.message });
  }
});

// Download signed document from BoldSign
app.get('/api/esignature/boldsign/download/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!BOLDSIGN_API_KEY) {
      return res.status(500).json({ error: 'BoldSign API key not configured' });
    }

    const response = await fetch(`${BOLDSIGN_API_URL}/document/download?documentId=${documentId}`, {
      headers: {
        'X-API-KEY': BOLDSIGN_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BoldSign download error: ${response.status} - ${errorText}`);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="signed-${documentId}.pdf"`);

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('BoldSign download error:', err);
    res.status(500).json({ error: 'Failed to download signed document', details: err.message });
  }
});

// Get embedded signing link from BoldSign
app.get('/api/esignature/boldsign/signing-link/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { signerEmail } = req.query;

    if (!documentId || !signerEmail) {
      return res.status(400).json({ error: 'documentId and signerEmail are required' });
    }

    if (!BOLDSIGN_API_KEY) {
      return res.status(500).json({ error: 'BoldSign API key not configured' });
    }

    const response = await callBoldSignAPI(`/document/getEmbeddedSignLink?documentId=${documentId}&signerEmail=${encodeURIComponent(signerEmail)}`);
    res.json(response);
  } catch (err) {
    console.error('BoldSign signing link error:', err);
    res.status(500).json({ error: 'Failed to get signing link', details: err.message });
  }
});

// Check BoldSign document status directly from API (for polling/refresh)
app.post('/api/esignature/boldsign/refresh-status', authenticateToken, async (req, res) => {
  try {
    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }

    if (!BOLDSIGN_API_KEY) {
      return res.status(500).json({ error: 'BoldSign API key not configured' });
    }

    // Get the signature request from database
    const dbResult = await pool.request()
      .input('id', sql.Int, request_id)
      .query('SELECT id, boldsign_document_id, status, form_id FROM aufmass_esignature_requests WHERE id = @id');

    if (dbResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    const sigRequest = dbResult.recordset[0];

    if (!sigRequest.boldsign_document_id) {
      return res.status(400).json({ error: 'No BoldSign document ID associated with this request' });
    }

    // Call BoldSign API to get current document status
    const response = await fetch(`${BOLDSIGN_API_URL}/document/properties?documentId=${sigRequest.boldsign_document_id}`, {
      headers: {
        'X-API-KEY': BOLDSIGN_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BoldSign status check error:', errorText);
      return res.status(500).json({ error: 'Failed to check BoldSign status', details: errorText });
    }

    const boldSignData = await response.json();
    console.log('BoldSign document status:', boldSignData.status);

    // Map BoldSign status to our status
    let newStatus = sigRequest.status;
    if (boldSignData.status === 'Completed') {
      newStatus = 'signed';
    } else if (boldSignData.status === 'Declined') {
      newStatus = 'declined';
    } else if (boldSignData.status === 'Expired') {
      newStatus = 'expired';
    } else if (boldSignData.status === 'Revoked') {
      newStatus = 'cancelled';
    } else if (boldSignData.status === 'InProgress') {
      // Check if viewed or being signed
      const signer = boldSignData.signerDetails?.[0];
      if (signer?.status === 'Viewed') {
        newStatus = 'viewed';
      } else if (signer?.status === 'Signed') {
        newStatus = 'signing';
      } else {
        newStatus = 'pending';
      }
    } else if (boldSignData.status === 'WaitingForOthers' || boldSignData.status === 'Sent') {
      newStatus = 'pending';
    }

    // Update database if status changed
    if (newStatus !== sigRequest.status) {
      const updateRequest = pool.request()
        .input('id', sql.Int, request_id)
        .input('status', sql.NVarChar, newStatus);

      // If completed, also download the signed document
      if (newStatus === 'signed') {
        try {
          const downloadResponse = await fetch(`${BOLDSIGN_API_URL}/document/download?documentId=${sigRequest.boldsign_document_id}`, {
            headers: { 'X-API-KEY': BOLDSIGN_API_KEY }
          });

          if (downloadResponse.ok) {
            const pdfBuffer = await downloadResponse.arrayBuffer();
            updateRequest.input('signed_document', sql.VarBinary(sql.MAX), Buffer.from(pdfBuffer));
            updateRequest.input('signed_at', sql.DateTime, new Date());
            await updateRequest.query(`
              UPDATE aufmass_esignature_requests
              SET status = @status, signed_document = @signed_document, signed_at = @signed_at, updated_at = GETDATE()
              WHERE id = @id
            `);
          } else {
            await updateRequest.query(`
              UPDATE aufmass_esignature_requests
              SET status = @status, updated_at = GETDATE()
              WHERE id = @id
            `);
          }
        } catch (downloadErr) {
          console.error('Error downloading signed document:', downloadErr);
          await updateRequest.query(`
            UPDATE aufmass_esignature_requests
            SET status = @status, updated_at = GETDATE()
            WHERE id = @id
          `);
        }
      } else {
        await updateRequest.query(`
          UPDATE aufmass_esignature_requests
          SET status = @status, updated_at = GETDATE()
          WHERE id = @id
        `);
      }

      console.log(`Signature status updated: ${sigRequest.status} -> ${newStatus}`);
    }

    res.json({
      request_id,
      previous_status: sigRequest.status,
      current_status: newStatus,
      boldsign_status: boldSignData.status,
      updated: newStatus !== sigRequest.status
    });
  } catch (err) {
    console.error('BoldSign refresh status error:', err);
    res.status(500).json({ error: 'Failed to refresh signature status', details: err.message });
  }
});

// BoldSign webhook callback
app.post('/api/webhooks/boldsign', async (req, res) => {
  try {
    console.log('📩 BoldSign webhook received:', JSON.stringify(req.body, null, 2));

    const signature = req.headers['x-boldsign-signature'];
    const payload = req.body;

    // Verify signature if secret is configured
    if (BOLDSIGN_WEBHOOK_SECRET && signature) {
      if (!verifyBoldSignWebhook(payload, signature, BOLDSIGN_WEBHOOK_SECRET)) {
        console.warn('⚠️ BoldSign webhook signature verification failed');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { event, document } = payload;
    const eventType = event?.eventType;
    const documentId = document?.documentId;
    const documentStatus = document?.status;

    // Log callback
    const logEntry = {
      receivedAt: new Date().toISOString(),
      eventType,
      documentId,
      status: documentStatus,
      payload
    };
    boldSignCallbackLogs.unshift(logEntry);
    if (boldSignCallbackLogs.length > MAX_BOLDSIGN_CALLBACK_LOGS) {
      boldSignCallbackLogs.pop();
    }

    if (!documentId) {
      console.warn('⚠️ BoldSign webhook missing documentId');
      return res.status(200).json({ message: 'Missing documentId, ignoring' });
    }

    // Find request in database
    const findResult = await pool.request()
      .input('boldsign_document_id', sql.NVarChar, documentId)
      .query('SELECT id, form_id, signature_type FROM aufmass_esignature_requests WHERE boldsign_document_id = @boldsign_document_id');

    if (findResult.recordset.length === 0) {
      console.warn('⚠️ BoldSign webhook received for unknown document:', documentId);
      return res.status(200).json({ message: 'Document not found, ignoring' });
    }

    const request = findResult.recordset[0];

    // Map BoldSign status to our status
    let status = 'pending';
    if (eventType === 'Completed') {
      status = 'signed';
    } else if (eventType === 'Declined') {
      status = 'declined';
    } else if (eventType === 'Expired') {
      status = 'expired';
    } else if (eventType === 'Revoked') {
      status = 'cancelled';
    } else if (eventType === 'Sent') {
      status = 'pending';
    } else if (eventType === 'Viewed') {
      status = 'viewed';
    } else if (eventType === 'Signed') {
      status = 'signing';
    }

    // Update database
    const updateRequest = pool.request()
      .input('id', sql.Int, request.id)
      .input('status', sql.NVarChar, status)
      .input('callback_received_at', sql.DateTime, new Date());

    // If completed, download and store signed document
    if (eventType === 'Completed') {
      try {
        const downloadResponse = await fetch(`${BOLDSIGN_API_URL}/document/download?documentId=${documentId}`, {
          headers: { 'X-API-KEY': BOLDSIGN_API_KEY }
        });

        if (downloadResponse.ok) {
          const arrayBuffer = await downloadResponse.arrayBuffer();
          const signedDocument = Buffer.from(arrayBuffer);

          updateRequest.input('signed_document', sql.VarBinary, signedDocument);
          updateRequest.input('signed_at', sql.DateTime, new Date());

          await updateRequest.query(`
            UPDATE aufmass_esignature_requests
            SET status = @status, signed_document = @signed_document, signed_at = @signed_at,
                callback_received_at = @callback_received_at, updated_at = GETDATE()
            WHERE id = @id
          `);
        } else {
          await updateRequest.query(`
            UPDATE aufmass_esignature_requests
            SET status = @status, callback_received_at = @callback_received_at, updated_at = GETDATE()
            WHERE id = @id
          `);
        }
      } catch (downloadErr) {
        console.error('Failed to download signed document:', downloadErr);
        await updateRequest.query(`
          UPDATE aufmass_esignature_requests
          SET status = @status, callback_received_at = @callback_received_at, updated_at = GETDATE()
          WHERE id = @id
        `);
      }
    } else {
      await updateRequest.query(`
        UPDATE aufmass_esignature_requests
        SET status = @status, callback_received_at = @callback_received_at, updated_at = GETDATE()
        WHERE id = @id
      `);
    }

    console.log(`✅ BoldSign webhook processed: ${eventType} for document ${documentId}`);
    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (err) {
    console.error('BoldSign webhook error:', err);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Get BoldSign callback logs (for testing)
app.get('/api/boldsign/callback-log', (req, res) => {
  try {
    const { documentId, limit = 50 } = req.query;

    let logs = [...boldSignCallbackLogs];

    if (documentId) {
      logs = logs.filter(log => log.documentId === documentId);
    }

    logs = logs.slice(0, parseInt(limit));

    res.json({
      count: logs.length,
      logs
    });
  } catch (err) {
    console.error('[BoldSign Callback] Error retrieving logs:', err);
    res.status(500).json({ error: 'Failed to retrieve callback logs' });
  }
});

// ==================== LEAD / ANGEBOT API ====================

// Get all lead products (price matrix)
app.get('/api/lead-products', authenticateToken, async (req, res) => {
  try {
    const branchFilter = req.branchId ? 'WHERE branch_id = @branch_id OR branch_id IS NULL' : '';
    const request = pool.request();
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    const result = await request.query(`
      SELECT * FROM aufmass_lead_products
      ${branchFilter}
      ORDER BY product_name, breite, tiefe
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get lead products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get unique product names
app.get('/api/lead-products/names', authenticateToken, async (req, res) => {
  try {
    const branchFilter = req.branchId ? 'WHERE branch_id = @branch_id OR branch_id IS NULL' : '';
    const request = pool.request();
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    const result = await request.query(`
      SELECT DISTINCT product_name FROM aufmass_lead_products
      ${branchFilter}
      ORDER BY product_name
    `);
    res.json(result.recordset.map(r => r.product_name));
  } catch (err) {
    console.error('Get product names error:', err);
    res.status(500).json({ error: 'Failed to fetch product names' });
  }
});

// Get available dimensions for a product
app.get('/api/lead-products/:productName/dimensions', authenticateToken, async (req, res) => {
  try {
    const { productName } = req.params;
    const branchFilter = req.branchId ? 'AND (branch_id = @branch_id OR branch_id IS NULL)' : '';
    const request = pool.request()
      .input('product_name', sql.NVarChar, productName);
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    const result = await request.query(`
      SELECT breite, tiefe, price FROM aufmass_lead_products
      WHERE product_name = @product_name ${branchFilter}
      ORDER BY breite, tiefe
    `);

    // Group by breite, return available tiefe values
    const dimensions = {};
    result.recordset.forEach(row => {
      if (!dimensions[row.breite]) {
        dimensions[row.breite] = [];
      }
      dimensions[row.breite].push({ tiefe: row.tiefe, price: row.price });
    });

    res.json(dimensions);
  } catch (err) {
    console.error('Get dimensions error:', err);
    res.status(500).json({ error: 'Failed to fetch dimensions' });
  }
});

// Create a new lead
app.post('/api/leads', authenticateToken, async (req, res) => {
  try {
    const { customer_firstname, customer_lastname, customer_email, customer_phone, customer_address, notes, items, extras } = req.body;

    // Calculate total
    let total = 0;
    if (items) items.forEach(item => total += (item.unit_price * (item.quantity || 1)));
    if (extras) extras.forEach(extra => total += extra.price);

    // Insert lead
    const leadResult = await pool.request()
      .input('customer_firstname', sql.NVarChar, customer_firstname)
      .input('customer_lastname', sql.NVarChar, customer_lastname)
      .input('customer_email', sql.NVarChar, customer_email || null)
      .input('customer_phone', sql.NVarChar, customer_phone || null)
      .input('customer_address', sql.NVarChar, customer_address || null)
      .input('notes', sql.NVarChar, notes || null)
      .input('total_price', sql.Decimal(10, 2), total)
      .input('branch_id', sql.NVarChar, req.branchId || null)
      .input('created_by', sql.Int, req.user.id)
      .query(`
        INSERT INTO aufmass_leads (customer_firstname, customer_lastname, customer_email, customer_phone, customer_address, notes, total_price, status, branch_id, created_by)
        OUTPUT INSERTED.id
        VALUES (@customer_firstname, @customer_lastname, @customer_email, @customer_phone, @customer_address, @notes, @total_price, 'offen', @branch_id, @created_by)
      `);

    const leadId = leadResult.recordset[0].id;

    // Insert items
    if (items && items.length > 0) {
      for (const item of items) {
        await pool.request()
          .input('lead_id', sql.Int, leadId)
          .input('product_id', sql.Int, item.product_id || null)
          .input('product_name', sql.NVarChar, item.product_name)
          .input('breite', sql.Int, item.breite || null)
          .input('tiefe', sql.Int, item.tiefe || null)
          .input('quantity', sql.Int, item.quantity || 1)
          .input('unit_price', sql.Decimal(10, 2), item.unit_price)
          .input('total_price', sql.Decimal(10, 2), item.unit_price * (item.quantity || 1))
          .query(`
            INSERT INTO aufmass_lead_items (lead_id, product_id, product_name, breite, tiefe, quantity, unit_price, total_price)
            VALUES (@lead_id, @product_id, @product_name, @breite, @tiefe, @quantity, @unit_price, @total_price)
          `);
      }
    }

    // Insert extras
    if (extras && extras.length > 0) {
      for (const extra of extras) {
        await pool.request()
          .input('lead_id', sql.Int, leadId)
          .input('description', sql.NVarChar, extra.description)
          .input('price', sql.Decimal(10, 2), extra.price)
          .query(`
            INSERT INTO aufmass_lead_extras (lead_id, description, price)
            VALUES (@lead_id, @description, @price)
          `);
      }
    }

    res.status(201).json({ id: leadId, message: 'Lead created successfully' });
  } catch (err) {
    console.error('Create lead error:', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Get all leads
app.get('/api/leads', authenticateToken, async (req, res) => {
  try {
    const branchFilter = req.branchId ? 'WHERE l.branch_id = @branch_id' : '';
    const request = pool.request();
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    const result = await request.query(`
      SELECT l.*, u.name as created_by_name
      FROM aufmass_leads l
      LEFT JOIN aufmass_users u ON l.created_by = u.id
      ${branchFilter}
      ORDER BY l.created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get leads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get single lead with items and extras
app.get('/api/leads/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';
    const leadRequest = pool.request().input('id', sql.Int, id);
    if (req.branchId) {
      leadRequest.input('branch_id', sql.NVarChar, req.branchId);
    }
    const leadResult = await leadRequest.query(`SELECT * FROM aufmass_leads WHERE id = @id ${branchFilter}`);

    if (leadResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const itemsResult = await pool.request()
      .input('lead_id', sql.Int, id)
      .query('SELECT * FROM aufmass_lead_items WHERE lead_id = @lead_id');

    const extrasResult = await pool.request()
      .input('lead_id', sql.Int, id)
      .query('SELECT * FROM aufmass_lead_extras WHERE lead_id = @lead_id');

    res.json({
      ...leadResult.recordset[0],
      items: itemsResult.recordset,
      extras: extrasResult.recordset
    });
  } catch (err) {
    console.error('Get lead error:', err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Update lead status
app.put('/api/leads/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';
    const request = pool.request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status);
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }

    const result = await request.query(`
      UPDATE aufmass_leads SET status = @status, updated_at = GETDATE()
      WHERE id = @id ${branchFilter}
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead status updated' });
  } catch (err) {
    console.error('Update lead status error:', err);
    res.status(500).json({ error: 'Failed to update lead status' });
  }
});

// Delete lead
app.delete('/api/leads/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';
    const request = pool.request().input('id', sql.Int, id);
    if (req.branchId) {
      request.input('branch_id', sql.NVarChar, req.branchId);
    }
    await request.query(`DELETE FROM aufmass_leads WHERE id = @id ${branchFilter}`);
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    console.error('Delete lead error:', err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// ============ LEAD PDF STORAGE ============

// Lead PDF storage directory
const LEAD_PDF_DIR = path.join(PDF_DIR, 'leads');
if (!fs.existsSync(LEAD_PDF_DIR)) {
  fs.mkdirSync(LEAD_PDF_DIR, { recursive: true });
}

// Save generated PDF for a lead
app.post('/api/leads/:id/pdf', authenticateToken, upload.single('pdf'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    // Verify lead belongs to this branch
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';
    const verifyRequest = pool.request().input('id', sql.Int, id);
    if (req.branchId) {
      verifyRequest.input('branch_id', sql.NVarChar, req.branchId);
    }
    const verifyResult = await verifyRequest.query(`SELECT id FROM aufmass_leads WHERE id = @id ${branchFilter}`);
    if (verifyResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const pdfPath = path.join(LEAD_PDF_DIR, `${id}.pdf`);
    fs.writeFileSync(pdfPath, req.file.buffer);

    res.json({ message: 'Lead PDF saved successfully' });
  } catch (err) {
    console.error('Error saving lead PDF:', err);
    res.status(500).json({ error: 'Failed to save lead PDF' });
  }
});

// Get generated PDF for a lead
app.get('/api/leads/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify lead belongs to this branch
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';
    const verifyRequest = pool.request().input('id', sql.Int, id);
    if (req.branchId) {
      verifyRequest.input('branch_id', sql.NVarChar, req.branchId);
    }
    const verifyResult = await verifyRequest.query(`SELECT id FROM aufmass_leads WHERE id = @id ${branchFilter}`);
    if (verifyResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const pdfPath = path.join(LEAD_PDF_DIR, `${id}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'No PDF generated for this lead' });
    }

    const stats = fs.statSync(pdfPath);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="angebot_${id}.pdf"`,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error getting lead PDF:', err);
    res.status(500).json({ error: 'Failed to get lead PDF' });
  }
});

// Import products from price matrix (admin only)
app.post('/api/lead-products/import', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { products } = req.body; // Array of { product_name, breite, tiefe, price }

    let imported = 0;
    for (const product of products) {
      await pool.request()
        .input('product_name', sql.NVarChar, product.product_name)
        .input('breite', sql.Int, product.breite)
        .input('tiefe', sql.Int, product.tiefe)
        .input('price', sql.Decimal(10, 2), product.price)
        .input('branch_id', sql.NVarChar, req.branchId || null)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM aufmass_lead_products
            WHERE product_name = @product_name AND breite = @breite AND tiefe = @tiefe
            AND (branch_id = @branch_id OR (branch_id IS NULL AND @branch_id IS NULL))
          )
          INSERT INTO aufmass_lead_products (product_name, breite, tiefe, price, branch_id)
          VALUES (@product_name, @breite, @tiefe, @price, @branch_id)
        `);
      imported++;
    }

    res.json({ message: `Imported ${imported} products` });
  } catch (err) {
    console.error('Import products error:', err);
    res.status(500).json({ error: 'Failed to import products' });
  }
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
