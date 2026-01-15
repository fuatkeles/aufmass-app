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

    // Branch-specific login: only allow users from the same branch
    const branchFilter = req.branchId ? 'AND branch_id = @branch_id' : '';
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
        f.id, f.datum, f.aufmasser, f.kunde_vorname, f.kunde_nachname, f.kunde_email,
        f.kundenlokation, f.category, f.product_type, f.model, f.specifications,
        f.markise_data, f.bemerkungen, f.status, f.created_by, f.created_at, f.updated_at,
        f.montage_datum, f.status_date, f.pdf_generated_at, f.branch_id, f.papierkorb_date,
        (SELECT COUNT(*) FROM aufmass_bilder WHERE form_id = f.id AND file_type LIKE 'image/%') as image_count,
        (SELECT COUNT(*) FROM aufmass_bilder WHERE form_id = f.id AND (file_type = 'application/pdf' OR file_name LIKE '%.pdf')) as pdf_count
      FROM aufmass_forms f
      ${branchFilter}
      ORDER BY f.created_at DESC
    `);

    // Get PDF files and media files for each form
    const formsWithFiles = await Promise.all(result.recordset.map(async (form) => {
      const formData = { ...form, pdf_files: [], media_files: [] };

      // Get PDF files
      if (form.pdf_count > 0) {
        const pdfs = await pool.request()
          .input('form_id', sql.Int, form.id)
          .query(`
            SELECT id, file_name, file_type
            FROM aufmass_bilder
            WHERE form_id = @form_id AND (file_type = 'application/pdf' OR file_name LIKE '%.pdf')
          `);
        formData.pdf_files = pdfs.recordset;
      }

      // Get media files (images and videos)
      if (form.image_count > 0) {
        const media = await pool.request()
          .input('form_id', sql.Int, form.id)
          .query(`
            SELECT id, file_name, file_type
            FROM aufmass_bilder
            WHERE form_id = @form_id AND file_type LIKE 'image/%'
          `);
        formData.media_files = media.recordset;
      }

      // Also get video files
      const videos = await pool.request()
        .input('form_id', sql.Int, form.id)
        .query(`
          SELECT id, file_name, file_type
          FROM aufmass_bilder
          WHERE form_id = @form_id AND file_type LIKE 'video/%'
        `);
      if (videos.recordset.length > 0) {
        formData.media_files = [...formData.media_files, ...videos.recordset];
      }

      return formData;
    }));

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
      SELECT id, datum, aufmasser, kunde_vorname, kunde_nachname, kunde_email,
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
      kundenlokation,
      category,
      productType,
      model,
      specifications,
      markiseData,
      bemerkungen,
      status,
      weitereProdukte
    } = req.body;

    // Auto-set status_date to form datum (Aufmaß date) when form is created
    // Set branch_id from subdomain detection
    const result = await pool.request()
      .input('datum', sql.Date, datum)
      .input('aufmasser', sql.NVarChar, aufmasser)
      .input('kunde_vorname', sql.NVarChar, kundeVorname)
      .input('kunde_nachname', sql.NVarChar, kundeNachname)
      .input('kunde_email', sql.NVarChar, kundeEmail || null)
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
      .query(`
        INSERT INTO aufmass_forms
        (datum, aufmasser, kunde_vorname, kunde_nachname, kunde_email, kundenlokation, category, product_type, model, specifications, markise_data, bemerkungen, status, status_date, branch_id, created_by)
        OUTPUT INSERTED.id
        VALUES (@datum, @aufmasser, @kunde_vorname, @kunde_nachname, @kunde_email, @kundenlokation, @category, @product_type, @model, @specifications, @markise_data, @bemerkungen, @status, @status_date, @branch_id, @created_by)
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

    // Update database to mark PDF as generated
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE aufmass_forms
        SET pdf_generated_at = GETDATE(), updated_at = GETDATE()
        WHERE id = @id
      `);

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
app.post('/api/montageteams', authenticateToken, async (req, res) => {
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
app.put('/api/montageteams/:id', authenticateToken, async (req, res) => {
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
app.delete('/api/montageteams/:id', authenticateToken, async (req, res) => {
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

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
