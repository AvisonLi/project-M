const express = require('express');
const jwt = require('jsonwebtoken');

module.exports = (pool, redis) => {
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

  // Register for a course
  router.post('/', verifyToken, async (req, res) => {
    const { courseId } = req.body;
    const studentId = req.userId;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    const lockKey = `course:${courseId}:lock`;
    const lockValue = `student:${studentId}:${Date.now()}`;
    const lockDuration = 5; // 5 seconds

    let client;
    try {
      // Acquire distributed lock
      const lockAcquired = await redis.set(lockKey, lockValue, 'NX', 'EX', lockDuration);

      if (!lockAcquired) {
        return res.status(429).json({
          error: 'Too many concurrent registration requests for this course. Please try again later.',
        });
      }

      client = await pool.connect();

      // Check if student is already enrolled
      const existingEnrollment = await client.query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [studentId, courseId]
      );

      if (existingEnrollment.rows.length > 0) {
        await redis.del(lockKey);
        return res.status(409).json({ error: 'Student is already enrolled in this course' });
      }

      // Get course capacity
      const courseResult = await client.query('SELECT id, capacity, title FROM courses WHERE id = $1', [courseId]);

      if (courseResult.rows.length === 0) {
        await redis.del(lockKey);
        return res.status(404).json({ error: 'Course not found' });
      }

      const course = courseResult.rows[0];

      // Count current enrollments
      const enrollmentCountResult = await client.query(
        'SELECT COUNT(*) as count FROM enrollments WHERE course_id = $1',
        [courseId]
      );

      const currentEnrollments = parseInt(enrollmentCountResult.rows[0].count, 10);

      if (currentEnrollments >= course.capacity) {
        await redis.del(lockKey);
        return res.status(400).json({
          error: 'Course is full',
          course: { id: course.id, title: course.title, capacity: course.capacity },
        });
      }

      // Insert enrollment
      const result = await client.query(
        'INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) RETURNING id, created_at',
        [studentId, courseId]
      );

      res.status(201).json({
        message: 'Course registration successful',
        enrollment: {
          id: result.rows[0].id,
          courseId,
          studentId,
          enrolledAt: result.rows[0].created_at,
        },
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Server error during registration' });
    } finally {
      if (client) client.release();
      await redis.del(lockKey).catch(() => {});
    }
  });

  // Get student's enrolled courses (students only)
  router.get('/my-courses', verifyToken, async (req, res) => {
    if (req.userRole !== 'student') {
      return res.status(403).json({ error: 'Only students can view their enrolled courses' });
    }

    const studentId = req.userId;
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(
        `SELECT c.id, c.code, c.title, c.capacity, e.created_at as enrolled_at,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as current_enrollments
         FROM courses c
         INNER JOIN enrollments e ON c.id = e.course_id
         WHERE e.student_id = $1
         ORDER BY e.created_at DESC`,
        [studentId]
      );

      res.json({
        enrolledCourses: result.rows,
        count: result.rows.length,
      });
    } catch (err) {
      console.error('Error fetching enrolled courses:', err);
      res.status(500).json({ error: 'Server error fetching enrolled courses' });
    } finally {
      if (client) client.release();
    }
  });

  // Withdraw from a course (students only)
  router.delete('/:courseId', verifyToken, async (req, res) => {
    if (req.userRole !== 'student') {
      return res.status(403).json({ error: 'Only students can withdraw from courses' });
    }

    const { courseId } = req.params;
    const studentId = req.userId;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        'DELETE FROM enrollments WHERE student_id = $1 AND course_id = $2 RETURNING id',
        [studentId, courseId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Enrollment not found' });
      }

      res.json({ message: 'Withdrawal successful', enrollmentId: result.rows[0].id });
    } catch (err) {
      console.error('Withdrawal error:', err);
      res.status(500).json({ error: 'Server error during withdrawal' });
    } finally {
      if (client) client.release();
    }
  });

  // Get all available courses (open to all roles)
  router.get('/courses/available', async (req, res) => {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(
        `SELECT c.id, c.code, c.title, c.capacity,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as current_enrollments
         FROM courses c
         ORDER BY c.code ASC`
      );

      const coursesWithAvailability = result.rows.map((course) => ({
        ...course,
        available_slots: course.capacity - parseInt(course.current_enrollments, 10),
        is_full: parseInt(course.current_enrollments, 10) >= course.capacity,
      }));

      res.json({ courses: coursesWithAvailability });
    } catch (err) {
      console.error('Error fetching courses:', err);
      res.status(500).json({ error: 'Server error fetching courses' });
    } finally {
      if (client) client.release();
    }
  });

  return router;
};
