/**
 * Seeds the default administrator account.
 * Run AFTER importing schema.sql:
 *    npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  const fullName = process.env.SEED_ADMIN_FULLNAME || 'System Administrator';
  const badge = process.env.SEED_ADMIN_BADGE || 'ADM-001';

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      console.log(`ℹ️  Admin user "${username}" already exists. Skipping.`);
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (badge_number, full_name, username, password_hash, role, officer_rank, station)
       VALUES (?, ?, ?, ?, 'admin', 'Superintendent', 'Ikot Udota Division, Eket')`,
      [badge, fullName, username, hash]
    );

    console.log('✅ Default admin account created:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log('   ⚠️  Log in and change this password immediately.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

seed();
