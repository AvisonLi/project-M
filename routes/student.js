const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

router.get('/profile', verifyToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const profile = await client.query(
      `SELECT id, student_id, name, email, phone, address, date_of_birth, major, year, gpa
       FROM students WHERE id = $1`,
      [req.userId]
    );
    if (profile.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: profile.rows[0] });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Server error fetching profile' });
  } finally {
    if (client) client.release();
  }
});

// Update student profile
router.put('/profile', verifyToken, async (req, res) => {
  const { name, email, phone, address, dateOfBirth, major, year } = req.body;

  let client;
  try {
    client = await pool.connect();

    // Check if email is already in use by another user
    if (email) {
      const emailExists = await client.query(
        'SELECT id FROM students WHERE email = $1 AND id != $2',
        [email, req.userId]
      );
      if (emailExists.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

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

    if (phone !== undefined) {
      updates.push(`phone = $${params.length + 1}`);
      params.push(phone);
    }

    if (address !== undefined) {
      updates.push(`address = $${params.length + 1}`);
      params.push(address);
    }

    if (dateOfBirth) {
      updates.push(`date_of_birth = $${params.length + 1}`);
      params.push(dateOfBirth);
    }

    if (major !== undefined) {
      updates.push(`major = $${params.length + 1}`);
      params.push(major);
    }

    if (year !== undefined) {
      updates.push(`year = $${params.length + 1}`);
      params.push(year);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    query += updates.join(', ');
    query += ` WHERE id = $${params.length + 1} RETURNING id, student_id, name, email, phone, address, date_of_birth, major, year, gpa, credits_earned, profile_picture_url, is_active, last_login, created_at, updated_at`;
    params.push(req.userId);

    const result = await client.query(query, params);

    res.json({
      message: 'Profile updated successfully',
      profile: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  } finally {
    if (client) client.release();
  }
});

// Change password
router.put('/password', verifyToken, async (req, res) => {
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

    // Get current password hash
    const user = await client.query(
      'SELECT password_hash FROM students WHERE id = $1',
      [req.userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await client.query(
      'UPDATE students SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Server error changing password' });
  } finally {
    if (client) client.release();
  }
});

// Get academic history
router.get('/academic-history', verifyToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();

    // Get completed courses from academic_history table
    const history = await client.query(
      `SELECT * FROM academic_history
       WHERE student_id = $1
       ORDER BY year DESC, semester DESC, course_code ASC`,
      [req.userId]
    );

    // Calculate GPA
    const completedCourses = history.rows.filter(course => course.status === 'completed' && course.gpa);
    const totalCredits = completedCourses.reduce((sum, course) => sum + (course.credits || 3), 0);
    const totalPoints = completedCourses.reduce((sum, course) => sum + (course.gpa * (course.credits || 3)), 0);
    const cumulativeGPA = totalCredits > 0 ? totalPoints / totalCredits : 0;

    res.json({
      history: history.rows,
      summary: {
        totalCredits,
        cumulativeGPA: Math.round(cumulativeGPA * 100) / 100,
        completedCourses: completedCourses.length
      }
    });
  } catch (err) {
    console.error('Error fetching academic history:', err);
    res.status(500).json({ error: 'Server error fetching academic history' });
  } finally {
    if (client) client.release();
  }
});

// Get current semester courses with grades
router.get('/current-grades', verifyToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();

    // Get current enrollments with grades
    const currentCourses = await client.query(
      `SELECT e.*, c.code, c.title, c.credits, c.semester, c.year,
              g.grade, g.gpa, g.is_posted, g.feedback
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       LEFT JOIN grades g ON e.student_id = g.student_id AND e.course_id = g.course_id
       WHERE e.student_id = $1 AND e.status = 'enrolled'
       ORDER BY c.code ASC`,
      [req.userId]
    );

    res.json({ courses: currentCourses.rows });
  } catch (err) {
    console.error('Error fetching current grades:', err);
    res.status(500).json({ error: 'Server error fetching current grades' });
  } finally {
    if (client) client.release();
  }
});

// Upload profile picture (placeholder - would need file upload handling)
router.post('/profile-picture', verifyToken, async (req, res) => {
  // This would need proper file upload handling with multer
  // For now, just return a placeholder response
  res.json({
    message: 'Profile picture upload not implemented yet',
    profilePictureUrl: null
  });
});

// Get student statistics
router.get('/statistics', verifyToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();

    // Get enrollment statistics
    const enrollmentStats = await client.query(
      `SELECT
        COUNT(*) as total_enrollments,
        COUNT(CASE WHEN status = 'enrolled' THEN 1 END) as current_enrollments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_courses
       FROM enrollments WHERE student_id = $1`,
      [req.userId]
    );

    // Get grade statistics
    const gradeStats = await client.query(
      `SELECT
        COUNT(*) as graded_courses,
        AVG(gpa) as average_gpa,
        MIN(gpa) as lowest_gpa,
        MAX(gpa) as highest_gpa
       FROM grades WHERE student_id = $1 AND gpa IS NOT NULL`,
      [req.userId]
    );

    // Get attendance statistics
    const attendanceStats = await client.query(
      `SELECT
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN ar.id IS NOT NULL THEN 1 END) as attended_sessions,
        ROUND(
          CASE WHEN COUNT(ar.id) > 0
          THEN (COUNT(ar.id)::decimal / COUNT(*)::decimal) * 100
          ELSE 0 END, 2
        ) as attendance_percentage
       FROM attendance_sessions ats
       JOIN enrollments e ON ats.course_id = e.course_id
       LEFT JOIN attendance_records ar ON ats.id = ar.session_id AND ar.student_id = e.student_id
       WHERE e.student_id = $1 AND e.status = 'enrolled'`,
      [req.userId]
    );

    res.json({
      enrollmentStats: enrollmentStats.rows[0],
      gradeStats: gradeStats.rows[0],
      attendanceStats: attendanceStats.rows[0]
    });
  } catch (err) {
    console.error('Error fetching student statistics:', err);
    res.status(500).json({ error: 'Server error fetching statistics' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;