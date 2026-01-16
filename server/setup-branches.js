import sql from 'mssql';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

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

// All branches from the image (15 subdomains)
const branches = [
  { slug: 'aylux', name: 'AYLUX Zentrale' },
  { slug: 'ayluxa', name: 'AYLUX A' },
  { slug: 'ayluxb', name: 'AYLUX B' },
  { slug: 'ayluxbr', name: 'AYLUX Bremen' },
  { slug: 'ayluxd', name: 'AYLUX Dortmund' },
  { slug: 'ayluxf', name: 'AYLUX Frankfurt' },
  { slug: 'ayluxgkmu', name: 'AYLUX GKMU' },
  { slug: 'ayluxha', name: 'AYLUX Hannover' },
  { slug: 'ayluxhh', name: 'AYLUX Hamburg' },
  { slug: 'ayluxl', name: 'AYLUX Leipzig' },
  { slug: 'ayluxma', name: 'AYLUX Mannheim' },
  { slug: 'ayluxmau', name: 'AYLUX MAU' },
  { slug: 'ayluxs', name: 'AYLUX Stuttgart' },
  { slug: 'ayluxtr', name: 'AYLUX Trier' },
  { slug: 'ayluxus', name: 'AYLUX US' }
];

// Generate credentials for each branch
function generateCredentials(slug) {
  // Format: admin@{slug}.cnsform.com
  // Password: Aylux{Slug}2024!
  const capitalizedSlug = slug.charAt(0).toUpperCase() + slug.slice(1);
  return {
    email: `admin@${slug}.cnsform.com`,
    password: `Aylux${capitalizedSlug}2024!`,
    name: `Admin ${capitalizedSlug}`
  };
}

async function setupBranches() {
  let pool;

  try {
    console.log('Connecting to database...');
    pool = await sql.connect(dbConfig);
    console.log('Connected to Azure SQL Database');

    const results = [];

    for (const branch of branches) {
      console.log(`\nProcessing branch: ${branch.slug}`);

      // 1. Check if branch exists
      const branchCheck = await pool.request()
        .input('slug', sql.NVarChar, branch.slug)
        .query('SELECT id FROM aufmass_branches WHERE slug = @slug');

      if (branchCheck.recordset.length === 0) {
        // Insert new branch
        await pool.request()
          .input('slug', sql.NVarChar, branch.slug)
          .input('name', sql.NVarChar, branch.name)
          .query('INSERT INTO aufmass_branches (slug, name) VALUES (@slug, @name)');
        console.log(`  Branch created: ${branch.slug}`);
      } else {
        console.log(`  Branch already exists: ${branch.slug}`);
      }

      // 2. Create admin user for this branch
      const creds = generateCredentials(branch.slug);

      // Check if admin already exists for this branch
      const userCheck = await pool.request()
        .input('email', sql.NVarChar, creds.email)
        .input('branch_id', sql.NVarChar, branch.slug)
        .query('SELECT id FROM aufmass_users WHERE email = @email AND branch_id = @branch_id');

      if (userCheck.recordset.length === 0) {
        // Hash password and create user
        const hashedPassword = await bcrypt.hash(creds.password, 12);

        await pool.request()
          .input('email', sql.NVarChar, creds.email)
          .input('password_hash', sql.NVarChar, hashedPassword)
          .input('name', sql.NVarChar, creds.name)
          .input('role', sql.NVarChar, 'admin')
          .input('branch_id', sql.NVarChar, branch.slug)
          .query(`
            INSERT INTO aufmass_users (email, password_hash, name, role, branch_id)
            VALUES (@email, @password_hash, @name, @role, @branch_id)
          `);
        console.log(`  Admin user created: ${creds.email}`);
      } else {
        console.log(`  Admin user already exists: ${creds.email}`);
      }

      results.push({
        branch: branch.slug,
        name: branch.name,
        url: `https://${branch.slug}.cnsform.com`,
        email: creds.email,
        password: creds.password
      });
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('SETUP COMPLETE - CREDENTIALS SUMMARY');
    console.log('='.repeat(80));
    console.log('\n| Branch | URL | Email | Password |');
    console.log('|--------|-----|-------|----------|');

    for (const r of results) {
      console.log(`| ${r.branch} | ${r.url} | ${r.email} | ${r.password} |`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('All branches and admin users have been set up successfully!');
    console.log('='.repeat(80));

    return results;

  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Run the setup
setupBranches()
  .then(() => {
    console.log('\nSetup completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nSetup failed:', err.message);
    process.exit(1);
  });
