require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const crimeRoutes = require('./routes/crimeRoutes');
const suspectRoutes = require('./routes/suspectRoutes');
const caseRoutes = require('./routes/caseRoutes');
const searchRoutes = require('./routes/searchRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/crimes', crimeRoutes);
app.use('/api/suspects', suspectRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Crime Tracking System API is running.', time: new Date().toISOString() });
});

// ---- Serve frontend (Presentation Layer) ----
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'pages', 'login.html'));
});

// ---- Global error handler ----
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚓 Crime Tracking System server running on http://localhost:${PORT}`);
});
