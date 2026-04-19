const express = require('express');
const { verifyToken } = require('../middleware/auth');

module.exports = (pool, redis) => {
  const router = express.Router();

  // Get available courses for registration
  router.get('/available', verifyToken, async (req, res) => {
    if (req.userRole !== 'student') {
      return res.status(403).json({ error: 'Only students can view available courses' });
    }

    let client;
    try {
      client = await pool.connect();

      // Check if registration is currently open
      const registrationPeriod = await client.query(
        'SELECT * FROM registration_periods WHERE is_active = true LIMIT 1'
      );

      if (registrationPeriod.rows.length === 0) {
        return res.json({
          available: false,
          message: 'Course registration is currently closed',
          courses: []
        });
      }

      // Get courses with enrollment status
      const courses = await client.query(
        `SELECT c.*,
                CASE WHEN e.id IS NOT NULL THEN true ELSE false END as is_enrolled,
                CASE WHEN w.id IS NOT NULL THEN w.position ELSE null END as waitlist_position,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id AND status = 'enrolled') as enrolled_count,
                (SELECT COUNT(*) FROM waitlist WHERE course_id = c.id) as waitlist_count
         FROM courses c
         LEFT JOIN enrollments e ON c.id = e.course_id AND e.student_id = $1 AND e.status = 'enrolled'
         LEFT JOIN waitlist w ON c.id = w.course_id AND w.student_id = $1
         WHERE c.is_active = true
         ORDER BY c.code ASC`,
        [req.userId]
      );

      res.json({
        available: true,
        registrationPeriod: registrationPeriod.rows[0],
        courses: courses.rows
      });
    } catch (err) {
      console.error('Error fetching available courses:', err);
      res.status(500).json({ error: 'Server error fetching courses' });
    } finally {
      if (client) client.release();
    }
  });

  // Register for a course
  router.post('/enroll/:courseId', verifyToken, async (req, res) => {
    if (req.userRole !== 'student') {
      return res.status(403).json({ error: 'Only students can register for courses' });
    }

    const { courseId } = req.params;
    const userId = req.userId;
    
    // --- REDIS DISTRIBUTED LOCK IMPLEMENTATION ---
    const lockKey = `lock:enrollment:course:${courseId}`;
    const lockTimeout = 5000; // 5 seconds
    
    // Attempt to acquire lock
    const acquired = await redis.set(lockKey, userId, 'NX', 'PX', lockTimeout);
    if (!acquired) {
      return res.status(429).json({ error: 'System busy, please try again' });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      // Check if registration is open
      const registrationPeriod = await client.query(
        'SELECT * FROM registration_periods WHERE is_active = true AND start_date <= CURRENT_TIMESTAMP AND end_date >= CURRENT_TIMESTAMP LIMIT 1'
      );

      if (registrationPeriod.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Course registration is not currently open' });
      }

      // Check if already enrolled or on waitlist
      const existingEnrollment = await client.query(
        'SELECT id, status FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [userId, courseId]
      );

      if (existingEnrollment.rows.length > 0) {
        await client.query('ROLLBACK');
        const status = existingEnrollment.rows[0].status;
        return res.status(400).json({
          error: `You are already ${status === 'enrolled' ? 'enrolled' : 'on the waitlist'} for this course`
        });
      }

      // Get course info (using FOR UPDATE for database level safety)
      const course = await client.query(
        'SELECT * FROM courses WHERE id = $1 AND is_active = true FOR UPDATE',
        [courseId]
      );

      if (course.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Course not found' });
      }

      const courseData = course.rows[0];

      // Check current enrollment count
      const enrollmentCount = await client.query(
        'SELECT COUNT(*) as count FROM enrollments WHERE course_id = $1 AND status = $2',
        [courseId, 'enrolled']
      );

      if (enrollmentCount.rows[0].count < courseData.capacity) {
        // Direct enrollment
        await client.query(
          'INSERT INTO enrollments (student_id, course_id, status) VALUES ($1, $2, $3)',
          [userId, courseId, 'enrolled']
        );

        // Update course enrollment count
        await client.query(
          'UPDATE courses SET current_enrollments = current_enrollments + 1 WHERE id = $1',
          [courseId]
        );

        await client.query('COMMIT');
        res.json({ message: 'Successfully enrolled in course' });
      } else {
        // Add to waitlist
        const waitlistPosition = await client.query(
          'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM waitlist WHERE course_id = $1',
          [courseId]
        );

        await client.query(
          'INSERT INTO waitlist (student_id, course_id, position) VALUES ($1, $2, $3)',
          [userId, courseId, waitlistPosition.rows[0].next_position]
        );

        await client.query('COMMIT');
        res.json({
          message: 'Added to waitlist',
          position: waitlistPosition.rows[0].next_position
        });
      }
    } catch (err) {
      if (client) await client.query('ROLLBACK');
      console.error('Error enrolling in course:', err);
      res.status(500).json({ error: 'Server error during enrollment' });
    } finally {
      if (client) client.release();
      // Release lock
      const currentLock = await redis.get(lockKey);
      if (currentLock == userId) await redis.del(lockKey);
    }
  });

  // Drop a course
  router.post('/drop/:courseId', verifyToken, async (req, res) => {
    if (req.userRole !== 'student') {
      return res.status(403).json({ error: 'Only students can drop courses' });
    }

    const { courseId } = req.params;

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      // Check if registration is open
      const registrationPeriod = await client.query(
        'SELECT * FROM registration_periods WHERE is_active = true AND add_drop_deadline >= CURRENT_TIMESTAMP LIMIT 1'
      );

      if (registrationPeriod.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Add/drop period has ended' });
      }

      // Check if enrolled
      const enrollment = await client.query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = $3',
        [req.userId, courseId, 'enrolled']
      );

      if (enrollment.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You are not enrolled in this course' });
      }

      // Mark as dropped
      await client.query(
        'UPDATE enrollments SET status = $1, dropped_at = CURRENT_TIMESTAMP WHERE student_id = $2 AND course_id = $3',
        ['dropped', req.userId, courseId]
      );

      // Update course enrollment count
      await client.query(
        'UPDATE courses SET current_enrollments = current_enrollments - 1 WHERE id = $1',
        [courseId]
      );

      // Process waitlist - move first person to enrolled
      const waitlist = await client.query(
        'SELECT * FROM waitlist WHERE course_id = $1 ORDER BY position ASC LIMIT 1',
        [courseId]
      );

      if (waitlist.rows.length > 0) {
        const nextStudent = waitlist.rows[0];

        // Move to enrolled
        await client.query(
          'INSERT INTO enrollments (student_id, course_id, status) VALUES ($1, $2, $3)',
          [nextStudent.student_id, courseId, 'enrolled']
        );

        // Remove from waitlist
        await client.query('DELETE FROM waitlist WHERE id = $1', [nextStudent.id]);

        // Update remaining waitlist positions
        await client.query(
          'UPDATE waitlist SET position = position - 1 WHERE course_id = $1 AND position > $2',
          [courseId, nextStudent.position]
        );

        // Update course count
        await client.query(
          'UPDATE courses SET current_enrollments = current_enrollments + 1 WHERE id = $1',
          [courseId]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Successfully dropped course' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error dropping course:', err);
      res.status(500).json({ error: 'Server error during course drop' });
    } finally {
      if (client) client.release();
    }
  });

  // Get student's current enrollments
  router.get('/my-courses', verifyToken, async (req, res) => {
    if (req.userRole !== 'student') {
      return res.status(403).json({ error: 'Only students can view their enrollments' });
    }

    let client;
    try {
      client = await pool.connect();

      const enrollments = await client.query(
        `SELECT e.*, c.code, c.title, c.credits, c.semester, c.year
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE e.student_id = $1 AND e.status = 'enrolled'
         ORDER BY c.code ASC`,
        [req.userId]
      );

      res.json({ enrollments: enrollments.rows });
    } catch (err) {
      console.error('Error fetching enrollments:', err);
      res.status(500).json({ error: 'Server error fetching enrollments' });
    } finally {
      if (client) client.release();
    }
  });

  // Get registration periods (admin only)
  router.get('/periods', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view registration periods' });
    }

    let client;
    try {
      client = await pool.connect();

      const periods = await client.query(
        'SELECT * FROM registration_periods ORDER BY year DESC, semester DESC'
      );

      res.json({ periods: periods.rows });
    } catch (err) {
      console.error('Error fetching registration periods:', err);
      res.status(500).json({ error: 'Server error fetching registration periods' });
    } finally {
      if (client) client.release();
    }
  });

  // Create/update registration period (admin only)
  router.post('/periods', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage registration periods' });
    }

    const { semester, year, startDate, endDate, addDropDeadline, isActive } = req.body;

    if (!semester || !year || !startDate || !endDate) {
      return res.status(400).json({ error: 'Required fields: semester, year, startDate, endDate' });
    }

    let client;
    try {
      client = await pool.connect();

      // If setting as active, deactivate others
      if (isActive) {
        await client.query('UPDATE registration_periods SET is_active = false WHERE is_active = true');
      }

      const result = await client.query(
        `INSERT INTO registration_periods (semester, year, start_date, end_date, add_drop_deadline, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (semester, year) DO UPDATE SET
           start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           add_drop_deadline = EXCLUDED.add_drop_deadline,
           is_active = EXCLUDED.is_active
         RETURNING *`,
        [semester, year, startDate, endDate, addDropDeadline, isActive || false]
      );

      res.json({
        message: 'Registration period saved successfully',
        period: result.rows[0]
      });
    } catch (err) {
      console.error('Error saving registration period:', err);
      res.status(500).json({ error: 'Server error saving registration period' });
    } finally {
      if (client) client.release();
    }
  });

  // Get student's enrolled courses (students only) - Second redundant copy preserved
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