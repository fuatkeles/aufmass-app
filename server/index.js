import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import dotenv from 'dotenv';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
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
        kundenlokation NVARCHAR(255) NOT NULL,
        category NVARCHAR(100) NOT NULL,
        product_type NVARCHAR(100) NOT NULL,
        model NVARCHAR(100) NOT NULL,
        specifications NVARCHAR(MAX),
        markise_data NVARCHAR(MAX),
        bemerkungen NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'draft',
        created_by INT,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
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

    // Add created_by column to aufmass_forms if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('aufmass_forms') AND name = 'created_by')
      BEGIN
        ALTER TABLE aufmass_forms ADD created_by INT NULL
      END
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
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

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

// ============ AUTH ROUTES ============

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .query('SELECT * FROM aufmass_users WHERE email = @email AND is_active = 1');

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

// Get all users
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT id, email, name, role, is_active, last_login, created_at
      FROM aufmass_users
      ORDER BY created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create invitation
app.post('/api/invitations', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Check if user already exists
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .query('SELECT id FROM aufmass_users WHERE email = @email');

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check for existing valid invitation
    const existingInvite = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .query('SELECT id FROM aufmass_invitations WHERE email = @email AND used_at IS NULL AND expires_at > GETDATE()');

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
      .query(`
        INSERT INTO aufmass_invitations (token, email, role, invited_by, expires_at)
        VALUES (@token, @email, @role, @invited_by, @expires_at)
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

// Get all invitations
app.get('/api/invitations', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT i.*, u.name as invited_by_name
      FROM aufmass_invitations i
      LEFT JOIN aufmass_users u ON i.invited_by = u.id
      ORDER BY i.created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get invitations error:', err);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Delete invitation
app.delete('/api/invitations/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM aufmass_invitations WHERE id = @id');
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

    // Create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.request()
      .input('email', sql.NVarChar, invite.email)
      .input('password_hash', sql.NVarChar, hashedPassword)
      .input('name', sql.NVarChar, name)
      .input('role', sql.NVarChar, invite.role)
      .query(`
        INSERT INTO aufmass_users (email, password_hash, name, role)
        OUTPUT INSERTED.id
        VALUES (@email, @password_hash, @name, @role)
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

// Update user (Admin only)
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, role, is_active } = req.body;
    const userId = parseInt(req.params.id);

    // Prevent admin from deactivating themselves
    if (userId === req.user.id && is_active === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    await pool.request()
      .input('id', sql.Int, userId)
      .input('name', sql.NVarChar, name)
      .input('role', sql.NVarChar, role)
      .input('is_active', sql.Bit, is_active)
      .query(`
        UPDATE aufmass_users SET
          name = @name,
          role = @role,
          is_active = @is_active,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (Admin only)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await pool.request()
      .input('id', sql.Int, userId)
      .query('DELETE FROM aufmass_users WHERE id = @id');

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

// Get all forms
app.get('/api/forms', authenticateToken, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT * FROM aufmass_forms ORDER BY created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching forms:', err);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// Get single form by ID
app.get('/api/forms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM aufmass_forms WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Get images for this form
    const images = await pool.request()
      .input('form_id', sql.Int, id)
      .query('SELECT id, file_name, file_type FROM aufmass_bilder WHERE form_id = @form_id');

    res.json({
      ...result.recordset[0],
      bilder: images.recordset
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
      kundenlokation,
      category,
      productType,
      model,
      specifications,
      markiseData,
      bemerkungen,
      status
    } = req.body;

    const result = await pool.request()
      .input('datum', sql.Date, datum)
      .input('aufmasser', sql.NVarChar, aufmasser)
      .input('kunde_vorname', sql.NVarChar, kundeVorname)
      .input('kunde_nachname', sql.NVarChar, kundeNachname)
      .input('kundenlokation', sql.NVarChar, kundenlokation)
      .input('category', sql.NVarChar, category)
      .input('product_type', sql.NVarChar, productType)
      .input('model', sql.NVarChar, model)
      .input('specifications', sql.NVarChar, JSON.stringify(specifications || {}))
      .input('markise_data', sql.NVarChar, JSON.stringify(markiseData || null))
      .input('bemerkungen', sql.NVarChar, bemerkungen || '')
      .input('status', sql.NVarChar, status || 'draft')
      .input('created_by', sql.Int, req.user.id)
      .query(`
        INSERT INTO aufmass_forms
        (datum, aufmasser, kunde_vorname, kunde_nachname, kundenlokation, category, product_type, model, specifications, markise_data, bemerkungen, status, created_by)
        OUTPUT INSERTED.id
        VALUES (@datum, @aufmasser, @kunde_vorname, @kunde_nachname, @kundenlokation, @category, @product_type, @model, @specifications, @markise_data, @bemerkungen, @status, @created_by)
      `);

    const newId = result.recordset[0].id;
    res.status(201).json({ id: newId, message: 'Form created successfully' });
  } catch (err) {
    console.error('Error creating form:', err);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

// Update form
app.put('/api/forms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      datum,
      aufmasser,
      kundeVorname,
      kundeNachname,
      kundenlokation,
      category,
      productType,
      model,
      specifications,
      markiseData,
      bemerkungen,
      status
    } = req.body;

    await pool.request()
      .input('id', sql.Int, id)
      .input('datum', sql.Date, datum)
      .input('aufmasser', sql.NVarChar, aufmasser)
      .input('kunde_vorname', sql.NVarChar, kundeVorname)
      .input('kunde_nachname', sql.NVarChar, kundeNachname)
      .input('kundenlokation', sql.NVarChar, kundenlokation)
      .input('category', sql.NVarChar, category)
      .input('product_type', sql.NVarChar, productType)
      .input('model', sql.NVarChar, model)
      .input('specifications', sql.NVarChar, JSON.stringify(specifications || {}))
      .input('markise_data', sql.NVarChar, JSON.stringify(markiseData || null))
      .input('bemerkungen', sql.NVarChar, bemerkungen || '')
      .input('status', sql.NVarChar, status || 'draft')
      .query(`
        UPDATE aufmass_forms SET
          datum = @datum,
          aufmasser = @aufmasser,
          kunde_vorname = @kunde_vorname,
          kunde_nachname = @kunde_nachname,
          kundenlokation = @kundenlokation,
          category = @category,
          product_type = @product_type,
          model = @model,
          specifications = @specifications,
          markise_data = @markise_data,
          bemerkungen = @bemerkungen,
          status = @status,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    res.json({ message: 'Form updated successfully' });
  } catch (err) {
    console.error('Error updating form:', err);
    res.status(500).json({ error: 'Failed to update form' });
  }
});

