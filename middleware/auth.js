const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization || req.headers.Authorization;
  const token = authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;

    const client = await pool.connect();
    try {
      const user = await client.query('SELECT id, role FROM students WHERE id = $1', [req.userId]);
      if (user.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }
      req.userRole = user.rows[0].role || 'student';
      next();
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { verifyToken };