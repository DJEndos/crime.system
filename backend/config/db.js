const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected:', mongoose.connection.name);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('   Check MONGODB_URI in your .env file / Render environment variables.');
  }
}

module.exports = connectDB;