// Delete form
app.delete('/api/forms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM aufmass_forms WHERE id = @id');

    res.json({ message: 'Form deleted successfully' });
  } catch (err) {
    console.error('Error deleting form:', err);
    res.status(500).json({ error: 'Failed to delete form' });
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
    const total = await pool.request().query('SELECT COUNT(*) as count FROM aufmass_forms');
    const completed = await pool.request().query("SELECT COUNT(*) as count FROM aufmass_forms WHERE status = 'completed'");
    const draft = await pool.request().query("SELECT COUNT(*) as count FROM aufmass_forms WHERE status = 'draft'");

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
        ISNULL(f.completed, 0) as completed,
        ISNULL(f.draft, 0) as draft
      FROM aufmass_montageteams m
      LEFT JOIN (
        SELECT
          JSON_VALUE(specifications, '$.montageteam') as team_name,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft
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
    const result = await pool.request().query(`
      SELECT * FROM aufmass_montageteams ORDER BY name ASC
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
      .query(`
        INSERT INTO aufmass_montageteams (name)
        OUTPUT INSERTED.*
        VALUES (@name)
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

// Update montageteam
app.put('/api/montageteams/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('is_active', sql.Bit, is_active !== undefined ? is_active : true)
      .query(`
        UPDATE aufmass_montageteams SET
          name = @name,
          is_active = @is_active
        WHERE id = @id
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

// Delete montageteam
app.delete('/api/montageteams/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM aufmass_montageteams WHERE id = @id');

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
