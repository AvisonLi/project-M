const express = require('express');
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

  // Add or update grade for a student (admin/faculty only)
  router.post('/add', verifyToken, async (req, res) => {
    const { studentId, courseId, grade, gpa } = req.body;

    if (!studentId || !courseId || !grade || gpa === undefined) {
      return res.status(400).json({ error: 'Student ID, course ID, grade, and GPA are required' });
    }

    if (gpa < 0 || gpa > 4.0) {
      return res.status(400).json({ error: 'GPA must be between 0 and 4.0' });
    }

    const validGrades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    if (!validGrades.includes(grade)) {
      return res.status(400).json({ error: `Grade must be one of: ${validGrades.join(', ')}` });
    }

    let client;
    try {
      client = await pool.connect();

      // Check if student is enrolled in the course
      const enrollment = await client.query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [studentId, courseId]
      );

      if (enrollment.rows.length === 0) {
        return res.status(404).json({ error: 'Student is not enrolled in this course' });
      }

      // Check if grade already exists and update or insert
      const existingGrade = await client.query(
        'SELECT id FROM grades WHERE student_id = $1 AND course_id = $2',
        [studentId, courseId]
      );

      let result;
      if (existingGrade.rows.length > 0) {
        // Update existing grade
        result = await client.query(
          'UPDATE grades SET grade = $1, gpa = $2, updated_at = CURRENT_TIMESTAMP WHERE student_id = $3 AND course_id = $4 RETURNING id, grade, gpa',
          [grade, gpa, studentId, courseId]
        );
      } else {
        // Insert new grade
        result = await client.query(
          'INSERT INTO grades (student_id, course_id, grade, gpa) VALUES ($1, $2, $3, $4) RETURNING id, grade, gpa',
          [studentId, courseId, grade, gpa]
        );
      }

      res.status(201).json({
        message: 'Grade recorded successfully',
        grade: {
          id: result.rows[0].id,
          studentId,
          courseId,
          grade: result.rows[0].grade,
          gpa: parseFloat(result.rows[0].gpa),
        },
      });
    } catch (err) {
      console.error('Grade add error:', err);
      res.status(500).json({ error: 'Server error adding grade' });
    } finally {
      if (client) client.release();
    }
  });

  // PATCH /api/assessments/grades/:courseId/toggle-posting
