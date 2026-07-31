/**
 * Seeds the default administrator account.
 * Run AFTER your MongoDB Atlas connection is set up:
 *    npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

async function seed() {
  const username = (process.env.SEED_ADMIN_USERNAME || 'admin').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  const fullName = process.env.SEED_ADMIN_FULLNAME || 'System Administrator';
  const badge = process.env.SEED_ADMIN_BADGE || 'ADM-001';

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB for seeding.');

    const existing = await User.findOne({ username });
    if (existing) {
      console.log(`ℹ️  Admin user "${username}" already exists. Skipping.`);
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 10);
    await User.create({
      badge_number: badge,
      full_name: fullName,
      username,
      password_hash: hash,
      role: 'admin',
      officer_rank: 'Superintendent',
      station: 'Ikot Udota Division, Eket'
    });

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
