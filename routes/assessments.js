const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configure multer for CSV upload
const upload = multer({ dest: 'uploads/' });

// Create assessment
router.post('/assessments', verifyToken, async (req, res) => {
  if (req.userRole !== 'faculty' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Only faculty and admins can create assessments' });
  }

  const { courseId, title, type, maxScore, weight, dueDate } = req.body;

  if (!courseId || !title || !type || maxScore == null || weight == null) {
    return res.status(400).json({ error: 'Required fields: courseId, title, type, maxScore, weight' });
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

    const dueTimestamp = dueDate ? `${dueDate} 00:00:00` : null;

    const result = await client.query(
      `INSERT INTO assessments (course_id, title, type, max_score, weight, due_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [courseId, title, type, maxScore, weight, dueTimestamp]
    );

    res.json({
      message: 'Assessment created successfully',
      assessment: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating assessment:', err);
    res.status(500).json({ error: 'Server error creating assessment' });
  } finally {
    if (client) client.release();
  }
});

// Get assessments for a course
router.get('/assessments/:courseId', verifyToken, async (req, res) => {
  const { courseId } = req.params;

  let client;
  try {
    client = await pool.connect();

    // Check access permissions
    if (req.userRole === 'faculty') {
      const teacherCheck = await client.query(
        'SELECT id FROM teacher_courses WHERE teacher_id = $1 AND course_id = $2',
        [req.userId, courseId]
      );
      if (teacherCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }
    } else if (req.userRole === 'student') {
      const enrollmentCheck = await client.query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = $3',
        [req.userId, courseId, 'enrolled']
      );
      if (enrollmentCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You are not enrolled in this course' });
      }
    }

    const assessments = await client.query(
      'SELECT * FROM assessments WHERE course_id = $1 ORDER BY due_date ASC, created_at ASC',
      [courseId]
    );

    res.json({ assessments: assessments.rows });
  } catch (err) {
    console.error('Error fetching assessments:', err);
    res.status(500).json({ error: 'Server error fetching assessments' });
  } finally {
    if (client) client.release();
  }
});

// Record assessment score
router.post('/scores', verifyToken, async (req, res) => {
  if (req.userRole !== 'faculty' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Only faculty and admins can record scores' });
  }

  const { assessmentId, studentId, score, feedback } = req.body;

  if (!assessmentId || !studentId || score === undefined) {
    return res.status(400).json({ error: 'Required fields: assessmentId, studentId, score' });
  }

  let client;
  try {
    client = await pool.connect();

    // Get assessment info
    const assessment = await client.query(
      'SELECT * FROM assessments WHERE id = $1',
      [assessmentId]
    );

    if (assessment.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Verify teacher is assigned to this course
    if (req.userRole === 'faculty') {
      const teacherCheck = await client.query(
        'SELECT id FROM teacher_courses WHERE teacher_id = $1 AND course_id = $2',
        [req.userId, assessment.rows[0].course_id]
      );
      if (teacherCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }
    }

    // Validate score
    if (score < 0 || score > assessment.rows[0].max_score) {
      return res.status(400).json({
        error: `Score must be between 0 and ${assessment.rows[0].max_score}`
      });
    }

    // Record or update score
    const result = await client.query(
      `INSERT INTO student_assessments (student_id, assessment_id, score, feedback, graded_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (student_id, assessment_id) DO UPDATE SET
         score = EXCLUDED.score,
         feedback = EXCLUDED.feedback,
         graded_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [studentId, assessmentId, score, feedback]
    );

    res.json({
      message: 'Score recorded successfully',
      record: result.rows[0]
    });
  } catch (err) {
    console.error('Error recording score:', err);
    res.status(500).json({ error: 'Server error recording score' });
  } finally {
    if (client) client.release();
  }
});

// Get student's assessment scores
router.get('/student-scores/:courseId', verifyToken, async (req, res) => {
  if (req.userRole !== 'student') {
    return res.status(403).json({ error: 'Only students can view their assessment scores' });
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

    // Get assessment scores
    const scores = await client.query(
      `SELECT sa.*, a.title, a.type, a.max_score, a.weight, a.due_date
       FROM student_assessments sa
       JOIN assessments a ON sa.assessment_id = a.id
       WHERE sa.student_id = $1 AND a.course_id = $2
       ORDER BY a.due_date ASC`,
      [req.userId, courseId]
    );

    res.json({ scores: scores.rows });
  } catch (err) {
    console.error('Error fetching student scores:', err);
    res.status(500).json({ error: 'Server error fetching scores' });
  } finally {
    if (client) client.release();
  }
});
// GET /api/assessments/course-stats/:courseId
router.get('/course-stats/:courseId', verifyToken, async (req, res) => {
  const { courseId } = req.params;
  try {
    const client = await pool.connect();
    // Get all assessments for this course
    const assessments = await client.query(
      `SELECT id, title, max_score FROM assessments WHERE course_id = $1`,
      [courseId]
    );
    
    const stats = [];
    for (const ass of assessments.rows) {
      // Get all student scores for this assessment
      const scoresRes = await client.query(
        `SELECT score FROM student_assessments WHERE assessment_id = $1 AND score IS NOT NULL`,
        [ass.id]
      );
      const scores = scoresRes.rows.map(r => parseFloat(r.score));
      if (scores.length === 0) {
        stats.push({
          assessment_id: ass.id,
          title: ass.title,
          max_score: ass.max_score,
          count: 0,
          min: null,
          max: null,
          avg: null,
          median: null
        });
        continue;
      }
      scores.sort((a,b) => a - b);
      const sum = scores.reduce((a,b) => a + b, 0);
      const median = scores.length % 2 === 0
        ? (scores[scores.length/2 - 1] + scores[scores.length/2]) / 2
        : scores[Math.floor(scores.length/2)];
      stats.push({
        assessment_id: ass.id,
        title: ass.title,
        max_score: ass.max_score,
        count: scores.length,
        min: Math.min(...scores),
        max: Math.max(...scores),
        avg: (sum / scores.length).toFixed(2),
        median: median.toFixed(2)
      });
    }
    client.release();
    res.json({ statistics: stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assessment statistics' });
  }
});
// Get all student scores for a course (faculty only)
router.get('/course-scores/:courseId', verifyToken, async (req, res) => {
  if (req.userRole !== 'faculty' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Only faculty and admins can view course scores' });
  }

  const { courseId } = req.params;

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

    // Get all scores with student info
    const scores = await client.query(
      `SELECT sa.*, a.title, a.type, a.max_score, a.weight,
              s.name, s.student_id as student_number, s.email
       FROM student_assessments sa
       JOIN assessments a ON sa.assessment_id = a.id
       JOIN students s ON sa.student_id = s.id
       WHERE a.course_id = $1
       ORDER BY s.name ASC, a.due_date ASC`,
      [courseId]
    );

    // Calculate class statistics
    const assessmentStats = {};
    scores.rows.forEach(score => {
      if (!assessmentStats[score.assessment_id]) {
        assessmentStats[score.assessment_id] = {
          title: score.title,
          maxScore: score.max_score,
          scores: []
        };
      }
      assessmentStats[score.assessment_id].scores.push(score.score);
    });

    // Calculate statistics for each assessment
    Object.keys(assessmentStats).forEach(assessmentId => {
      const scores = assessmentStats[assessmentId].scores.sort((a, b) => a - b);
      const count = scores.length;
      const sum = scores.reduce((a, b) => a + b, 0);
      const mean = count > 0 ? sum / count : 0;
      const median = count > 0 ? (count % 2 === 0 ? (scores[count/2 - 1] + scores[count/2]) / 2 : scores[Math.floor(count/2)]) : 0;
      const min = count > 0 ? scores[0] : 0;
      const max = count > 0 ? scores[count - 1] : 0;

      assessmentStats[assessmentId].statistics = {
        count, mean, median, min, max
      };
    });

    res.json({
      scores: scores.rows,
      statistics: assessmentStats
    });
  } catch (err) {
    console.error('Error fetching course scores:', err);
    res.status(500).json({ error: 'Server error fetching course scores' });
  } finally {
    if (client) client.release();
  }
});

// Upload CSV grades
router.post('/upload-grades/:assessmentId', verifyToken, upload.single('csv'), async (req, res) => {
  if (req.userRole !== 'faculty' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Only faculty and admins can upload grades' });
  }

  const { assessmentId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'CSV file is required' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Get assessment info
    const assessment = await client.query(
      'SELECT * FROM assessments WHERE id = $1',
      [assessmentId]
    );

    if (assessment.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Verify teacher is assigned to this course
    if (req.userRole === 'faculty') {
      const teacherCheck = await client.query(
        'SELECT id FROM teacher_courses WHERE teacher_id = $1 AND course_id = $2',
        [req.userId, assessment.rows[0].course_id]
      );
      if (teacherCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'You are not assigned to this course' });
      }
    }

    // Parse CSV
    const results = [];
    fs.createReadStream(file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let successCount = 0;
          let errorCount = 0;
          const errors = [];

          for (const row of results) {
            try {
              // Find student by student_id or email
              let studentQuery = 'SELECT id FROM students WHERE ';
              let studentParams = [];

              if (row.student_id) {
                studentQuery += 'student_id = $1';
                studentParams = [row.student_id];
              } else if (row.email) {
                studentQuery += 'email = $1';
                studentParams = [row.email];
              } else {
                errors.push(`Row ${results.indexOf(row) + 1}: No student_id or email provided`);
                errorCount++;
                continue;
              }

              const student = await client.query(studentQuery, studentParams);

              if (student.rows.length === 0) {
                errors.push(`Row ${results.indexOf(row) + 1}: Student not found`);
                errorCount++;
                continue;
              }

              const studentId = student.rows[0].id;
              const score = parseFloat(row.score);

              if (isNaN(score) || score < 0 || score > assessment.rows[0].max_score) {
                errors.push(`Row ${results.indexOf(row) + 1}: Invalid score`);
                errorCount++;
                continue;
              }

              // Insert/update score
              await client.query(
                `INSERT INTO student_assessments (student_id, assessment_id, score, feedback, graded_at)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                 ON CONFLICT (student_id, assessment_id) DO UPDATE SET
                   score = EXCLUDED.score,
                   feedback = EXCLUDED.feedback,
                   graded_at = CURRENT_TIMESTAMP`,
                [studentId, assessmentId, score, row.feedback || '']
              );

              successCount++;
            } catch (err) {
              errors.push(`Row ${results.indexOf(row) + 1}: ${err.message}`);
              errorCount++;
            }
          }

          await client.query('COMMIT');

          // Clean up uploaded file
          fs.unlinkSync(file.path);

          res.json({
            message: `Grades uploaded successfully. ${successCount} records processed, ${errorCount} errors.`,
            successCount,
            errorCount,
            errors: errors.slice(0, 10) // Limit error messages
          });
        } catch (err) {
          await client.query('ROLLBACK');
          console.error('Error processing CSV:', err);
          fs.unlinkSync(file.path);
          res.status(500).json({ error: 'Server error processing CSV' });
        }
      })
      .on('error', (err) => {
        console.error('Error reading CSV:', err);
        res.status(400).json({ error: 'Invalid CSV file' });
      });
  } catch (err) {
    console.error('Error uploading grades:', err);
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    res.status(500).json({ error: 'Server error uploading grades' });
  } finally {
    if (client) client.release();
  }
});

// Toggle grade posting visibility
router.patch('/grades/:courseId/toggle-posting', verifyToken, async (req, res) => {
  if (req.userRole !== 'faculty' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Only faculty and admins can toggle grade posting' });
  }

  const { courseId } = req.params;
  const { isPosted } = req.body;

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

    // Update all grades for this course
    await client.query(
      'UPDATE grades SET is_posted = $1, updated_at = CURRENT_TIMESTAMP WHERE course_id = $2',
      [isPosted, courseId]
    );

    res.json({
      message: `Grades ${isPosted ? 'posted' : 'hidden'} successfully`
    });
  } catch (err) {
    console.error('Error toggling grade posting:', err);
    res.status(500).json({ error: 'Server error toggling grade posting' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;