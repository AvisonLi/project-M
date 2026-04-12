import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './FacultyPortal.css';

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

              <div className="two-column-layout">
                {/* Grade Form */}
                <div className="grade-form-section">
                  <h3>Record Grade</h3>
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
            </>
          ) : (
            <div className="empty-state">
              <p>👈 Select a course from the left panel to view enrollment and record grades</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FacultyPortal;
