const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

module.exports = (pool) => {
  const router = express.Router();

  // Middleware for JWT verification
  const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.id;

      // Fetch user role
      const client = await pool.connect();
      const user = await client.query('SELECT id, role FROM students WHERE id = $1', [req.userId]);
      client.release();

      if (user.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.userRole = user.rows[0].role || 'student';
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  // Login endpoint
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let client;
    try {
      client = await pool.connect();
      const user = await client.query('SELECT id, name, email, password_hash, role, student_id FROM students WHERE email = $1', [
        email,
      ]);

      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const student = user.rows[0];
      const validPassword = await bcrypt.compare(password, student.password_hash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: student.id, email: student.email }, process.env.JWT_SECRET, {
        expiresIn: '24h',
      });

      res.json({
        message: 'Login successful',
        token,
        student: {
          id: student.id,
          student_id: student.student_id,
          name: student.name,
          email: student.email,
          role: student.role || 'student',
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error during login' });
    } finally {
      if (client) client.release();
    }
  });

  // Register endpoint (create new student account)
  router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    let client;
    try {
      client = await pool.connect();

      // Check if email already exists
      const existingUser = await client.query('SELECT id FROM students WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new student
      const result = await client.query(
        'INSERT INTO students (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
        [name, email, hashedPassword]
      );

      const student = result.rows[0];
      const token = jwt.sign({ id: student.id, email: student.email }, process.env.JWT_SECRET, {
        expiresIn: '24h',
      });

      res.status(201).json({
        message: 'Registration successful',
        token,
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          role: 'student',
        },
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Server error during registration' });
    } finally {
      if (client) client.release();
    }
  });

  // Verify token endpoint
  router.post('/verify', verifyToken, async (req, res) => {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query('SELECT id, name, email FROM students WHERE id = $1', [req.userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        message: 'Token is valid',
        student: result.rows[0],
      });
    } catch (err) {
      console.error('Verify error:', err);
      res.status(500).json({ error: 'Server error during verification' });
    } finally {
      if (client) client.release();
    }
  });

  return router;
};
