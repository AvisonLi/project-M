const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

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
      let client = await pool.connect();
      const user = await client.query('SELECT role FROM students WHERE id = $1', [req.userId]);
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

  // Get own profile (student)
  router.get('/me', verifyToken, async (req, res) => {
    const studentId = req.userId;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT id, name, email, created_at, updated_at FROM students WHERE id = $1`,
        [studentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Get enrollment count
      const enrollmentCount = await client.query(
        'SELECT COUNT(*) as count FROM enrollments WHERE student_id = $1',
        [studentId]
      );

      const student = result.rows[0];
      student.enrolledCoursesCount = parseInt(enrollmentCount.rows[0].count, 10);

      res.json({ student });
    } catch (err) {
      console.error('Error fetching own profile:', err);
      res.status(500).json({ error: 'Server error fetching profile' });
    } finally {
      if (client) client.release();
    }
  });

  // Get specific student profile (admin only)
  router.get('/:studentId', async (req, res) => {
    const { studentId } = req.params;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT id, name, email, created_at, updated_at FROM students WHERE id = $1`,
        [studentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Get enrollment statistics
      const enrollmentCount = await client.query(
        'SELECT COUNT(*) as count FROM enrollments WHERE student_id = $1',
        [studentId]
      );

      const gradeStats = await client.query(
        `SELECT COUNT(*) as count, AVG(gpa) as avg_gpa FROM grades WHERE student_id = $1`,
        [studentId]
      );

      const student = result.rows[0];
      student.enrolledCoursesCount = parseInt(enrollmentCount.rows[0].count, 10);
      student.gradesCount = parseInt(gradeStats.rows[0].count, 10);
      student.averageGpa = gradeStats.rows[0].avg_gpa
        ? parseFloat(gradeStats.rows[0].avg_gpa).toFixed(2)
        : null;

      res.json({ student });
    } catch (err) {
      console.error('Error fetching student profile:', err);
      res.status(500).json({ error: 'Server error fetching profile' });
    } finally {
      if (client) client.release();
    }
  });

  // Update own profile
  router.put('/me/update', verifyToken, async (req, res) => {
    const studentId = req.userId;
    const { name, email } = req.body;

    if (!name && !email) {
      return res.status(400).json({ error: 'At least one field (name or email) is required' });
    }

    let client;
    try {
      client = await pool.connect();

      // If email is being updated, check if it's already in use
      if (email) {
        const existingEmail = await client.query(
          'SELECT id FROM students WHERE email = $1 AND id != $2',
          [email, studentId]
        );

        if (existingEmail.rows.length > 0) {
          return res.status(409).json({ error: 'Email already in use' });
        }
      }

      // Build dynamic update query
      let query = 'UPDATE students SET ';
      const params = [];
      const updates = [];

      if (name) {
        updates.push(`name = $${params.length + 1}`);
        params.push(name);
      }

      if (email) {
        updates.push(`email = $${params.length + 1}`);
        params.push(email);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      query += updates.join(', ');
      query += ` WHERE id = $${params.length + 1} RETURNING id, name, email, created_at, updated_at`;
      params.push(studentId);

      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      res.json({
        message: 'Profile updated successfully',
        student: result.rows[0],
      });
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Server error updating profile' });
    } finally {
      if (client) client.release();
    }
  });

  // Update student profile (admin)
  router.put('/:studentId/admin-update', async (req, res) => {
    const { studentId } = req.params;
    const { name, email } = req.body;

    if (!name && !email) {
      return res.status(400).json({ error: 'At least one field (name or email) is required' });
    }

    let client;
    try {
      client = await pool.connect();

      // If email is being updated, check if it's already in use
      if (email) {
        const existingEmail = await client.query(
          'SELECT id FROM students WHERE email = $1 AND id != $2',
          [email, studentId]
        );

        if (existingEmail.rows.length > 0) {
          return res.status(409).json({ error: 'Email already in use' });
        }
      }

      // Build dynamic update query
      let query = 'UPDATE students SET ';
      const params = [];
      const updates = [];

      if (name) {
        updates.push(`name = $${params.length + 1}`);
        params.push(name);
      }

      if (email) {
        updates.push(`email = $${params.length + 1}`);
        params.push(email);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      query += updates.join(', ');
      query += ` WHERE id = $${params.length + 1} RETURNING id, name, email, created_at, updated_at`;
      params.push(studentId);

      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      res.json({
        message: 'Student profile updated successfully',
        student: result.rows[0],
      });
    } catch (err) {
      console.error('Admin profile update error:', err);
      res.status(500).json({ error: 'Server error updating profile' });
    } finally {
      if (client) client.release();
    }
  });

  // Change password
  router.post('/me/change-password', verifyToken, async (req, res) => {
    const studentId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    let client;
    try {
      client = await pool.connect();

      const result = await client.query('SELECT password_hash FROM students WHERE id = $1', [studentId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      await client.query('UPDATE students SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
        hashedNewPassword,
        studentId,
      ]);

      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error('Password change error:', err);
      res.status(500).json({ error: 'Server error changing password' });
    } finally {
      if (client) client.release();
    }
  });

  // Get profile statistics (dashboard data)
  router.get('/me/statistics', verifyToken, async (req, res) => {
    const studentId = req.userId;

    let client;
    try {
      client = await pool.connect();

      // Get basic student info
      const student = await client.query('SELECT id, name, email FROM students WHERE id = $1', [studentId]);

      if (student.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Get enrollment count
      const enrollmentCount = await client.query(
        'SELECT COUNT(*) as count FROM enrollments WHERE student_id = $1',
        [studentId]
      );

      // Get grade statistics
      const gradeStats = await client.query(
        `SELECT 
          COUNT(*) as total_grades,
          AVG(gpa) as average_gpa,
          MAX(gpa) as highest_gpa,
          MIN(gpa) as lowest_gpa
         FROM grades WHERE student_id = $1`,
        [studentId]
      );

      // Get recent enrollments
      const recentEnrollments = await client.query(
        `SELECT c.id, c.code, c.title, e.created_at
         FROM courses c
         INNER JOIN enrollments e ON c.id = e.course_id
         WHERE e.student_id = $1
         ORDER BY e.created_at DESC
         LIMIT 5`,
        [studentId]
      );

      const stats = gradeStats.rows[0];

      res.json({
        student: student.rows[0],
        statistics: {
          enrolledCoursesCount: parseInt(enrollmentCount.rows[0].count, 10),
          totalGrades: parseInt(stats.total_grades, 10),
          averageGpa: stats.average_gpa ? parseFloat(stats.average_gpa).toFixed(2) : null,
          highestGpa: stats.highest_gpa ? parseFloat(stats.highest_gpa).toFixed(2) : null,
          lowestGpa: stats.lowest_gpa ? parseFloat(stats.lowest_gpa).toFixed(2) : null,
        },
        recentEnrollments: recentEnrollments.rows,
      });
    } catch (err) {
      console.error('Error fetching statistics:', err);
      res.status(500).json({ error: 'Server error fetching statistics' });
    } finally {
      if (client) client.release();
    }
  });

  return router;
};
