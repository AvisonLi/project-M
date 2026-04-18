import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './StudentPortal.css';

function StudentPortal({ user, token }) {
  const navigate = useNavigate();
  const storedToken = token || localStorage.getItem('authToken');
  const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
  const currentUser = user || storedUser || { name: 'Student', email: '', role: 'student' };

  // Role-based access control
  useEffect(() => {
    if (!storedToken || currentUser.role !== 'student') {
      navigate('/');
    }
  }, [storedToken, currentUser.role, navigate]);

  // Tab state
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data states
  const [profile, setProfile] = useState(null);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [academicHistory, setAcademicHistory] = useState({ history: [], summary: {} });
  const [statistics, setStatistics] = useState(null);
  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [selectedCourseForDetails, setSelectedCourseForDetails] = useState(null);
  const [assessmentStats, setAssessmentStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    major: '',
    year: ''
  });

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Attendance check-in state
  const [checkinCode, setCheckinCode] = useState('');
  const [checkinCourseId, setCheckinCourseId] = useState('');
  const [checkinSessionId, setCheckinSessionId] = useState('');
  const [checkinMethod, setCheckinMethod] = useState('manual');
  const [courseSessions, setCourseSessions] = useState([]);

  const axiosConfig = {
    headers: { Authorization: `Bearer ${storedToken}` }
  };

  // Auto-dismiss notifications
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ----- Data fetching functions (with safety guards) -----
  const fetchProfile = async () => {
    try {
      const res = await axios.get('/api/student/profile', axiosConfig);
      setProfile(res.data.profile);
      setProfileForm({
        name: res.data.profile.name,
        email: res.data.profile.email,
        phone: res.data.profile.phone || '',
        address: res.data.profile.address || '',
        major: res.data.profile.major || '',
        year: res.data.profile.year || ''
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchEnrolledCourses = async () => {
    try {
      const res = await axios.get('/api/registration/my-courses', axiosConfig);
      setEnrolledCourses(res.data.enrollments || []);
    } catch (err) {
      console.error('Error fetching enrolled courses:', err);
    }
  };

  const fetchAvailableCourses = async () => {
    try {
      const res = await axios.get('/api/registration/available', axiosConfig);
      setAvailableCourses(res.data.courses || []);
      setRegistrationStatus(res.data);
    } catch (err) {
      console.error('Error fetching available courses:', err);
    }
  };

  const fetchGrades = async () => {
    try {
      const res = await axios.get('/api/student/current-grades', axiosConfig);
      setGrades(res.data.courses || []);
    } catch (err) {
      console.error('Error fetching grades:', err);
    }
  };

  const fetchAssessments = async (courseId) => {
    if (!courseId) return;
    if (!enrolledCourses.some(c => c.id === courseId)) {
      console.warn(`Not enrolled in course ${courseId}, skipping assessments fetch.`);
      setAssessments([]);
      return;
    }
    try {
      const res = await axios.get(`/api/assessments/student-scores/${courseId}`, axiosConfig);
      setAssessments(res.data.scores || []);
    } catch (err) {
      console.error('Error fetching assessments:', err);
      setAssessments([]);
    }
  };

  const fetchAttendance = async (courseId) => {
    if (!courseId) return;
    if (!enrolledCourses.some(c => c.id === courseId)) {
      console.warn(`Not enrolled in course ${courseId}, skipping attendance fetch.`);
      setAttendance([]);
      return;
    }
    try {
      const res = await axios.get(`/api/attendance/student/${courseId}`, axiosConfig);
      setAttendance(res.data.records || []);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setAttendance([]);
    }
  };

  const fetchCourseSessions = async (courseId) => {
    if (!courseId) {
      setCourseSessions([]);
      return;
    }

    try {
      const res = await axios.get(`/api/attendance/sessions/${courseId}`, axiosConfig);
      setCourseSessions(res.data.sessions || []);
    } catch (err) {
      console.error('Error fetching attendance sessions:', err);
      setCourseSessions([]);
    }
  };

  const fetchStatistics = async () => {
    try {
      const res = await axios.get('/api/student/statistics', axiosConfig);
      setStatistics(res.data);
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  const fetchAcademicHistory = async () => {
    try {
      const res = await axios.get('/api/student/academic-history', axiosConfig);
      setAcademicHistory(res.data);
    } catch (err) {
      console.error('Error fetching academic history:', err);
    }
  };

  const fetchAssessmentStats = async (courseId) => {
    if (!courseId) return;
    if (!enrolledCourses.some(c => c.id === courseId)) {
      console.warn(`Not enrolled in course ${courseId}, skipping statistics fetch.`);
      setAssessmentStats([]);
      return;
    }
    try {
      const res = await axios.get(`/api/assessments/course-stats/${courseId}`, axiosConfig);
      setAssessmentStats(res.data.statistics || []);
    } catch (err) {
      console.error('Error fetching assessment stats:', err);
      setAssessmentStats([]);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchProfile();
    fetchEnrolledCourses();
    fetchGrades();
    fetchStatistics();
    fetchAcademicHistory();
  }, []);

  // Load available courses when entering the registration tab
  useEffect(() => {
    if (activeTab === 'courses') {
      fetchAvailableCourses();
    }
  }, [activeTab]);

  // When a course is selected for detailed view (assessments/attendance)
  useEffect(() => {
    if (selectedCourseForDetails) {
      fetchAssessments(selectedCourseForDetails);
      fetchAttendance(selectedCourseForDetails);
      fetchAssessmentStats(selectedCourseForDetails);
    } else {
      setAssessments([]);
      setAttendance([]);
      setAssessmentStats([]);
    }
  }, [selectedCourseForDetails]);

  // Reset selected course if it's no longer in enrolledCourses (safety guard)
  useEffect(() => {
    if (selectedCourseForDetails && !enrolledCourses.some(c => c.id === selectedCourseForDetails)) {
      setSelectedCourseForDetails(null);
    }
  }, [enrolledCourses, selectedCourseForDetails]);

  // ----- Actions -----
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.put('/api/student/profile', profileForm, axiosConfig);
      setSuccess('Profile updated successfully!');
      setEditingProfile(false);
      fetchProfile();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setLoading(false);
      return;
    }
    try {
      await axios.put('/api/student/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      }, axiosConfig);
      setSuccess('Password changed successfully!');
      setChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleCourseRegistration = async (courseId) => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`/api/registration/enroll/${courseId}`, {}, axiosConfig);
      setSuccess('Successfully registered for course!');
      await fetchAvailableCourses();
      await fetchEnrolledCourses();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register for course');
    } finally {
      setLoading(false);
    }
  };

  const handleCourseDrop = async (courseId) => {
    if (!window.confirm('Are you sure you want to drop this course?')) return;
    setLoading(true);
    setError('');
    try {
      await axios.post(`/api/registration/drop/${courseId}`, {}, axiosConfig);
      setSuccess('Course dropped successfully!');
      await fetchEnrolledCourses();
      await fetchAvailableCourses();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to drop course');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!checkinCourseId || !checkinSessionId || !checkinMethod) {
      setError('Please select a course, session, and check-in method');
      return;
    }

    const selectedSession = courseSessions.find((session) => session.id === checkinSessionId);
    if (!selectedSession) {
      setError('Selected attendance session is invalid');
      return;
    }

    if ((checkinMethod === 'manual' || checkinMethod === 'qr') && !checkinCode.trim()) {
      setError('Please enter the check-in code');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/attendance/checkin', {
        sessionId: checkinSessionId,
        method: checkinMethod,
        code: checkinMethod === 'manual' || checkinMethod === 'qr' ? checkinCode.trim() : undefined,
      }, axiosConfig);
      setSuccess('Check-in successful!');
      setCheckinCode('');
      setCheckinCourseId('');
      setCheckinSessionId('');
      setCheckinMethod('manual');
      setCourseSessions([]);
      if (selectedCourseForDetails) {
        fetchAttendance(selectedCourseForDetails);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCheckinSessionId('');
    setCheckinMethod('manual');
    setCheckinCode('');
    fetchCourseSessions(checkinCourseId);
  }, [checkinCourseId]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  // Helper for course search
  const filteredCourses = availableCourses.filter(course =>
    course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ----- Render functions -----
  const renderDashboard = () => (
    <div className="dashboard-content">
      <div className="welcome-section">
        <h2>Welcome back, {profile?.name || currentUser.name}!</h2>
        <div className="student-info">
          <p><strong>Student ID:</strong> {profile?.student_id}</p>
          <p><strong>Major:</strong> {profile?.major || 'Not specified'}</p>
          <p><strong>Year:</strong> {profile?.year || 'Not specified'}</p>
          <p><strong>GPA:</strong> {(() => { const g = parseFloat(profile?.gpa); return isNaN(g) ? 'N/A' : g.toFixed(2); })()}</p>
        </div>
      </div>

      {statistics && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Current Courses</h3>
            <p className="stat-number">{statistics.enrollmentStats?.current_enrollments || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Completed Courses</h3>
            <p className="stat-number">{statistics.enrollmentStats?.completed_courses || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Current GPA</h3>
            <p className="stat-number">{(() => { const gpa = parseFloat(statistics.gradeStats?.average_gpa); return isNaN(gpa) ? 'N/A' : gpa.toFixed(2); })()}</p>
          </div>
          <div className="stat-card">
            <h3>Attendance Rate</h3>
            <p className="stat-number">{parseFloat(statistics.attendanceStats?.attendance_percentage)?.toFixed(1) || 0}%</p>
          </div>
        </div>
      )}

      <div className="current-courses">
        <h3>Current Semester Courses</h3>
        {enrolledCourses.length > 0 ? (
          <div className="courses-grid">
            {enrolledCourses.map(course => (
              <div key={course.id} className="course-card">
                <h4>{course.code}</h4>
                <p>{course.title}</p>
                <p className="course-credits">{course.credits} credits</p>
                <div className="course-actions">
                  <button onClick={() => { setActiveTab('grades'); setSelectedCourseForDetails(course.id); }}>View Grades</button>
                  <button onClick={() => { setActiveTab('attendance'); setSelectedCourseForDetails(course.id); }}>View Attendance</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p>No courses enrolled for current semester.</p>}
      </div>
    </div>
  );

  const renderProfile = () => {
    if (!profile) return <div className="loading">Loading profile...</div>;

    return (
      <div className="profile-content">
        <div className="profile-header">
          <h2>My Profile</h2>
          <div className="profile-actions">
            <button onClick={() => setEditingProfile(!editingProfile)}>
              {editingProfile ? 'Cancel' : 'Edit Profile'}
            </button>
            <button onClick={() => setChangingPassword(!changingPassword)}>
              {changingPassword ? 'Cancel' : 'Change Password'}
            </button>
          </div>
        </div>

        {changingPassword ? (
          <form onSubmit={handlePasswordChange} className="password-form">
            <h3>Change Password</h3>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} required />
            </div>
            <button type="submit" disabled={loading}>{loading ? 'Changing...' : 'Change Password'}</button>
          </form>
        ) : editingProfile ? (
          <form onSubmit={handleProfileUpdate} className="profile-form">
            <h3>Edit Profile</h3>
            <div className="form-row">
              <div className="form-group"><label>Name</label><input type="text" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} required /></div>
              <div className="form-group"><label>Email</label><input type="email" value={profileForm.email} onChange={(e) => setProfileForm({...profileForm, email: e.target.value})} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Phone</label><input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} /></div>
              <div className="form-group"><label>Major</label><input type="text" value={profileForm.major} onChange={(e) => setProfileForm({...profileForm, major: e.target.value})} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Year</label><select value={profileForm.year} onChange={(e) => setProfileForm({...profileForm, year: e.target.value})}><option value="">Select Year</option><option>Freshman</option><option>Sophomore</option><option>Junior</option><option>Senior</option></select></div>
              <div className="form-group"><label>Address</label><textarea value={profileForm.address} onChange={(e) => setProfileForm({...profileForm, address: e.target.value})} rows="3" /></div>
            </div>
            <button type="submit" disabled={loading}>{loading ? 'Updating...' : 'Update Profile'}</button>
          </form>
        ) : (
          <div className="profile-display">
            <div className="profile-section">
              <h3>Personal Information</h3>
              <div className="info-grid">
                <div><strong>Name:</strong> {profile.name}</div>
                <div><strong>Email:</strong> {profile.email}</div>
                <div><strong>Student ID:</strong> {profile.student_id || 'Not provided'}</div>
                <div><strong>Phone:</strong> {profile.phone || 'Not provided'}</div>
                <div><strong>Date of Birth:</strong> {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : 'Not provided'}</div>
                <div><strong>Major:</strong> {profile.major || 'Not specified'}</div>
                <div><strong>Year:</strong> {profile.year || 'Not specified'}</div>
                <div><strong>GPA:</strong> {(() => { const g = parseFloat(profile.gpa); return isNaN(g) ? 'N/A' : g.toFixed(2); })()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCourses = () => (
    <div className="courses-content">
      <div className="courses-header">
        <h2>Course Registration</h2>
        <div className="registration-status">
          {registrationStatus?.available ? <span className="status-open">Registration Open</span> : <span className="status-closed">Registration Closed</span>}
        </div>
      </div>
      <div className="courses-section">
        <h3>My Enrolled Courses</h3>
        {enrolledCourses.length > 0 ? (
          <div className="courses-grid">
            {enrolledCourses.map(course => (
              <div key={course.id} className="course-card enrolled">
                <h4>{course.code}</h4><p>{course.title}</p><p className="course-credits">{course.credits} credits</p>
                <button className="btn-danger" onClick={() => handleCourseDrop(course.id)} disabled={loading}>Drop Course</button>
              </div>
            ))}
          </div>
        ) : <p>No courses enrolled.</p>}
      </div>
      {registrationStatus?.available && (
        <div className="courses-section">
          <h3>Available Courses</h3>
          <div className="search-bar"><input type="text" placeholder="Search courses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <div className="courses-grid">
            {filteredCourses.map(course => (
              <div key={course.id} className="course-card available">
                <h4>{course.code}</h4><p>{course.title}</p><p className="course-capacity">{course.current_enrollments}/{course.capacity} enrolled</p><p className="course-credits">{course.credits} credits</p>
                {course.is_enrolled ? <span className="enrolled-badge">Already Enrolled</span> : course.waitlist_position ? <span className="waitlist-badge">Waitlist Position: {course.waitlist_position}</span> : (
                  <button onClick={() => handleCourseRegistration(course.id)} disabled={loading}>
                    {course.current_enrollments >= course.capacity ? 'Join Waitlist' : 'Register'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderGrades = () => {
    const selectedCourseGrade = grades.find(g => g.id === selectedCourseForDetails);
    const gpaNumber = parseFloat(selectedCourseGrade?.gpa) || 0;

    return (
      <div className="grades-content">
        <h2>Grade Book</h2>
        <div className="course-selector">
          <label>Select Course: </label>
          <select value={selectedCourseForDetails || ''} onChange={(e) => setSelectedCourseForDetails(Number(e.target.value))}>
            <option value="">-- Choose a course --</option>
            {enrolledCourses.map(course => (
              <option key={course.id} value={course.id}>{course.code} - {course.title}</option>
            ))}
          </select>
        </div>

        {selectedCourseForDetails ? (
          <>
            <div className="final-grade-card">
              <div className="grade-letter">{selectedCourseGrade?.grade || 'N/A'}</div>
              <div className="grade-details">
                <div><span>GPA:</span> <strong>{gpaNumber.toFixed(2)}</strong></div>
                <div><span>Status:</span> <strong>{selectedCourseGrade?.is_posted ? 'Posted' : 'Not posted'}</strong></div>
                <div><span>Feedback:</span> {selectedCourseGrade?.feedback || '—'}</div>
              </div>
            </div>

            <div className="assessments-section">
              <h3>Your Scores</h3>
              {assessments.length > 0 ? (
                <table className="scores-table">
                  <thead><tr><th>Assessment</th><th>Type</th><th>Score</th><th>Max</th><th>%</th><th>Feedback</th></tr></thead>
                  <tbody>
                    {assessments.map(ass => {
                      const score = parseFloat(ass.score);
                      const maxScore = parseFloat(ass.max_score);
                      const percent = (!isNaN(score) && !isNaN(maxScore) && maxScore > 0) ? (score / maxScore) * 100 : 0;
                      return (
                        <tr key={ass.id}>
                          <td>{ass.title}</td><td className="assessment-type">{ass.type}</td>
                          <td className="score-value">{isNaN(score) ? '—' : score}</td>
                          <td>{isNaN(maxScore) ? '—' : maxScore}</td>
                          <td className="score-percent">{percent.toFixed(0)}%</td>
                          <td className="feedback-text">{ass.feedback || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <p className="empty-message">No assessment scores recorded for this course.</p>}
            </div>

            <div className="stats-section">
              <h3>Class Statistics</h3>
              {assessmentStats.length > 0 ? (
                <table className="stats-table">
                  <thead><tr><th>Assessment</th><th>Count</th><th>Min</th><th>Max</th><th>Average</th><th>Median</th><th>Visual</th></tr></thead>
                  <tbody>
                    {assessmentStats.map(stat => {
                      const avg = parseFloat(stat.avg);
                      const maxScore = parseFloat(stat.max_score);
                      const avgPercent = (!isNaN(avg) && !isNaN(maxScore) && maxScore > 0) ? (avg / maxScore) * 100 : 0;
                      return (
                        <tr key={stat.assessment_id}>
                          <td>{stat.title}</td>
                          <td>{stat.count}</td>
                          <td>{!isNaN(parseFloat(stat.min)) ? parseFloat(stat.min).toFixed(1) : '—'}</td>
                          <td>{!isNaN(parseFloat(stat.max)) ? parseFloat(stat.max).toFixed(1) : '—'}</td>
                          <td>{!isNaN(avg) ? avg.toFixed(1) : '—'}</td>
                          <td>{!isNaN(parseFloat(stat.median)) ? parseFloat(stat.median).toFixed(1) : '—'}</td>
                          <td><div className="mini-bar"><div style={{ width: `${avgPercent}%` }}></div></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <p className="empty-message">No class statistics available.</p>}
            </div>
          </>
        ) : <p className="empty-message">Select a course to see grades and assessment details.</p>}
      </div>
    );
  };

  const renderAttendance = () => (
    <div className="attendance-content">
      <h2>Attendance Record</h2>

      {/* Check-in Section */}
      <div className="checkin-section">
        <h3>Check In to a Session</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Select Course</label>
            <select
              value={checkinCourseId}
              onChange={(e) => setCheckinCourseId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">-- Choose course --</option>
              {enrolledCourses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Select Session</label>
            <select
              value={checkinSessionId}
              onChange={(e) => setCheckinSessionId(e.target.value ? Number(e.target.value) : '')}
              disabled={!checkinCourseId}
            >
              <option value="">-- Choose session --</option>
              {courseSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} ({new Date(session.session_date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Check-in Method</label>
            <select
              value={checkinMethod}
              onChange={(e) => setCheckinMethod(e.target.value)}
              disabled={!checkinSessionId}
            >
              <option value="manual">Manual Code</option>
              <option value="qr">QR Code</option>
            </select>
          </div>
          <div className="form-group">
            <label>{checkinMethod === 'qr' ? 'QR Code' : 'Check-in Code'}</label>
            <input
              type="text"
              value={checkinCode}
              onChange={(e) => setCheckinCode(e.target.value)}
              placeholder={checkinMethod === 'qr' ? 'Paste QR code value' : 'Enter code from instructor'}
              disabled={!checkinSessionId}
            />
          </div>
          <button onClick={handleCheckin} disabled={loading}>
            {loading ? 'Checking in...' : 'Check In'}
          </button>
        </div>
      </div>

      {/* View Attendance Records */}
      <div className="course-selector">
        <label>View Records for: </label>
        <select
          value={selectedCourseForDetails || ''}
          onChange={(e) => setSelectedCourseForDetails(Number(e.target.value))}
        >
          <option value="">-- Choose a course --</option>
          {enrolledCourses.map(course => (
            <option key={course.id} value={course.id}>
              {course.code} - {course.title}
            </option>
          ))}
        </select>
      </div>

      {selectedCourseForDetails ? (
        attendance.length > 0 ? (
          <table className="attendance-table">
            <thead>
              <tr><th>Session</th><th>Date</th><th>Method</th><th>Status</th></tr>
            </thead>
            <tbody>
              {attendance.map(record => (
                <tr key={record.id}>
                  <td>{record.title}</td>
                  <td>{new Date(record.session_date).toLocaleDateString()}</td>
                  <td>{record.checkin_method}</td>
                  <td>Present</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-message">No attendance records available for this course.</p>
        )
      ) : (
        <p className="empty-message">Select a course to view attendance records.</p>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="history-content">
      <h2>Academic History</h2>
      <div className="gpa-summary">
        <h3>Academic Summary</h3>
        <div className="summary-stats">
          <div><span>Cumulative GPA:</span> {parseFloat(academicHistory.summary?.cumulativeGPA)?.toFixed(2) || 'N/A'}</div>
          <div><span>Total Credits:</span> {academicHistory.summary?.totalCredits || 0}</div>
          <div><span>Courses Completed:</span> {academicHistory.summary?.completedCourses || 0}</div>
        </div>
      </div>
      <div className="history-table">
        <h3>Course History</h3>
        {academicHistory.history?.length > 0 ? (
          <table className="history-table">
            <thead>
              <tr><th>Course</th><th>Title</th><th>Grade</th><th>GPA</th><th>Credits</th><th>Semester</th><th>Year</th><th>Status</th></tr>
            </thead>
            <tbody>
              {academicHistory.history.map((course, idx) => (
                <tr key={idx}>
                  <td>{course.course_code}</td>
                  <td>{course.course_title}</td>
                  <td>{course.grade || 'N/A'}</td>
                  <td>{course.gpa || 'N/A'}</td>
                  <td>{course.credits}</td>
                  <td>{course.semester}</td>
                  <td>{course.year}</td>
                  <td>{course.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="empty-message">No academic history available.</p>}
      </div>
    </div>
  );

  // ----- Main render -----
  return (
    <div className="student-container">
      <div className="portal-header">
        <h1 className="student-title">🎓 Student Portal</h1>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="student-layout">
        <nav className="student-nav">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>My Profile</button>
          <button className={activeTab === 'courses' ? 'active' : ''} onClick={() => setActiveTab('courses')}>Course Registration</button>
          <button className={activeTab === 'grades' ? 'active' : ''} onClick={() => setActiveTab('grades')}>Grades</button>
          <button className={activeTab === 'attendance' ? 'active' : ''} onClick={() => setActiveTab('attendance')}>Attendance</button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>Academic History</button>
        </nav>

        <main className="student-content">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'courses' && renderCourses()}
          {activeTab === 'grades' && renderGrades()}
          {activeTab === 'attendance' && renderAttendance()}
          {activeTab === 'history' && renderHistory()}
        </main>
      </div>
    </div>
  );
}

export default StudentPortal;