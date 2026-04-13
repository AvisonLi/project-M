const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create attendance session
router.post('/sessions', verifyToken, async (req, res) => {
  if (req.userRole !== 'faculty' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Only faculty and admins can create attendance sessions' });
  }

  const { courseId, title, sessionDate, startTime, endTime, checkinMethods, bluetoothEnabled } = req.body;

  if (!courseId || !title || !sessionDate || !startTime || !endTime) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  let client;
  try {
    client = await pool.connect();

    // Verify teacher is assigned to this course
    if (req.userRole === 'faculty') {
      const teacherCheck = await client.query(
        'SELECT id FROM teacher_courses WHERE teacher_id = $1 AND course_id = $2',
        [req.userId, courseId]
      );
      if (teacherCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }
    }

    // Generate QR code and manual code
    const qrCode = crypto.randomBytes(32).toString('hex');
    const manualCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const startTimestamp = sessionDate && startTime ? `${sessionDate} ${startTime}` : startTime;
    const endTimestamp = sessionDate && endTime ? `${sessionDate} ${endTime}` : endTime;

    const result = await client.query(
      `INSERT INTO attendance_sessions
       (course_id, title, session_date, start_time, end_time, checkin_methods, qr_code, manual_code, bluetooth_enabled, bluetooth_uuid, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        courseId,
        title,
        sessionDate,
        startTimestamp,
        endTimestamp,
        JSON.stringify(checkinMethods || ['qr', 'manual']),
        qrCode,
        manualCode,
        bluetoothEnabled || false,
        bluetoothEnabled ? crypto.randomUUID() : null,
        req.userId
      ]
    );

    res.json({
      message: 'Attendance session created successfully',
      session: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating attendance session:', err);
    res.status(500).json({ error: 'Server error creating attendance session' });
  } finally {
    if (client) client.release();
  }
});

// Get attendance sessions for a course
router.get('/sessions/:courseId', verifyToken, async (req, res) => {
  const { courseId } = req.params;

  let client;
  try {
    client = await pool.connect();

    // Check if user has access to this course
    let accessCheck;
    if (req.userRole === 'faculty') {
      accessCheck = await client.query(
        'SELECT id FROM teacher_courses WHERE teacher_id = $1 AND course_id = $2',
        [req.userId, courseId]
      );
    } else if (req.userRole === 'student') {
      accessCheck = await client.query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = $3',
        [req.userId, courseId, 'enrolled']
      );
    }

    if (req.userRole === 'faculty' && accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this course' });
    }
    if (req.userRole === 'student' && accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const result = await client.query(
      `SELECT * FROM attendance_sessions
       WHERE course_id = $1
       ORDER BY session_date DESC, start_time DESC`,
      [courseId]
    );

    res.json({ sessions: result.rows });
  } catch (err) {
    console.error('Error fetching attendance sessions:', err);
    res.status(500).json({ error: 'Server error fetching attendance sessions' });
  } finally {
    if (client) client.release();
  }
});

// Check in to attendance session
router.post('/checkin', verifyToken, async (req, res) => {
  if (req.userRole !== 'student') {
    return res.status(403).json({ error: 'Only students can check in to attendance' });
  }

  const { sessionId, method, code, latitude, longitude, deviceInfo } = req.body;

  if (!sessionId || !method) {
    return res.status(400).json({ error: 'Session ID and check-in method are required' });
  }

  let client;
  try {
    client = await pool.connect();

    // Verify session exists and is active
    const session = await client.query(
      `SELECT * FROM attendance_sessions
       WHERE id = $1 AND start_time <= CURRENT_TIMESTAMP AND end_time >= CURRENT_TIMESTAMP`,
      [sessionId]
    );

    if (session.rows.length === 0) {
      return res.status(400).json({ error: 'Attendance session not found or not active' });
    }

    const sessionData = session.rows[0];

    // Verify student is enrolled in the course
    const enrollment = await client.query(
      'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = $3',
      [req.userId, sessionData.course_id, 'enrolled']
    );

    if (enrollment.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // Verify check-in method is allowed
    const allowedMethods = sessionData.checkin_methods;
    if (!allowedMethods.includes(method)) {
      return res.status(400).json({ error: 'Check-in method not allowed for this session' });
    }

    // Verify code if using manual or QR method
    if (method === 'manual' && code !== sessionData.manual_code) {
      return res.status(400).json({ error: 'Invalid manual code' });
    }

    if (method === 'qr' && code !== sessionData.qr_code) {
      return res.status(400).json({ error: 'Invalid QR code' });
    }

    // Check if already checked in
    const existingCheckin = await client.query(
      'SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2',
      [sessionId, req.userId]
    );

    if (existingCheckin.rows.length > 0) {
      return res.status(400).json({ error: 'Already checked in to this session' });
    }

    // Record attendance
    const result = await client.query(
      `INSERT INTO attendance_records
       (session_id, student_id, checkin_method, checkin_time, latitude, longitude, device_info)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6)
       RETURNING *`,
      [sessionId, req.userId, method, latitude, longitude, JSON.stringify(deviceInfo || {})]
    );

    res.json({
      message: 'Check-in successful',
      record: result.rows[0]
    });
  } catch (err) {
    console.error('Error checking in:', err);
    res.status(500).json({ error: 'Server error during check-in' });
  } finally {
    if (client) client.release();
  }
});

// Get attendance records for a session
router.get('/records/:sessionId', verifyToken, async (req, res) => {
  const { sessionId } = req.params;

  let client;
  try {
    client = await pool.connect();

    // Get session info
    const session = await client.query(
      'SELECT * FROM attendance_sessions WHERE id = $1',
      [sessionId]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ error: 'Attendance session not found' });
    }

    // Check access permissions
    if (req.userRole === 'faculty') {
      const teacherCheck = await client.query(
        'SELECT id FROM teacher_courses WHERE teacher_id = $1 AND course_id = $2',
        [req.userId, session.rows[0].course_id]
      );
      if (teacherCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }
    } else if (req.userRole === 'student') {
      return res.status(403).json({ error: 'Students cannot view attendance records' });
    }

    // Get attendance records with student info
    const records = await client.query(
      `SELECT ar.*, s.name, s.student_id, s.email
       FROM attendance_records ar
       JOIN students s ON ar.student_id = s.id
       WHERE ar.session_id = $1
       ORDER BY ar.checkin_time ASC`,
      [sessionId]
    );

    res.json({
      session: session.rows[0],
      records: records.rows
    });
  } catch (err) {
    console.error('Error fetching attendance records:', err);
    res.status(500).json({ error: 'Server error fetching attendance records' });
  } finally {
    if (client) client.release();
  }
});

// Get student's attendance for a course
router.get('/student/:courseId', verifyToken, async (req, res) => {
  if (req.userRole !== 'student') {
    return res.status(403).json({ error: 'Only students can view their own attendance' });
  }

  const { courseId } = req.params;

  let client;
  try {
    client = await pool.connect();

    // Verify enrollment
    const enrollment = await client.query(
      'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = $3',
      [req.userId, courseId, 'enrolled']
    );

    if (enrollment.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // Get attendance records
    const records = await client.query(
      `SELECT ar.*, ats.title, ats.session_date, ats.start_time, ats.end_time
       FROM attendance_records ar
       JOIN attendance_sessions ats ON ar.session_id = ats.id
       WHERE ar.student_id = $1 AND ats.course_id = $2
       ORDER BY ats.session_date DESC`,
      [req.userId, courseId]
    );

    res.json({ records: records.rows });
  } catch (err) {
    console.error('Error fetching student attendance:', err);
    res.status(500).json({ error: 'Server error fetching attendance' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;