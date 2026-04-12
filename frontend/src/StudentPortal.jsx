import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './StudentPortal.css';

function StudentPortal({ user, token }) {
  const navigate = useNavigate();
  const storedToken = token || localStorage.getItem('authToken');
  const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
  const currentUser = user || storedUser || { name: 'Student', email: '' };

  // Role-based access control
  useEffect(() => {
    if (!storedToken || currentUser.role !== 'student') {
      navigate('/');
    }
  }, [storedToken, currentUser.role, navigate]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [courses, setCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [gradesStats, setGradesStats] = useState({ cumulativeGpa: 0, courseCount: 0 });
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Fetch enrolled courses and grades on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const enrolledRes = await axios.get('/api/register/my-courses', axiosConfig);
        setEnrolledCourses(enrolledRes.data.enrolledCourses || []);

        const gradesRes = await axios.get('/api/grades/my-grades', axiosConfig);
        setGrades(gradesRes.data.grades || []);
        setGradesStats({
          cumulativeGpa: gradesRes.data.cumulativeGpa || 0,
          courseCount: gradesRes.data.courseCount || 0,
        });
      } catch (err) {
        console.error('Initial data fetch error:', err);
      }
    };
    fetchInitialData();
  }, [storedToken]);

  // Fetch data based on active tab
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        if (activeTab === 'dashboard') {
          const res = await axios.get('/api/profile/me/statistics', axiosConfig);
          setStatistics(res.data);
        } else if (activeTab === 'courses') {
          // Refresh enrolled courses to update register button status
          const enrolledRes = await axios.get('/api/register/my-courses', axiosConfig);
          setEnrolledCourses(enrolledRes.data.enrolledCourses || []);

          const res = await axios.get('/api/register/courses/available', axiosConfig);
          setCourses(res.data.courses || []);
        } else if (activeTab === 'grades') {
          // Refresh grades data when switching to grades tab
          const gradesRes = await axios.get('/api/grades/my-grades', axiosConfig);
          setGrades(gradesRes.data.grades || []);
          setGradesStats({
            cumulativeGpa: gradesRes.data.cumulativeGpa || 0,
            courseCount: gradesRes.data.courseCount || 0,
          });
        }
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Failed to fetch data';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  const handleRegisterCourse = async (courseId) => {
    try {
      await axios.post('/api/register', { courseId }, axiosConfig);
      setSuccess('Successfully registered for the course!');
      setTimeout(() => setSuccess(''), 3000);

      // Refresh enrolled courses
      const enrolledRes = await axios.get('/api/register/my-courses', axiosConfig);
      setEnrolledCourses(enrolledRes.data.enrolledCourses || []);

      // Refresh available courses
      const availableRes = await axios.get('/api/register/courses/available', axiosConfig);
      setCourses(availableRes.data.courses || []);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to register for course';
      setError(errorMsg);
    }
  };

  const handleWithdrawCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to withdraw from this course?')) return;

    try {
      await axios.delete(`/api/register/${courseId}`, axiosConfig);
      setSuccess('Successfully withdrawn from the course!');
      setTimeout(() => setSuccess(''), 3000);

      // Refresh enrolled courses
      const res = await axios.get('/api/register/my-courses', axiosConfig);
      setEnrolledCourses(res.data.enrolledCourses);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to withdraw from course';
      setError(errorMsg);
    }
  };

  const filteredCourses = courses.filter(
    (course) =>
      course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isEnrolled = (courseId) => enrolledCourses.some(ec => ec.id === courseId);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="portal-container">
      <div className="portal-header">
        <h1 className="portal-title">👨‍🎓 Student Portal</h1>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          📚 Browse Courses
        </button>
        <button
          className={`tab-btn ${activeTab === 'enrolled' ? 'active' : ''}`}
          onClick={() => setActiveTab('enrolled')}
        >
          ✓ My Courses
        </button>
        <button
          className={`tab-btn ${activeTab === 'grades' ? 'active' : ''}`}
          onClick={() => setActiveTab('grades')}
        >
          📈 My Grades
        </button>
      </div>

      <div className="tab-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && statistics && (
              <div className="dashboard-content">
                <div className="welcome-section">
                  <h2>Welcome, {currentUser.name}!</h2>
                  <p className="email-info">Email: {currentUser.email}</p>
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">📚</div>
                    <div className="stat-details">
                      <div className="stat-value">{statistics.statistics.enrolledCoursesCount}</div>
                      <div className="stat-label">Enrolled Courses</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">📋</div>
                    <div className="stat-details">
                      <div className="stat-value">{statistics.statistics.totalGrades}</div>
                      <div className="stat-label">Grades Recorded</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">⭐</div>
                    <div className="stat-details">
                      <div className="stat-value">{statistics.statistics.averageGpa || 'N/A'}</div>
                      <div className="stat-label">Average GPA</div>
                    </div>
                  </div>
                </div>

                {statistics.recentEnrollments.length > 0 && (
                  <div className="recent-section">
                    <h3>Recent Enrollments</h3>
                    <div className="recent-list">
                      {statistics.recentEnrollments.map((enrollment) => (
                        <div key={enrollment.id} className="recent-item">
                          <span className="course-code">{enrollment.code}</span>
                          <span className="course-title">{enrollment.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Browse Courses Tab */}
            {activeTab === 'courses' && (
              <div className="courses-content">
                <div className="search-bar">
                  <input
                    type="text"
                    placeholder="Search courses by code or title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {filteredCourses.length > 0 ? (
                  <div className="courses-grid">
                    {filteredCourses.map((course) => (
                      <div key={course.id} className="course-card">
                        <div className="course-header">
                          <h3>{course.code}</h3>
                          {course.is_full ? <span className="badge badge-full">Full</span> : 
                           <span className="badge badge-open">Open</span>}
                        </div>
                        <p className="course-title">{course.title}</p>
                        <div className="course-stats">
                          <div className="stat">
                            <span>Capacity:</span>
                            <strong>{course.capacity}</strong>
                          </div>
                          <div className="stat">
                            <span>Enrolled:</span>
                            <strong>{course.current_enrollments}</strong>
                          </div>
                          <div className="stat">
                            <span>Available:</span>
                            <strong>{course.available_slots}</strong>
                          </div>
                        </div>
                        {isEnrolled(course.id) ? (
                          <button className="registered-btn" disabled>Registered</button>
                        ) : (
                          <button
                            className="register-btn"
                            onClick={() => handleRegisterCourse(course.id)}
                            disabled={course.is_full}
                          >
                            {course.is_full ? 'Course Full' : 'Register'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-data">No courses found matching your search</div>
                )}
              </div>
            )}

            {/* My Courses Tab */}
            {activeTab === 'enrolled' && (
              <div className="enrolled-content">
                {enrolledCourses.length > 0 ? (
                  <div className="enrolled-list">
                    {enrolledCourses.map((course) => (
                      <div key={course.id} className="enrolled-item">
                        <div className="enrolled-info">
                          <h3>{course.code}</h3>
                          <p className="course-title">{course.title}</p>
                          <p className="enrolled-date">
                            Enrolled: {new Date(course.enrolled_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          className="withdraw-btn"
                          onClick={() => handleWithdrawCourse(course.id)}
                        >
                          Withdraw
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-data">You are not enrolled in any courses yet</div>
                )}
              </div>
            )}

            {/* Grades Tab */}
            {activeTab === 'grades' && (
              <div className="grades-content">
                {grades && grades.length > 0 ? (
                  <>
                    <div className="gpa-summary">
                      <div className="gpa-box">
                        <h3>Cumulative GPA</h3>
                        <div className="gpa-value">{gradesStats.cumulativeGpa > 0 ? parseFloat(gradesStats.cumulativeGpa).toFixed(2) : 'N/A'}</div>
                      </div>
                      <div className="gpa-box">
                        <h3>Courses with Grades</h3>
                        <div className="gpa-value">{gradesStats.courseCount}</div>
                      </div>
                    </div>

                    <table className="grades-table">
                      <thead>
                        <tr>
                          <th>Course Code</th>
                          <th>Course Title</th>
                          <th>Grade</th>
                          <th>GPA</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grades.map((grade) => (
                          <tr key={grade.id}>
                            <td className="code">{grade.code}</td>
                            <td>{grade.title}</td>
                            <td className="grade">{grade.grade}</td>
                            <td className="gpa">{parseFloat(grade.gpa).toFixed(2)}</td>
                            <td>{new Date(grade.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div className="no-data">No grades recorded yet</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default StudentPortal;
