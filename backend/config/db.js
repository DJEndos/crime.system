const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crime_tracking_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Quick connectivity check on boot
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected:', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in your .env file.');
  }
})();

module.exports = pool;
