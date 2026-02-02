import sql from 'mssql';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

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

async function addGlobalAdmin() {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    console.log('Connected to database');

    const email = 'ali.sanli@conais.com';
    const password = 'test@123';
    const name = 'Ali Sanli';
    const role = 'admin';

    // Check if user already exists
    const existing = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id, branch_id FROM aufmass_users WHERE email = @email');

    if (existing.recordset.length > 0) {
      // Update existing user: set branch_id to NULL (global), reset password, ensure admin
      const hashedPassword = await bcrypt.hash(password, 12);
      await pool.request()
        .input('email', sql.NVarChar, email)
        .input('password_hash', sql.NVarChar, hashedPassword)
        .input('name', sql.NVarChar, name)
        .query(`
          UPDATE aufmass_users
          SET password_hash = @password_hash,
              name = @name,
              role = 'admin',
              branch_id = NULL,
              is_active = 1
          WHERE email = @email
        `);
      console.log(`Updated existing user: ${email} -> global admin (branch_id = NULL)`);
    } else {
      // Create new user with branch_id = NULL (global access)
      const hashedPassword = await bcrypt.hash(password, 12);
      await pool.request()
        .input('email', sql.NVarChar, email)
        .input('password_hash', sql.NVarChar, hashedPassword)
        .input('name', sql.NVarChar, name)
        .input('role', sql.NVarChar, role)
        .query(`
          INSERT INTO aufmass_users (email, password_hash, name, role, branch_id)
          VALUES (@email, @password_hash, @name, @role, NULL)
        `);
      console.log(`Created global admin: ${email} (branch_id = NULL)`);
    }

    // Verify
    const verify = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id, email, name, role, branch_id, is_active FROM aufmass_users WHERE email = @email');

    console.log('\nUser details:', verify.recordset[0]);
    console.log('\nThis user can log in from ALL branches (branch_id = NULL = global access)');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (pool) await pool.close();
  }
}

addGlobalAdmin();
