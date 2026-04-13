const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const Redis = require('ioredis');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3001' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Routes
app.use('/api/auth', require('./routes/auth')(pool));
app.use('/api/register', require('./routes/registration')(pool, redis));
app.use('/api/registration', require('./routes/registration')(pool, redis));
app.use('/api/grades', require('./routes/grades')(pool));
app.use('/api/profile', require('./routes/profile')(pool));
app.use('/api/admin', require('./routes/admin')(pool));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/assessments', require('./routes/assessments'));
app.use('/api/student', require('./routes/student'));
app.use('/api/sso', require('./routes/sso'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 3000;

const server = http.createServer({ maxHeaderSize: 65536 }, app);
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📚 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
});

module.exports = { app, pool, redis };
