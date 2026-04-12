import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminPortal.css';

function AdminPortal({ token }) {
  const navigate = useNavigate();
  const storedToken = token || localStorage.getItem('authToken');
  const storedUser = JSON.parse(localStorage.getItem('user') || 'null');

  // Role-based access control
  useEffect(() => {
    if (!storedToken || storedUser?.role !== 'admin') {
      navigate('/');
    }
  }, [storedToken, storedUser?.role, navigate]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [statistics, setStatistics] = useState(null);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [courseForm, setCourseForm] = useState({
    code: '',
    title: '',
    capacity: '',
  });

  const [editingCourse, setEditingCourse] = useState(null);

  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
  });

  const [editingUser, setEditingUser] = useState(null);

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

  // Load data when tab changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        if (activeTab === 'dashboard') {
          const res = await axios.get('/api/admin/statistics/dashboard', axiosConfig);
          setStatistics(res.data.statistics);
        } else if (activeTab === 'courses') {
          const res = await axios.get('/api/admin/courses', axiosConfig);
          setCourses(res.data.courses);
        } else if (activeTab === 'students') {
          const res = await axios.get('/api/admin/students', axiosConfig);
          setStudents(res.data.students);
        } else if (activeTab === 'users') {
          const res = await axios.get('/api/admin/users', axiosConfig);
          setUsers(res.data.users);
        } else if (activeTab === 'reports') {
          const res = await axios.get('/api/admin/reports/course-enrollment', axiosConfig);
          setStatistics(res.data);
        }
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Failed to fetch data';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab, token]);

  const handleCourseFormChange = (e) => {
    const { name, value } = e.target;
    setCourseForm((prev) => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) || '' : value,
    }));
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!courseForm.code || !courseForm.title || !courseForm.capacity) {
      setError('All fields are required');
      return;
    }

    try {
      const res = await axios.post('/api/admin/courses', courseForm, axiosConfig);
      setSuccess('Course created successfully!');

      // Add to list
      setCourses((prev) => [...prev, res.data.course]);

      // Reset form
      setCourseForm({ code: '', title: '', capacity: '' });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create course';
      setError(errorMsg);
    }
  };

  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const updates = {};
    if (courseForm.code) updates.code = courseForm.code;
    if (courseForm.title) updates.title = courseForm.title;
    if (courseForm.capacity) updates.capacity = courseForm.capacity;

    try {
      const res = await axios.put(
        `/api/admin/courses/${editingCourse.id}`,
        updates,
        axiosConfig
      );
      setSuccess('Course updated successfully!');

      // Update list
      setCourses((prev) =>
        prev.map((c) => (c.id === editingCourse.id ? res.data.course : c))
      );

      // Reset form
      setCourseForm({ code: '', title: '', capacity: '' });
      setEditingCourse(null);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update course';
      setError(errorMsg);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;

    try {
      await axios.delete(`/api/admin/courses/${courseId}`, axiosConfig);
      setSuccess('Course deleted successfully!');
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delete course';
      setError(errorMsg);
    }
  };

  const startEditCourse = (course) => {
    setEditingCourse(course);
    setCourseForm({
      code: course.code,
      title: course.title,
      capacity: course.capacity,
    });
  };

  const handleUserFormChange = (e) => {
    const { name, value } = e.target;
    setUserForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!userForm.name || !userForm.email || !userForm.password) {
      setError('Name, email, and password are required');
      return;
    }

    if (userForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const res = await axios.post('/api/admin/users', userForm, axiosConfig);
      setSuccess('User created successfully!');

      // Add to list
      setUsers((prev) => [...prev, res.data.user]);

      // Reset form
      setUserForm({ name: '', email: '', password: '', role: 'student' });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create user';
      setError(errorMsg);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const updates = {};
    if (userForm.name) updates.name = userForm.name;
    if (userForm.email) updates.email = userForm.email;
    if (userForm.role) updates.role = userForm.role;
    if (userForm.password) {
      if (editingUser.role === 'admin') {
        setError('Cannot change password for admin users');
        return;
      }
      updates.password = userForm.password;
    }

    try {
      const res = await axios.put(
        `/api/admin/users/${editingUser.id}`,
        updates,
        axiosConfig
      );
      setSuccess('User updated successfully!');

      // Update list
      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? res.data.user : u))
      );

      // Reset form
      setUserForm({ name: '', email: '', password: '', role: 'student' });
      setEditingUser(null);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update user';
      setError(errorMsg);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await axios.delete(`/api/admin/users/${userId}`, axiosConfig);
      setSuccess('User deleted successfully!');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delete user';
      setError(errorMsg);
    }
  };

  const startEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password
      role: user.role,
    });
  };

  const cancelEditUser = () => {
    setEditingUser(null);
    setUserForm({ name: '', email: '', password: '', role: 'student' });
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="admin-container">
      <div className="portal-header">
        <h1 className="admin-title">⚙️ Admin Dashboard</h1>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="admin-tabs">
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
          📚 Course Management
        </button>
        <button
          className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          👥 Students
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👤 User Management
        </button>
        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📈 Reports
        </button>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && statistics && (
              <div className="dashboard-grid">
                <div className="stat-box">
                  <div className="stat-icon">👥</div>
                  <div className="stat-info">
                    <div className="stat-label">Total Students</div>
                    <div className="stat-value">{statistics.totalStudents}</div>
                  </div>
                </div>

                <div className="stat-box">
                  <div className="stat-icon">📚</div>
                  <div className="stat-info">
                    <div className="stat-label">Total Courses</div>
                    <div className="stat-value">{statistics.totalCourses}</div>
                  </div>
                </div>

                <div className="stat-box">
                  <div className="stat-icon">✓</div>
                  <div className="stat-info">
                    <div className="stat-label">Total Enrollments</div>
                    <div className="stat-value">{statistics.totalEnrollments}</div>
                  </div>
                </div>

                <div className="stat-box">
                  <div className="stat-icon">📋</div>
                  <div className="stat-info">
                    <div className="stat-label">Total Grades</div>
                    <div className="stat-value">{statistics.totalGrades}</div>
                  </div>
                </div>

                <div className="stat-box">
                  <div className="stat-icon">⭐</div>
                  <div className="stat-info">
                    <div className="stat-label">Average GPA</div>
                    <div className="stat-value">{statistics.averageGpa}</div>
                  </div>
                </div>

                <div className="stat-box">
                  <div className="stat-icon">📊</div>
                  <div className="stat-info">
                    <div className="stat-label">Capacity Fill Rate</div>
                    <div className="stat-value">{statistics.courseCapacityFillRate}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Course Management Tab */}
            {activeTab === 'courses' && (
              <div className="courses-management">
                <div className="form-section">
                  <h2>{editingCourse ? 'Edit Course' : 'Create New Course'}</h2>
                  <form onSubmit={editingCourse ? handleUpdateCourse : handleCreateCourse}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Course Code</label>
                        <input
                          type="text"
                          name="code"
                          value={courseForm.code}
                          onChange={handleCourseFormChange}
                          placeholder="e.g., CS101"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Course Title</label>
                        <input
                          type="text"
                          name="title"
                          value={courseForm.title}
                          onChange={handleCourseFormChange}
                          placeholder="e.g., Introduction to Computer Science"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Capacity</label>
                        <input
                          type="number"
                          name="capacity"
                          value={courseForm.capacity}
                          onChange={handleCourseFormChange}
                          placeholder="e.g., 30"
                          min="1"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn-submit">
                        {editingCourse ? 'Update Course' : 'Create Course'}
                      </button>
                      {editingCourse && (
                        <button type="button" className="btn-cancel" onClick={cancelEdit}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="list-section">
                  <h2>All Courses ({courses.length})</h2>
                  {courses.length > 0 ? (
                    <table className="courses-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Title</th>
                          <th>Capacity</th>
                          <th>Enrolled</th>
                          <th>Available</th>
                          <th>Fill %</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courses.map((course) => {
                          const fillPercent = (
                            (course.current_enrollments / course.capacity) *
                            100
                          ).toFixed(0);
                          return (
                            <tr key={course.id}>
                              <td className="code">{course.code}</td>
                              <td>{course.title}</td>
                              <td>{course.capacity}</td>
                              <td>{course.current_enrollments}</td>
                              <td>{course.available_slots}</td>
                              <td>{fillPercent}%</td>
                              <td className="actions">
                                <button
                                  className="btn-edit"
                                  onClick={() => startEditCourse(course)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn-delete"
                                  onClick={() => handleDeleteCourse(course.id)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-data">No courses found</p>
                  )}
                </div>
              </div>
            )}

            {/* Students Tab */}
            {activeTab === 'students' && (
              <div className="students-section">
                <h2>All Students ({students.length})</h2>
                {students.length > 0 ? (
                  <table className="students-table">
                    <thead>
                      <tr>
                        <th>SID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Enrolled Courses</th>
                        <th>Grades Count</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td className="sid">{student.student_id || 'N/A'}</td>
                          <td>{student.name}</td>
                          <td className="email">{student.email}</td>
                          <td>{student.enrolled_courses}</td>
                          <td>{student.grades_count}</td>
                          <td>{new Date(student.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="no-data">No students found</p>
                )}
              </div>
            )}

            {/* User Management Tab */}
            {activeTab === 'users' && (
              <div className="users-management">
                <div className="form-section">
                  <h2>{editingUser ? 'Edit User' : 'Create New User'}</h2>
                  <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name</label>
                        <input
                          type="text"
                          name="name"
                          value={userForm.name}
                          onChange={handleUserFormChange}
                          placeholder="Full name"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          name="email"
                          value={userForm.email}
                          onChange={handleUserFormChange}
                          placeholder="user@example.com"
                          required
                        />
                      </div>
                      {!editingUser && (
                        <div className="form-group">
                          <label>Password</label>
                          <input
                            type="password"
                            name="password"
                            value={userForm.password}
                            onChange={handleUserFormChange}
                            placeholder="Minimum 6 characters"
                            required
                          />
                        </div>
                      )}
                      {editingUser && editingUser.role !== 'admin' && (
                        <div className="form-group">
                          <label>New Password</label>
                          <input
                            type="password"
                            name="password"
                            value={userForm.password}
                            onChange={handleUserFormChange}
                            placeholder="Leave blank to keep current password"
                          />
                        </div>
                      )}
                      {editingUser && editingUser.role === 'admin' && (
                        <div className="form-group info-note">
                          <p>Admin passwords cannot be changed from this panel.</p>
                        </div>
                      )}
                      <div className="form-group">
                        <label>Role</label>
                        <select
                          name="role"
                          value={userForm.role}
                          onChange={handleUserFormChange}
                        >
                          <option value="student">Student</option>
                          <option value="faculty">Faculty</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn-submit">
                        {editingUser ? 'Update User' : 'Create User'}
                      </button>
                      {editingUser && (
                        <button type="button" className="btn-cancel" onClick={cancelEditUser}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="list-section">
                  <h2>All Users ({users.length})</h2>
                  {users.length > 0 ? (
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>SID</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td className="sid">{user.student_id || 'N/A'}</td>
                            <td>{user.name}</td>
                            <td className="email">{user.email}</td>
                            <td>
                              <span className={`role-badge role-${user.role}`}>
                                {user.role}
                              </span>
                            </td>
                            <td>{new Date(user.created_at).toLocaleDateString()}</td>
                            <td className="actions">
                              <button
                                className="btn-edit"
                                onClick={() => startEditUser(user)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-delete"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-data">No users found</p>
                  )}
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && statistics && (
              <div className="reports-section">
                <h2>Course Enrollment Report</h2>
                {statistics.enrollmentReport && statistics.enrollmentReport.length > 0 ? (
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Course Code</th>
                        <th>Course Title</th>
                        <th>Capacity</th>
                        <th>Current Enrollment</th>
                        <th>Available Slots</th>
                        <th>Fill Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statistics.enrollmentReport.map((report) => (
                        <tr key={report.id}>
                          <td className="code">{report.code}</td>
                          <td>{report.title}</td>
                          <td>{report.capacity}</td>
                          <td>{report.current_enrollments}</td>
                          <td>{report.available_slots}</td>
                          <td>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{ width: `${report.fillPercentage}%` }}
                              >
                                {report.fillPercentage}%
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="no-data">No enrollment data</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminPortal;
