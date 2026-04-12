const express = require('express');
const jwt = require('jsonwebtoken');

module.exports = (pool) => {
  const router = express.Router();

  // Middleware for JWT verification with role check
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

  // ========== COURSE MANAGEMENT ==========

  // Create a new course
  router.post('/courses', verifyToken, async (req, res) => {
    const { code, title, capacity } = req.body;

    if (!code || !title || capacity === undefined) {
      return res.status(400).json({ error: 'Course code, title, and capacity are required' });
    }

    if (capacity <= 0) {
      return res.status(400).json({ error: 'Capacity must be greater than 0' });
    }

    let client;
    try {
      client = await pool.connect();

      const existingCourse = await client.query('SELECT id FROM courses WHERE code = $1', [code]);

      if (existingCourse.rows.length > 0) {
        return res.status(409).json({ error: 'Course code already exists' });
      }

      const result = await client.query(
        'INSERT INTO courses (code, title, capacity) VALUES ($1, $2, $3) RETURNING *',
        [code, title, capacity]
      );

      res.status(201).json({
        message: 'Course created successfully',
        course: result.rows[0],
      });
    } catch (err) {
      console.error('Course creation error:', err);
      res.status(500).json({ error: 'Server error creating course' });
    } finally {
      if (client) client.release();
    }
  });

  // Get all courses
  router.get('/courses', async (req, res) => {
    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT c.id, c.code, c.title, c.capacity,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as current_enrollments,
                c.created_at, c.updated_at
         FROM courses c
         ORDER BY c.code ASC`
      );

      const coursesWithStats = result.rows.map((course) => ({
        ...course,
        current_enrollments: parseInt(course.current_enrollments, 10),
        available_slots: course.capacity - parseInt(course.current_enrollments, 10),
      }));

      res.json({
        courses: coursesWithStats,
        total: coursesWithStats.length,
      });
    } catch (err) {
      console.error('Error fetching courses:', err);
      res.status(500).json({ error: 'Server error fetching courses' });
    } finally {
      if (client) client.release();
    }
  });

  // Get course details with enrollment list
  router.get('/courses/:courseId', async (req, res) => {
    const { courseId } = req.params;

    let client;
    try {
      client = await pool.connect();

      const courseResult = await client.query(
        `SELECT c.id, c.code, c.title, c.capacity,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as current_enrollments,
                c.created_at, c.updated_at
         FROM courses c
         WHERE c.id = $1`,
        [courseId]
      );

      if (courseResult.rows.length === 0) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const enrollmentResult = await client.query(
        `SELECT s.id, s.student_id, s.name, s.email, e.created_at as enrolled_at
         FROM enrollments e
         INNER JOIN students s ON e.student_id = s.id
         WHERE e.course_id = $1
         ORDER BY s.name ASC`,
        [courseId]
      );

      const course = courseResult.rows[0];
      course.current_enrollments = parseInt(course.current_enrollments, 10);

      res.json({
        course,
        enrollments: enrollmentResult.rows,
        enrollment_count: enrollmentResult.rows.length,
      });
    } catch (err) {
      console.error('Error fetching course details:', err);
      res.status(500).json({ error: 'Server error fetching course details' });
    } finally {
      if (client) client.release();
    }
  });

  // Update course
  router.put('/courses/:courseId', verifyToken, async (req, res) => {
    const { courseId } = req.params;
    const { code, title, capacity } = req.body;

    if (!code && !title && capacity === undefined) {
      return res.status(400).json({ error: 'At least one field is required' });
    }

    if (capacity !== undefined && capacity <= 0) {
      return res.status(400).json({ error: 'Capacity must be greater than 0' });
    }

    let client;
    try {
      client = await pool.connect();

      // Check if course exists
      const course = await client.query('SELECT id FROM courses WHERE id = $1', [courseId]);

      if (course.rows.length === 0) {
        return res.status(404).json({ error: 'Course not found' });
      }

      // Build dynamic update query
      let query = 'UPDATE courses SET ';
      const params = [];
      const updates = [];

      if (code) {
        // Check if code is already in use by another course
        const existingCode = await client.query(
          'SELECT id FROM courses WHERE code = $1 AND id != $2',
          [code, courseId]
        );

        if (existingCode.rows.length > 0) {
          await client.release();
          return res.status(409).json({ error: 'Course code already exists' });
        }

        updates.push(`code = $${params.length + 1}`);
        params.push(code);
      }

      if (title) {
        updates.push(`title = $${params.length + 1}`);
        params.push(title);
      }

      if (capacity !== undefined) {
        updates.push(`capacity = $${params.length + 1}`);
        params.push(capacity);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      query += updates.join(', ');
      query += ` WHERE id = $${params.length + 1} RETURNING *`;
      params.push(courseId);

      const result = await client.query(query, params);

      res.json({
        message: 'Course updated successfully',
        course: result.rows[0],
      });
    } catch (err) {
      console.error('Course update error:', err);
      res.status(500).json({ error: 'Server error updating course' });
    } finally {
      if (client) client.release();
    }
  });

  // Delete course
  router.delete('/courses/:courseId', verifyToken, async (req, res) => {
    const { courseId } = req.params;

    let client;
    try {
      client = await pool.connect();

      // Check if there are enrollments
      const enrollments = await client.query('SELECT COUNT(*) as count FROM enrollments WHERE course_id = $1', [
        courseId,
      ]);

      if (parseInt(enrollments.rows[0].count, 10) > 0) {
        return res.status(409).json({
          error: 'Cannot delete course with active enrollments',
          enrollmentCount: parseInt(enrollments.rows[0].count, 10),
        });
      }

      const result = await client.query('DELETE FROM courses WHERE id = $1 RETURNING id', [courseId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Course not found' });
      }

      res.json({ message: 'Course deleted successfully', courseId: result.rows[0].id });
    } catch (err) {
      console.error('Course delete error:', err);
      res.status(500).json({ error: 'Server error deleting course' });
    } finally {
      if (client) client.release();
    }
  });

  // ========== STUDENT MANAGEMENT ==========

  // Get all students
  router.get('/students', async (req, res) => {
    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT s.id, s.student_id, s.name, s.email,
                (SELECT COUNT(*) FROM enrollments WHERE student_id = s.id) as enrolled_courses,
                (SELECT COUNT(*) FROM grades WHERE student_id = s.id) as grades_count,
                s.created_at, s.updated_at
         FROM students s
         ORDER BY s.name ASC`
      );

      const studentsWithStats = result.rows.map((student) => ({
        ...student,
        enrolled_courses: parseInt(student.enrolled_courses, 10),
        grades_count: parseInt(student.grades_count, 10),
      }));

      res.json({
        students: studentsWithStats,
        total: studentsWithStats.length,
      });
    } catch (err) {
      console.error('Error fetching students:', err);
      res.status(500).json({ error: 'Server error fetching students' });
    } finally {
      if (client) client.release();
    }
  });

  // Get student details with enrollments and grades
  router.get('/students/:studentId/details', async (req, res) => {
    const { studentId } = req.params;

    let client;
    try {
      client = await pool.connect();

      // Get student info
      const studentResult = await client.query(
        'SELECT id, student_id, name, email, created_at, updated_at FROM students WHERE id = $1',
        [studentId]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Get enrollments
      const enrollmentsResult = await client.query(
        `SELECT c.id, c.code, c.title, e.created_at as enrolled_at
         FROM enrollments e
         INNER JOIN courses c ON e.course_id = c.id
         WHERE e.student_id = $1
         ORDER BY e.created_at DESC`,
        [studentId]
      );

      // Get grades
      const gradesResult = await client.query(
        `SELECT g.id, g.course_id, c.code, c.title, g.grade, g.gpa, g.created_at
         FROM grades g
         INNER JOIN courses c ON g.course_id = c.id
         WHERE g.student_id = $1
         ORDER BY g.created_at DESC`,
        [studentId]
      );

      const avgGpa =
        gradesResult.rows.length > 0
          ? (
              gradesResult.rows.reduce((sum, g) => sum + parseFloat(g.gpa), 0) / gradesResult.rows.length
            ).toFixed(2)
          : null;

      res.json({
        student: studentResult.rows[0],
        enrollments: enrollmentsResult.rows,
        grades: gradesResult.rows,
        statistics: {
          enrolled_courses_count: enrollmentsResult.rows.length,
          grades_count: gradesResult.rows.length,
          average_gpa: avgGpa,
        },
      });
    } catch (err) {
      console.error('Error fetching student details:', err);
      res.status(500).json({ error: 'Server error fetching student details' });
    } finally {
      if (client) client.release();
    }
  });

  // ========== SYSTEM STATISTICS ==========

  // Get system dashboard statistics
  router.get('/statistics/dashboard', async (req, res) => {
    let client;
    try {
      client = await pool.connect();

      // Total students
      const studentsCount = await client.query('SELECT COUNT(*) as count FROM students');

      // Total courses
      const coursesCount = await client.query('SELECT COUNT(*) as count FROM courses');

      // Total enrollments
      const enrollmentsCount = await client.query('SELECT COUNT(*) as count FROM enrollments');

      // Total grades
      const gradesCount = await client.query('SELECT COUNT(*) as count FROM grades');

      // Average GPA
      const avgGpaResult = await client.query('SELECT AVG(gpa) as avg_gpa FROM grades');

      // Course fill rate
      const courseCapacityResult = await client.query(`
        SELECT 
          SUM(capacity) as total_capacity,
          (SELECT COUNT(*) FROM enrollments) as total_enrollments
        FROM courses
      `);

      const capacity = courseCapacityResult.rows[0];
      const fillRate =
        capacity.total_capacity > 0
          ? ((parseInt(capacity.total_enrollments, 10) / parseInt(capacity.total_capacity, 10)) * 100).toFixed(2)
          : 0;

      res.json({
        statistics: {
          totalStudents: parseInt(studentsCount.rows[0].count, 10),
          totalCourses: parseInt(coursesCount.rows[0].count, 10),
          totalEnrollments: parseInt(enrollmentsCount.rows[0].count, 10),
          totalGrades: parseInt(gradesCount.rows[0].count, 10),
          averageGpa: avgGpaResult.rows[0].avg_gpa
            ? parseFloat(avgGpaResult.rows[0].avg_gpa).toFixed(2)
            : 0,
          courseCapacityFillRate: `${fillRate}%`,
          totalCourseCapacity: parseInt(capacity.total_capacity, 10),
        },
      });
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
      res.status(500).json({ error: 'Server error fetching statistics' });
    } finally {
      if (client) client.release();
    }
  });

  // Get students by course
  router.get('/reports/course-enrollment', async (req, res) => {
    let client;
    try {
      client = await pool.connect();

      const result = await client.query(`
        SELECT 
          c.id,
          c.code,
          c.title,
          c.capacity,
          COUNT(e.id) as current_enrollments,
          c.capacity - COUNT(e.id) as available_slots
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id
        GROUP BY c.id, c.code, c.title, c.capacity
        ORDER BY c.code ASC
      `);

      res.json({
        enrollmentReport: result.rows.map((row) => ({
          ...row,
          current_enrollments: parseInt(row.current_enrollments, 10),
          available_slots: parseInt(row.available_slots, 10),
          fillPercentage: ((parseInt(row.current_enrollments, 10) / row.capacity) * 100).toFixed(2),
        })),
      });
    } catch (err) {
      console.error('Error fetching enrollment report:', err);
      res.status(500).json({ error: 'Server error fetching enrollment report' });
    } finally {
      if (client) client.release();
    }
  });

  // ========== USER MANAGEMENT ==========

  // Get all users (with roles)
  router.get('/users', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view all users' });
    }

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT id, name, email, role, created_at, updated_at FROM students ORDER BY name ASC`
      );

      res.json({ users: result.rows, total: result.rows.length });
    } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ error: 'Server error fetching users' });
    } finally {
      if (client) client.release();
    }
  });

  // Get user by ID
  router.get('/users/:userId', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view user details' });
    }

    const { userId } = req.params;
    let client;
    try {
      client = await pool.connect();

      const result = await client.query('SELECT id, name, email, role, created_at, updated_at FROM students WHERE id = $1', [
        userId,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: result.rows[0] });
    } catch (err) {
      console.error('Error fetching user:', err);
      res.status(500).json({ error: 'Server error fetching user' });
    } finally {
      if (client) client.release();
    }
  });

  // Update user profile
  router.put('/users/:userId', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update users' });
    }

    const { userId } = req.params;
    const { name, email, role } = req.body;

    if (!name && !email && !role) {
      return res.status(400).json({ error: 'At least one field is required' });
    }

    if (role && !['student', 'faculty', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    let client;
    try {
      client = await pool.connect();

      // Check if user exists
      const user = await client.query('SELECT id FROM students WHERE id = $1', [userId]);
      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if email is already in use
      if (email) {
        const emailExists = await client.query('SELECT id FROM students WHERE email = $1 AND id != $2', [email, userId]);
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

      if (role) {
        updates.push(`role = $${params.length + 1}`);
        params.push(role);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      query += updates.join(', ');
      query += ` WHERE id = $${params.length + 1} RETURNING id, name, email, role, created_at, updated_at`;
      params.push(userId);

      const result = await client.query(query, params);

      res.json({ message: 'User updated successfully', user: result.rows[0] });
    } catch (err) {
      console.error('Error updating user:', err);
      res.status(500).json({ error: 'Server error updating user' });
    } finally {
      if (client) client.release();
    }
  });

  // Create new user
  router.post('/users', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create users' });
    }

    const { name, email, password, role } = req.body;
    const bcrypt = require('bcrypt');

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (role && !['student', 'faculty', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    let client;
    try {
      client = await pool.connect();

      // Check if email exists
      const existing = await client.query('SELECT id FROM students WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userRole = role || 'student';

      const result = await client.query(
        'INSERT INTO students (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
        [name, email, hashedPassword, userRole]
      );

      res.status(201).json({
        message: 'User created successfully',
        user: result.rows[0],
      });
    } catch (err) {
      console.error('Error creating user:', err);
      res.status(500).json({ error: 'Server error creating user' });
    } finally {
      if (client) client.release();
    }
  });

  // Delete user
  router.delete('/users/:userId', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete users' });
    }

    const { userId } = req.params;

    if (parseInt(userId) === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    let client;
    try {
      client = await pool.connect();

      const result = await client.query('DELETE FROM students WHERE id = $1 RETURNING id, name, email', [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted successfully', user: result.rows[0] });
    } catch (err) {
      console.error('Error deleting user:', err);
      res.status(500).json({ error: 'Server error deleting user' });
    } finally {
      if (client) client.release();
    }
  });

  // ========== TEACHER COURSE ASSIGNMENT ==========

  // Assign course to teacher
  router.post('/teacher-courses', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can assign courses to teachers' });
    }

    const { teacherId, courseId } = req.body;

    if (!teacherId || !courseId) {
      return res.status(400).json({ error: 'Teacher ID and Course ID are required' });
    }

    let client;
    try {
      client = await pool.connect();

      // Verify teacher exists and has faculty role
      const teacher = await client.query('SELECT id, role FROM students WHERE id = $1', [teacherId]);
      if (teacher.rows.length === 0 || teacher.rows[0].role !== 'faculty') {
        return res.status(404).json({ error: 'Teacher not found or does not have faculty role' });
      }

      // Verify course exists
      const course = await client.query('SELECT id FROM courses WHERE id = $1', [courseId]);
      if (course.rows.length === 0) {
        return res.status(404).json({ error: 'Course not found' });
      }

      // Check if already assigned
      const existing = await client.query(
        'SELECT id FROM teacher_courses WHERE teacher_id = $1 AND course_id = $2',
        [teacherId, courseId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Teacher is already assigned to this course' });
      }

      const result = await client.query(
        'INSERT INTO teacher_courses (teacher_id, course_id) VALUES ($1, $2) RETURNING id, teacher_id, course_id, created_at',
        [teacherId, courseId]
      );

      res.status(201).json({
        message: 'Course assigned to teacher successfully',
        assignment: result.rows[0],
      });
    } catch (err) {
      console.error('Error assigning course to teacher:', err);
      res.status(500).json({ error: 'Server error assigning course' });
    } finally {
      if (client) client.release();
    }
  });

  // Get teacher's assigned courses
  router.get('/teacher-courses/:teacherId', async (req, res) => {
    const { teacherId } = req.params;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT c.id, c.code, c.title, c.capacity,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as current_enrollments,
                tc.created_at as assigned_at
         FROM teacher_courses tc
         INNER JOIN courses c ON tc.course_id = c.id
         WHERE tc.teacher_id = $1
         ORDER BY c.code ASC`,
        [teacherId]
      );

      res.json({
        courses: result.rows.map((row) => ({
          ...row,
          current_enrollments: parseInt(row.current_enrollments, 10),
        })),
        total: result.rows.length,
      });
    } catch (err) {
      console.error('Error fetching teacher courses:', err);
      res.status(500).json({ error: 'Server error fetching teacher courses' });
    } finally {
      if (client) client.release();
    }
  });

  // Remove course from teacher
  router.delete('/teacher-courses/:teacherId/:courseId', verifyToken, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove course assignments' });
    }

    const { teacherId, courseId } = req.params;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        'DELETE FROM teacher_courses WHERE teacher_id = $1 AND course_id = $2 RETURNING id',
        [teacherId, courseId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Course assignment not found' });
      }

      res.json({ message: 'Course removed from teacher successfully' });
    } catch (err) {
      console.error('Error removing course from teacher:', err);
      res.status(500).json({ error: 'Server error removing course' });
    } finally {
      if (client) client.release();
    }
  });

  return router;
};
