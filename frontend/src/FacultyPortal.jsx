import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './FacultyPortal.css';
import GradeUploadPanel from './components/GradeUploadPanel';

function FacultyPortal({ token }) {
  const navigate = useNavigate();
  const storedToken = token || localStorage.getItem('authToken');
  const storedUser = JSON.parse(localStorage.getItem('user') || 'null');

  // Role-based access control
  useEffect(() => {
    if (!storedToken || storedUser?.role !== 'faculty') {
      navigate('/');
    }
  }, [storedToken, storedUser?.role, navigate]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('grades');
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [courseAssessments, setCourseAssessments] = useState([]);
  const [courseGrades, setCourseGrades] = useState([]);
  const [gradeStatistics, setGradeStatistics] = useState({});
  const [csvUploading, setCsvUploading] = useState(false);
  const [showGradeEntry, setShowGradeEntry] = useState(true);

  // Attendance session form
  const [attendanceForm, setAttendanceForm] = useState({
    title: '',
    sessionDate: '',
    startTime: '',
    endTime: '',
    checkinMethods: ['qr', 'manual'],
    bluetoothEnabled: false
  });

  // Assessment form
  const [assessmentForm, setAssessmentForm] = useState({
    title: '',
    type: 'exam',
    maxScore: 100,
    weight: 0,
    dueDate: ''
  });

  const [gradeForm, setGradeForm] = useState({
    studentId: '',
    courseId: '',
    grade: 'A',
    gpa: 4.0,
  });

  const axiosConfig = {
    headers: { Authorization: `Bearer ${storedToken}` },
  };

  // Auto-dismiss notifications after 10 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 10000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Fetch courses on component mount
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        if (!storedUser?.id) {
          setError('User information not available');
          return;
        }
        // Fetch only courses assigned to this teacher
        const res = await axios.get(`/api/admin/teacher-courses/${storedUser.id}`, axiosConfig);
        setCourses(res.data.courses);
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Failed to fetch courses';
        setError(errorMsg);
      }
    };

    if (storedUser?.id) {
      fetchCourses();
    }
  }, [token, storedUser?.id]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  // Fetch students when a course is selected
  const handleCourseSelect = async (courseId) => {
    setLoading(true);
    setError('');

    try {
      const res = await axios.get(`/api/admin/courses/${courseId}`, axiosConfig);
      setSelectedCourse(res.data.course);
      setStudents(res.data.enrollments);
      setGradeForm((prev) => ({ ...prev, courseId }));

      // Fetch existing grades for this course
      const gradesRes = await axios.get(`/api/grades/course/${courseId}`, axiosConfig);
      const gradesMap = {};
      gradesRes.data.grades.forEach((grade) => {
        gradesMap[grade.student_id] = grade;
      });
      setGrades(gradesMap);

      // Fetch additional data for the selected course
      fetchAttendanceSessions(courseId);
      fetchCourseAssessments(courseId);
      fetchCourseGrades(courseId);
    } catch (err) {
      setError('Failed to fetch course details');
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (e) => {
    const { name, value } = e.target;
    setGradeForm((prev) => ({
      ...prev,
      [name]: name === 'gpa' ? parseFloat(value) : value,
    }));
  };

  const handleSubmitGrade = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!gradeForm.studentId) {
      setError('Please select a student');
      return;
    }

    try {
      await axios.post('/api/grades/add', gradeForm, axiosConfig);
      setSuccess('Grade recorded successfully!');

      // Reset form
      setGradeForm({
        studentId: '',
        courseId: gradeForm.courseId,
        grade: 'A',
        gpa: 4.0,
      });

      // Refresh course grades
      setTimeout(() => {
        handleCourseSelect(gradeForm.courseId);
      }, 1000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to record grade';
      setError(errorMsg);
    }
  };

  const gradeOptions = [
    { value: 'A', gpa: 4.0 },
    { value: 'A-', gpa: 3.7 },
    { value: 'B+', gpa: 3.3 },
    { value: 'B', gpa: 3.0 },
    { value: 'B-', gpa: 2.7 },
    { value: 'C+', gpa: 2.3 },
    { value: 'C', gpa: 2.0 },
    { value: 'C-', gpa: 1.7 },
    { value: 'D+', gpa: 1.3 },
    { value: 'D', gpa: 1.0 },
    { value: 'D-', gpa: 0.7 },
    { value: 'F', gpa: 0.0 },
  ];

  const handleGradeSelectChange = (e) => {
    const selectedGrade = gradeOptions.find((g) => g.value === e.target.value);
    setGradeForm((prev) => ({
      ...prev,
      grade: selectedGrade.value,
      gpa: selectedGrade.gpa,
    }));
  };

  const handleStudentSelect = (studentId) => {
    const studentGrade = grades[studentId];
    setGradeForm((prev) => ({
      ...prev,
      studentId,
      grade: studentGrade ? studentGrade.grade : 'A',
      gpa: studentGrade ? studentGrade.gpa : 4.0,
    }));
  };

  // Attendance Management Functions
  const fetchAttendanceSessions = async (courseId) => {
    try {
      const res = await axios.get(`/api/attendance/sessions/${courseId}`, axiosConfig);
      setAttendanceSessions(res.data.sessions);
    } catch (err) {
      console.error('Error fetching attendance sessions:', err);
    }
  };

  const handleCreateAttendanceSession = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/attendance/sessions', {
        ...attendanceForm,
        courseId: selectedCourse.id
      }, axiosConfig);
      setSuccess('Attendance session created successfully!');
      setAttendanceForm({
        title: '',
        sessionDate: '',
        startTime: '',
        endTime: '',
        checkinMethods: ['qr', 'manual'],
        bluetoothEnabled: false
      });
      fetchAttendanceSessions(selectedCourse.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create attendance session');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttendanceRecords = async (sessionId) => {
    try {
      const res = await axios.get(`/api/attendance/records/${sessionId}`, axiosConfig);
      setSelectedSession(res.data.session);
      setAttendanceRecords(res.data.records);
    } catch (err) {
      setError('Failed to fetch attendance records');
    }
  };

  // Assessment Management Functions
  const fetchCourseAssessments = async (courseId) => {
    try {
      const res = await axios.get(`/api/assessments/assessments/${courseId}`, axiosConfig);
      setCourseAssessments(res.data.assessments);
    } catch (err) {
      console.error('Error fetching assessments:', err);
    }
  };

  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/assessments/assessments', {
        ...assessmentForm,
        courseId: selectedCourse.id
      }, axiosConfig);
      setSuccess('Assessment created successfully!');
      setAssessmentForm({
        title: '',
        type: 'exam',
        maxScore: 100,
        weight: 0,
        dueDate: ''
      });
      fetchCourseAssessments(selectedCourse.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create assessment');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseGrades = async (courseId) => {
    try {
      const res = await axios.get(`/api/assessments/course-scores/${courseId}`, axiosConfig);
      setCourseGrades(res.data.scores);
      setGradeStatistics(res.data.statistics);
    } catch (err) {
      console.error('Error fetching course grades:', err);
    }
  };

  const handleRecordAssessmentScore = async (studentId, assessmentId, score, feedback) => {
    try {
      await axios.post('/api/assessments/scores', {
        assessmentId,
        studentId,
        score: parseFloat(score),
        feedback
      }, axiosConfig);
      setSuccess('Score recorded successfully!');
      fetchCourseGrades(selectedCourse.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record score');
    }
  };

  const handleToggleGradePosting = async (isPosted) => {
    try {
      await axios.patch(`/api/assessments/grades/${selectedCourse.id}/toggle-posting`, {
        isPosted
      }, axiosConfig);
      setSuccess(`Grades ${isPosted ? 'posted' : 'hidden'} successfully!`);
      fetchCourseGrades(selectedCourse.id);
    } catch (err) {
      setError('Failed to toggle grade posting');
    }
  };

  const handleUploadGradesCsv = async (assessmentId, file) => {
    if (!assessmentId || !file) {
      setError('請先選擇 assessment 與 CSV 檔案');
      return;
    }

    setCsvUploading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('csv', file);

      const res = await axios.post(
        `/api/assessments/upload-grades/${assessmentId}`,
        formData,
        {
          ...axiosConfig,
          headers: {
            ...axiosConfig.headers,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setSuccess(res.data.message || 'CSV 成績上傳成功');
      if (selectedCourse?.id) {
        fetchCourseGrades(selectedCourse.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'CSV 成績上傳失敗');
    } finally {
      setCsvUploading(false);
    }
  };

  return (
    <div className="faculty-container">
      <div className="portal-header">
        <h1 className="faculty-title">👨‍🏫 Faculty Portal</h1>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="faculty-layout">
        {/* Course Selection Panel */}
        <div className="course-panel">
          <h2>Courses</h2>
          <div className="courses-list">
            {courses.length > 0 ? (
              courses.map((course) => (
                <button
                  key={course.id}
                  className={`course-btn ${selectedCourse?.id === course.id ? 'active' : ''}`}
                  onClick={() => handleCourseSelect(course.id)}
                >
                  <div className="course-btn-code">{course.code}</div>
                  <div className="course-btn-title">{course.title}</div>
                  <div className="course-btn-count">
                    {course.current_enrollments}/{course.capacity}
                  </div>
                </button>
              ))
            ) : (
              <p className="no-courses">No courses available</p>
            )}
          </div>
        </div>

        {/* Main Content Panel */}
        <div className="content-panel">
          {selectedCourse ? (
            <>
              <div className="course-header">
                <h2>{selectedCourse.code}</h2>
                <p className="course-description">{selectedCourse.title}</p>
                <div className="course-stats">
                  <span>
                    Enrolled: <strong>{selectedCourse.current_enrollments}</strong>
                  </span>
                  <span>
                    Capacity: <strong>{selectedCourse.capacity}</strong>
                  </span>
                </div>
              </div>

              {/* Course Tabs */}
              <div className="course-tabs">
                <button
                  className={activeTab === 'grades' ? 'tab-active' : 'tab-inactive'}
                  onClick={() => setActiveTab('grades')}
                >
                  Grade Management
                </button>
                <button
                  className={activeTab === 'attendance' ? 'tab-active' : 'tab-inactive'}
                  onClick={() => setActiveTab('attendance')}
                >
                  Attendance
                </button>
                <button
                  className={activeTab === 'assessments' ? 'tab-active' : 'tab-inactive'}
                  onClick={() => setActiveTab('assessments')}
                >
                  Assessments
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'grades' && (
                <div className="two-column-layout">
                  {/* Grade Form */}
                  <div className="grade-form-section">
                    <h3>Record Final Grade</h3>
                    <form onSubmit={handleSubmitGrade}>
                      <div className="form-group">
                        <label htmlFor="student-select">Student (Click student below to select)</label>
                        <select
                          id="student-select"
                          name="studentId"
                          value={gradeForm.studentId}
                          onChange={(e) =>
                            setGradeForm((prev) => ({ ...prev, studentId: e.target.value }))
                          }
                          disabled
                        >
                          <option value="">
                            {gradeForm.studentId
                              ? students.find(s => s.id == gradeForm.studentId)?.name || 'Unknown Student'
                              : '-- Select a student from the list below --'
                            }
                          </option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="grade-select">Grade</label>
                        <select
                          id="grade-select"
                          value={gradeForm.grade}
                          onChange={handleGradeSelectChange}
                        >
                          {gradeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.value} (GPA: {option.gpa})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="gpa-input">GPA</label>
                        <input
                          type="number"
                          id="gpa-input"
                          name="gpa"
                          value={gradeForm.gpa}
                          onChange={handleGradeChange}
                          step="0.1"
                          min="0"
                          max="4.0"
                          readOnly
                        />
                      </div>

                      <button type="submit" className="submit-btn">
                        Record Grade
                      </button>
                    </form>

                    <div className="grade-posting-controls">
                      <h4>Grade Visibility</h4>
                      <button
                        onClick={() => handleToggleGradePosting(true)}
                        className="btn-success"
                      >
                        Post Grades
                      </button>
                      <button
                        onClick={() => handleToggleGradePosting(false)}
                        className="btn-warning"
                      >
                        Hide Grades
                      </button>
                    </div>
                  </div>

                  {/* Student List */}
                  <div className="student-list-section">
                    <h3>Enrolled Students ({students.length})</h3>
                    {loading ? (
                      <p className="loading">Loading...</p>
                    ) : students.length > 0 ? (
                      <div className="students-list">
                        {students.map((student) => {
                          const studentGrade = grades[student.id];
                          return (
                            <div
                              key={student.id}
                              className={`student-item ${gradeForm.studentId === student.id ? 'selected' : ''}`}
                              onClick={() => handleStudentSelect(student.id)}
                            >
                              <div className="student-info">
                                <p className="student-name">
                                  {student.student_id ? `${student.student_id} - ` : ''}{student.name}
                                </p>
                                <p className="student-email">{student.email}</p>
                                <p className="student-grade">
                                  Current Grade: {studentGrade ? `${studentGrade.grade} (${studentGrade.gpa} GPA)` : 'Not graded yet'}
                                </p>
                                <p className="enrolled-date">
                                  Enrolled: {new Date(student.enrolled_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="no-students">No students enrolled in this course</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'attendance' && (
                <div className="attendance-section">
                  <div className="attendance-form-section">
                    <h3>Create Attendance Session</h3>
                    <form onSubmit={handleCreateAttendanceSession}>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Session Title</label>
                          <input
                            type="text"
                            value={attendanceForm.title}
                            onChange={(e) => setAttendanceForm({...attendanceForm, title: e.target.value})}
                            placeholder="e.g., Lecture 1"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Session Date</label>
                          <input
                            type="date"
                            value={attendanceForm.sessionDate}
                            onChange={(e) => setAttendanceForm({...attendanceForm, sessionDate: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Start Time</label>
                          <input
                            type="time"
                            value={attendanceForm.startTime}
                            onChange={(e) => setAttendanceForm({...attendanceForm, startTime: e.target.value})}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>End Time</label>
                          <input
                            type="time"
                            value={attendanceForm.endTime}
                            onChange={(e) => setAttendanceForm({...attendanceForm, endTime: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Check-in Methods</label>
                        <div className="checkbox-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={attendanceForm.checkinMethods.includes('qr')}
                              onChange={(e) => {
                                const methods = e.target.checked
                                  ? [...attendanceForm.checkinMethods, 'qr']
                                  : attendanceForm.checkinMethods.filter(m => m !== 'qr');
                                setAttendanceForm({...attendanceForm, checkinMethods: methods});
                              }}
                            />
                            QR Code
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={attendanceForm.checkinMethods.includes('manual')}
                              onChange={(e) => {
                                const methods = e.target.checked
                                  ? [...attendanceForm.checkinMethods, 'manual']
                                  : attendanceForm.checkinMethods.filter(m => m !== 'manual');
                                setAttendanceForm({...attendanceForm, checkinMethods: methods});
                              }}
                            />
                            Manual Code
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={attendanceForm.bluetoothEnabled}
                              onChange={(e) => setAttendanceForm({...attendanceForm, bluetoothEnabled: e.target.checked})}
                            />
                            Bluetooth Proximity
                          </label>
                        </div>
                      </div>
                      <button type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Session'}
                      </button>
                    </form>
                  </div>

                  <div className="attendance-sessions-section">
                    <h3>Attendance Sessions</h3>
                    {attendanceSessions.length > 0 ? (
                      <div className="sessions-list">
                        {attendanceSessions.map(session => {
                          let allowedMethods = [];
                          if (Array.isArray(session.checkin_methods)) {
                            allowedMethods = session.checkin_methods;
                          } else if (typeof session.checkin_methods === 'string') {
                            try {
                              const parsedMethods = JSON.parse(session.checkin_methods);
                              allowedMethods = Array.isArray(parsedMethods) ? parsedMethods : [];
                            } catch (e) {
                              allowedMethods = [];
                            }
                          }
                          return (
                            <div key={session.id} className="session-item">
                              <div className="session-info">
                                <h4>{session.title}</h4>
                                <p>{new Date(session.session_date).toLocaleDateString()} {session.start_time} - {session.end_time}</p>
                                <p>Methods: {allowedMethods.length > 0 ? allowedMethods.join(', ') : 'Not specified'}</p>
                                {allowedMethods.includes('manual') && <p><strong>Manual Code:</strong> <code>{session.manual_code}</code></p>}
                                {allowedMethods.includes('qr') && <p><strong>QR Code:</strong> <code>{session.qr_code}</code></p>}
                              </div>
                              <button onClick={() => handleViewAttendanceRecords(session.id)}>
                                View Records
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p>No attendance sessions created yet.</p>
                    )}
                  </div>

                  {selectedSession && (
                    <div className="attendance-records-section">
                      <h3>Attendance Records - {selectedSession.title}</h3>
                      {attendanceRecords.length > 0 ? (
                        <div className="records-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Student</th>
                                <th>Check-in Method</th>
                                <th>Check-in Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendanceRecords.map(record => (
                                <tr key={record.id}>
                                  <td>{record.name} ({record.student_id})</td>
                                  <td>{record.checkin_method}</td>
                                  <td>{new Date(record.checkin_time).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p>No attendance records for this session.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'assessments' && (
                <div className="assessments-section">
                  <div className="assessment-form-section">
                    <h3>Create Assessment</h3>
                    <form onSubmit={handleCreateAssessment}>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Title</label>
                          <input
                            type="text"
                            value={assessmentForm.title}
                            onChange={(e) => setAssessmentForm({...assessmentForm, title: e.target.value})}
                            placeholder="e.g., Midterm Exam"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Type</label>
                          <select
                            value={assessmentForm.type}
                            onChange={(e) => setAssessmentForm({...assessmentForm, type: e.target.value})}
                          >
                            <option value="exam">Exam</option>
                            <option value="quiz">Quiz</option>
                            <option value="homework">Homework</option>
                            <option value="project">Project</option>
                            <option value="lab">Lab</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Max Score</label>
                          <input
                            type="number"
                            value={assessmentForm.maxScore}
                            onChange={(e) => setAssessmentForm({...assessmentForm, maxScore: parseFloat(e.target.value)})}
                            min="0"
                            step="0.1"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Weight (%)</label>
                          <input
                            type="number"
                            value={assessmentForm.weight}
                            onChange={(e) => setAssessmentForm({...assessmentForm, weight: parseFloat(e.target.value)})}
                            min="0"
                            max="100"
                            step="0.1"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Due Date</label>
                          <input
                            type="date"
                            value={assessmentForm.dueDate}
                            onChange={(e) => setAssessmentForm({...assessmentForm, dueDate: e.target.value})}
                          />
                        </div>
                      </div>
                      <button type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Assessment'}
                      </button>
                    </form>
                  </div>

                  <div className="assessments-list-section">
                    <h3>Course Assessments</h3>
                    {courseAssessments.length > 0 ? (
                      <div className="assessments-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Title</th>
                              <th>Type</th>
                              <th>Max Score</th>
                              <th>Weight</th>
                              <th>Due Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courseAssessments.map(assessment => (
                              <tr key={assessment.id}>
                                <td>{assessment.title}</td>
                                <td>{assessment.type}</td>
                                <td>{assessment.max_score}</td>
                                <td>{assessment.weight}%</td>
                                <td>{assessment.due_date ? new Date(assessment.due_date).toLocaleDateString() : 'No due date'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p>No assessments created yet.</p>
                    )}
                  </div>

                  <GradeUploadPanel
                    assessments={courseAssessments}
                    onUpload={handleUploadGradesCsv}
                    uploading={csvUploading}
                  />

                  <div className="grade-entry-section">
                    <div className="form-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0 }}>Grade Entry</h3>
                      <button
                        type="button"
                        className="btn-warning"
                        onClick={() => setShowGradeEntry((prev) => !prev)}
                      >
                        {showGradeEntry ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {showGradeEntry ? (
                      courseGrades.length > 0 ? (
                        <div className="grade-entry-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Student</th>
                                {courseAssessments.map(assessment => (
                                  <th key={assessment.id}>{assessment.title}</th>
                                ))}
                                <th>Final Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {courseGrades.map(student => (
                                <tr key={student.student_id}>
                                  <td>{student.name} ({student.student_id})</td>
                                  {courseAssessments.map(assessment => {
                                    const studentAssessment = student.assessments?.find(a => a.assessment_id === assessment.id);
                                    return (
                                      <td key={assessment.id}>
                                        <input
                                          type="number"
                                          placeholder="Score"
                                          value={studentAssessment?.score || ''}
                                          onChange={(e) => {
                                            const score = e.target.value;
                                            if (score) {
                                              handleRecordAssessmentScore(
                                                student.student_id,
                                                assessment.id,
                                                score,
                                                studentAssessment?.feedback || ''
                                              );
                                            }
                                          }}
                                          min="0"
                                          max={assessment.max_score}
                                          step="0.1"
                                        />
                                      </td>
                                    );
                                  })}
                                  <td>{student.grade || 'Not graded'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p>No students enrolled or no assessments created.</p>
                      )
                    ) : null}
                  </div>

                  {gradeStatistics && Object.keys(gradeStatistics).length > 0 && (
                    <div className="grade-statistics-section">
                      <h3>Class Statistics</h3>
                      {Object.entries(gradeStatistics).map(([assessmentId, stats]) => {
                        const statData = stats?.statistics || {};
                        const mean = Number(statData.mean);
                        const median = Number(statData.median);
                        const min = Number(statData.min);
                        const max = Number(statData.max);
                        return (
                          <div key={assessmentId} className="assessment-stats">
                            <h4>{stats.title}</h4>
                            <div className="stats-grid">
                              <div>Count: {statData.count ?? 0}</div>
                              <div>Mean: {Number.isFinite(mean) ? mean.toFixed(2) : 'N/A'}</div>
                              <div>Median: {Number.isFinite(median) ? median.toFixed(2) : 'N/A'}</div>
                              <div>Min: {Number.isFinite(min) ? min.toFixed(2) : 'N/A'}</div>
                              <div>Max: {Number.isFinite(max) ? max.toFixed(2) : 'N/A'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <p>👈 Select a course from the left panel to view enrollment and manage grades</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FacultyPortal;