router.patch('/grades/:courseId/toggle-posting', verifyToken, async (req, res) => {
  // Only faculty or admin can do this
  if (req.userRole !== 'faculty' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { courseId } = req.params;
  const { isPosted } = req.body; // boolean

  if (typeof isPosted !== 'boolean') {
    return res.status(400).json({ error: 'isPosted must be a boolean' });
  }

  let client;
  try {
    client = await pool.connect();

    // Optional: verify that the faculty teaches this course (if not admin)
    if (req.userRole === 'faculty') {
      const teachCheck = await client.query(
        'SELECT 1 FROM teacher_courses WHERE teacher_id = $1 AND course_id = $2',
        [req.userId, courseId]
      );
      if (teachCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }
    }

    // Update all grades for this course
    const result = await client.query(
      `UPDATE grades SET is_posted = $1, updated_at = CURRENT_TIMESTAMP
       WHERE course_id = $2
       RETURNING student_id, grade`,
      [isPosted, courseId]
    );

    client.release();
    res.json({
      message: `Grades ${isPosted ? 'posted' : 'hidden'} successfully`,
      updatedCount: result.rowCount
    });
  } catch (err) {
    console.error('Error toggling grade posting:', err);
    res.status(500).json({ error: 'Failed to toggle grade posting' });
  }
});

  // Get grades for the logged-in student
  router.get('/my-grades', verifyToken, async (req, res) => {
    const studentId = req.userId;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT g.id, g.student_id, g.course_id, g.grade, g.gpa, g.created_at, g.updated_at,
                c.code, c.title
         FROM grades g
         INNER JOIN courses c ON g.course_id = c.id
         WHERE g.student_id = $1
         ORDER BY g.created_at DESC`,
        [studentId]
      );

      // Calculate cumulative GPA
      let cumulativeGpa = 0;
      if (result.rows.length > 0) {
        const totalGpa = result.rows.reduce((sum, grade) => sum + parseFloat(grade.gpa), 0);
        cumulativeGpa = (totalGpa / result.rows.length).toFixed(2);
      }

      res.json({
        grades: result.rows,
        cumulativeGpa: parseFloat(cumulativeGpa),
        courseCount: result.rows.length,
      });
    } catch (err) {
      console.error('Error fetching grades:', err);
      res.status(500).json({ error: 'Server error fetching grades' });
    } finally {
      if (client) client.release();
    }
  });

  // Get grades for a specific student (admin/faculty)
  router.get('/student/:studentId', verifyToken, async (req, res) => {
    const { studentId } = req.params;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT g.id, g.student_id, g.course_id, g.grade, g.gpa, g.created_at, g.updated_at,
                c.code, c.title
         FROM grades g
         INNER JOIN courses c ON g.course_id = c.id
         WHERE g.student_id = $1
         ORDER BY g.created_at DESC`,
        [studentId]
      );

      let cumulativeGpa = 0;
      if (result.rows.length > 0) {
        const totalGpa = result.rows.reduce((sum, grade) => sum + parseFloat(grade.gpa), 0);
        cumulativeGpa = (totalGpa / result.rows.length).toFixed(2);
      }

      res.json({
        grades: result.rows,
        cumulativeGpa: parseFloat(cumulativeGpa),
        courseCount: result.rows.length,
      });
    } catch (err) {
      console.error('Error fetching student grades:', err);
      res.status(500).json({ error: 'Server error fetching student grades' });
    } finally {
      if (client) client.release();
    }
  });

  // Get grades for a specific course (admin/faculty)
  router.get('/course/:courseId', async (req, res) => {
    const { courseId } = req.params;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT g.id, g.student_id, g.course_id, g.grade, g.gpa, g.created_at,
                s.name, s.email, c.code, c.title
         FROM grades g
         INNER JOIN students s ON g.student_id = s.id
         INNER JOIN courses c ON g.course_id = c.id
         WHERE g.course_id = $1
         ORDER BY s.name ASC`,
        [courseId]
      );

      res.json({
        courseId,
        grades: result.rows,
        studentCount: result.rows.length,
      });
    } catch (err) {
      console.error('Error fetching course grades:', err);
      res.status(500).json({ error: 'Server error fetching course grades' });
    } finally {
      if (client) client.release();
    }
  });

  // Update a grade
  router.put('/:gradeId', verifyToken, async (req, res) => {
    const { gradeId } = req.params;
    const { grade, gpa } = req.body;

    if (!grade || gpa === undefined) {
      return res.status(400).json({ error: 'Grade and GPA are required' });
    }

    if (gpa < 0 || gpa > 4.0) {
      return res.status(400).json({ error: 'GPA must be between 0 and 4.0' });
    }

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        'UPDATE grades SET grade = $1, gpa = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [grade, gpa, gradeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Grade not found' });
      }

      res.json({
        message: 'Grade updated successfully',
        grade: result.rows[0],
      });
    } catch (err) {
      console.error('Grade update error:', err);
      res.status(500).json({ error: 'Server error updating grade' });
    } finally {
      if (client) client.release();
    }
  });

  // Delete a grade
  router.delete('/:gradeId', verifyToken, async (req, res) => {
    const { gradeId } = req.params;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query('DELETE FROM grades WHERE id = $1 RETURNING id', [gradeId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Grade not found' });
      }

      res.json({ message: 'Grade deleted successfully', gradeId: result.rows[0].id });
    } catch (err) {
      console.error('Grade delete error:', err);
      res.status(500).json({ error: 'Server error deleting grade' });
    } finally {
      if (client) client.release();
    }
  });

  return router;
};
