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
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Course management
  const [courseForm, setCourseForm] = useState({
    code: '',
    title: '',
    capacity: '',
  });
  const [editingCourse, setEditingCourse] = useState(null);

  // User management
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
  });
  const [editingUser, setEditingUser] = useState(null);

  // Enrollment Management (new)
  const [registrationPeriods, setRegistrationPeriods] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [studentEnrollments, setStudentEnrollments] = useState([]);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);

  // Instructor assignment management
  const [selectedTeacherForAssignment, setSelectedTeacherForAssignment] = useState('');
  const [selectedCourseForAssignment, setSelectedCourseForAssignment] = useState('');
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  // Registration Period Form (new)
  const [periodForm, setPeriodForm] = useState({
    semester: 'Spring',
    year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    add_drop_deadline: '',
    is_active: false,
  });
  const [editingPeriod, setEditingPeriod] = useState(null);

  const axiosConfig = {
    headers: { Authorization: `Bearer ${storedToken}` },
  };

  // Auto-dismiss notifications
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

  // Fetch data based on active tab
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
        } else if (activeTab === 'enrollments') {
          const [coursesRes, studentsRes] = await Promise.all([
            axios.get('/api/admin/courses', axiosConfig),
            axios.get('/api/admin/students', axiosConfig),
          ]);
          setCourses(coursesRes.data.courses);
          setStudents(studentsRes.data.students);
          // Reset selections
          setSelectedStudent('');
          setSelectedCourse('');
          setStudentEnrollments([]);
        } else if (activeTab === 'instructorAssignments') {
          const [coursesRes, usersRes] = await Promise.all([
            axios.get('/api/admin/courses', axiosConfig),
            axios.get('/api/admin/users', axiosConfig),
          ]);
          setCourses(coursesRes.data.courses || []);
          const facultyUsers = (usersRes.data.users || []).filter((user) => user.role === 'faculty');
          setTeachers(facultyUsers);
          setSelectedTeacherForAssignment('');
          setSelectedCourseForAssignment('');
          setTeacherAssignments([]);
        } else if (activeTab === 'registration') {
          const res = await axios.get('/api/admin/registration-periods', axiosConfig);
          setRegistrationPeriods(res.data.periods);
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

  // Load enrollments for selected student
  useEffect(() => {
    const fetchStudentEnrollments = async () => {
      if (!selectedStudent) {
        setStudentEnrollments([]);
        return;
      }
      setEnrollmentLoading(true);
      try {
        const res = await axios.get(`/api/admin/students/${selectedStudent}/details`, axiosConfig);
        setStudentEnrollments(res.data.enrollments || []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load student enrollments');
      } finally {
        setEnrollmentLoading(false);
      }
    };
    fetchStudentEnrollments();
  }, [selectedStudent]);

  useEffect(() => {
    const fetchTeacherAssignments = async () => {
      if (activeTab !== 'instructorAssignments' || !selectedTeacherForAssignment) {
        setTeacherAssignments([]);
        return;
      }

      setAssignmentLoading(true);
      try {
        const res = await axios.get(
          `/api/admin/teacher-courses/${selectedTeacherForAssignment}`,
          axiosConfig
        );
        setTeacherAssignments(res.data.courses || []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load teacher assignments');
      } finally {
        setAssignmentLoading(false);
      }
    };

    fetchTeacherAssignments();
  }, [activeTab, selectedTeacherForAssignment]);

  // -------------------- Course Management --------------------
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
      setCourses((prev) => [...prev, res.data.course]);
      setCourseForm({ code: '', title: '', capacity: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create course');
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
      setCourses((prev) =>
        prev.map((c) => (c.id === editingCourse.id ? res.data.course : c))
      );
      setCourseForm({ code: '', title: '', capacity: '' });
      setEditingCourse(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update course');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      await axios.delete(`/api/admin/courses/${courseId}`, axiosConfig);
      setSuccess('Course deleted successfully!');
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete course');
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

  const cancelEdit = () => {
    setEditingCourse(null);
    setCourseForm({ code: '', title: '', capacity: '' });
  };

  // -------------------- User Management --------------------
  const handleUserFormChange = (e) => {
    const { name, value } = e.target;
    setUserForm((prev) => ({ ...prev, [name]: value }));
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
      setUsers((prev) => [...prev, res.data.user]);
      setUserForm({ name: '', email: '', password: '', role: 'student' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
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
      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? res.data.user : u))
      );
      setUserForm({ name: '', email: '', password: '', role: 'student' });
      setEditingUser(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`/api/admin/users/${userId}`, axiosConfig);
      setSuccess('User deleted successfully!');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const startEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    });
  };

  const cancelEditUser = () => {
    setEditingUser(null);
    setUserForm({ name: '', email: '', password: '', role: 'student' });
  };

  // -------------------- Enrollment Management (new) --------------------
  const handleEnrollStudent = async () => {
    if (!selectedStudent || !selectedCourse) {
      setError('Please select both a student and a course');
      return;
    }
    setLoading(true);
    try {
      await axios.post(
        `/api/admin/students/${selectedStudent}/enroll/${selectedCourse}`,
        {},
        axiosConfig
      );
      setSuccess('Student enrolled successfully!');
      // Refresh enrollments for the selected student
      const res = await axios.get(`/api/admin/students/${selectedStudent}/details`, axiosConfig);
      setStudentEnrollments(res.data.enrollments || []);
      setSelectedCourse(''); // reset course selection
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to enroll student');
    } finally {
      setLoading(false);
    }
  };

  const handleUnenrollStudent = async (courseId) => {
    if (!window.confirm('Are you sure you want to unenroll this student from the course?')) return;
    setLoading(true);
    try {
      await axios.delete(
        `/api/admin/students/${selectedStudent}/enroll/${courseId}`,
        axiosConfig
      );
      setSuccess('Student unenrolled successfully!');
      // Refresh enrollments
      const res = await axios.get(`/api/admin/students/${selectedStudent}/details`, axiosConfig);
      setStudentEnrollments(res.data.enrollments || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unenroll student');
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Instructor Assignment Management --------------------
  const handleAssignCourseToTeacher = async () => {
    if (!selectedTeacherForAssignment || !selectedCourseForAssignment) {
      setError('Please select both an instructor and a course');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.post(
        '/api/admin/teacher-courses',
        {
          teacherId: selectedTeacherForAssignment,
          courseId: selectedCourseForAssignment,
        },
        axiosConfig
      );

      setSuccess('Instructor assignment created successfully!');
      setSelectedCourseForAssignment('');

      const res = await axios.get(
        `/api/admin/teacher-courses/${selectedTeacherForAssignment}`,
        axiosConfig
      );
      setTeacherAssignments(res.data.courses || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign course to instructor');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTeacherAssignment = async (courseId) => {
    if (!selectedTeacherForAssignment) {
      setError('Please select an instructor first');
      return;
    }

    if (!window.confirm('Are you sure you want to remove this instructor assignment?')) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.delete(
        `/api/admin/teacher-courses/${selectedTeacherForAssignment}/${courseId}`,
        axiosConfig
      );
      setSuccess('Instructor assignment removed successfully!');
      setTeacherAssignments((prev) => prev.filter((assignment) => assignment.id !== courseId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove instructor assignment');
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Registration Period Management (new) --------------------
  const handlePeriodFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPeriodForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreatePeriod = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/admin/registration-periods', periodForm, axiosConfig);
      setSuccess('Registration period created successfully!');
      setRegistrationPeriods((prev) => [...prev, res.data.period]);
      setPeriodForm({
        semester: 'Spring',
        year: new Date().getFullYear(),
        start_date: '',
        end_date: '',
        add_drop_deadline: '',
        is_active: false,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create registration period');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePeriod = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.put(
        `/api/admin/registration-periods/${editingPeriod.id}`,
        periodForm,
        axiosConfig
      );
      setSuccess('Registration period updated successfully!');
      setRegistrationPeriods((prev) =>
        prev.map((p) => (p.id === editingPeriod.id ? res.data.period : p))
      );
      setEditingPeriod(null);
      setPeriodForm({
        semester: 'Spring',
        year: new Date().getFullYear(),
        start_date: '',
        end_date: '',
        add_drop_deadline: '',
        is_active: false,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update registration period');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePeriod = async (periodId) => {
    if (!window.confirm('Are you sure you want to delete this registration period?')) return;
    setLoading(true);
    try {
      await axios.delete(`/api/admin/registration-periods/${periodId}`, axiosConfig);
      setSuccess('Registration period deleted successfully!');
      setRegistrationPeriods((prev) => prev.filter((p) => p.id !== periodId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete registration period');
    } finally {
      setLoading(false);
    }
  };

  const startEditPeriod = (period) => {
    setEditingPeriod(period);
    setPeriodForm({
      semester: period.semester,
      year: period.year,
      start_date: period.start_date ? period.start_date.slice(0, 16) : '',
      end_date: period.end_date ? period.end_date.slice(0, 16) : '',
      add_drop_deadline: period.add_drop_deadline ? period.add_drop_deadline.slice(0, 16) : '',
      is_active: period.is_active,
    });
  };

  const cancelEditPeriod = () => {
    setEditingPeriod(null);
    setPeriodForm({
      semester: 'Spring',
      year: new Date().getFullYear(),
      start_date: '',
      end_date: '',
      add_drop_deadline: '',
      is_active: false,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  // -------------------- Render --------------------
  return (
    <div className="admin-container">
      <div className="portal-header">
        <h1 className="admin-title">⚙️ Admin Dashboard</h1>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="admin-tabs">
        <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>📚 Course Management</button>
        <button className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>👥 Students</button>
        <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👤 User Management</button>
        {/* New tabs */}
        <button className={`tab-btn ${activeTab === 'enrollments' ? 'active' : ''}`} onClick={() => setActiveTab('enrollments')}>📝 Enrollments</button>
        <button className={`tab-btn ${activeTab === 'instructorAssignments' ? 'active' : ''}`} onClick={() => setActiveTab('instructorAssignments')}>🧑‍🏫 Instructor Assignments</button>
        <button className={`tab-btn ${activeTab === 'registration' ? 'active' : ''}`} onClick={() => setActiveTab('registration')}>🗓️ Registration Periods</button>
        <button className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>📈 Reports</button>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && statistics && (
              <div className="dashboard-grid">
                <div className="stat-box"><div className="stat-icon">👥</div><div className="stat-info"><div className="stat-label">Total Students</div><div className="stat-value">{statistics.totalStudents}</div></div></div>
                <div className="stat-box"><div className="stat-icon">📚</div><div className="stat-info"><div className="stat-label">Total Courses</div><div className="stat-value">{statistics.totalCourses}</div></div></div>
                <div className="stat-box"><div className="stat-icon">✓</div><div className="stat-info"><div className="stat-label">Total Enrollments</div><div className="stat-value">{statistics.totalEnrollments}</div></div></div>
                <div className="stat-box"><div className="stat-icon">📋</div><div className="stat-info"><div className="stat-label">Total Grades</div><div className="stat-value">{statistics.totalGrades}</div></div></div>
                <div className="stat-box"><div className="stat-icon">⭐</div><div className="stat-info"><div className="stat-label">Average GPA</div><div className="stat-value">{statistics.averageGpa}</div></div></div>
                <div className="stat-box"><div className="stat-icon">📊</div><div className="stat-info"><div className="stat-label">Capacity Fill Rate</div><div className="stat-value">{statistics.courseCapacityFillRate}</div></div></div>
              </div>
            )}

            {/* Course Management Tab */}
            {activeTab === 'courses' && (
              <div className="courses-management">
                <div className="form-section">
                  <h2>{editingCourse ? 'Edit Course' : 'Create New Course'}</h2>
                  <form onSubmit={editingCourse ? handleUpdateCourse : handleCreateCourse}>
                    <div className="form-row">
                      <div className="form-group"><label>Course Code</label><input type="text" name="code" value={courseForm.code} onChange={handleCourseFormChange} placeholder="e.g., CS101" required /></div>
                      <div className="form-group"><label>Course Title</label><input type="text" name="title" value={courseForm.title} onChange={handleCourseFormChange} placeholder="e.g., Introduction to Computer Science" required /></div>
                      <div className="form-group"><label>Capacity</label><input type="number" name="capacity" value={courseForm.capacity} onChange={handleCourseFormChange} placeholder="e.g., 30" min="1" required /></div>
                    </div>
                    <div className="form-actions"><button type="submit" className="btn-submit">{editingCourse ? 'Update Course' : 'Create Course'}</button>{editingCourse && <button type="button" className="btn-cancel" onClick={cancelEdit}>Cancel</button>}</div>
                  </form>
                </div>
                <div className="list-section"><h2>All Courses ({courses.length})</h2>
                  {courses.length > 0 ? (
                    <table className="courses-table"><thead><tr><th>Code</th><th>Title</th><th>Capacity</th><th>Enrolled</th><th>Available</th><th>Fill %</th><th>Actions</th></tr></thead>
                    <tbody>{courses.map((course) => {
                      const fillPercent = ((course.current_enrollments / course.capacity) * 100).toFixed(0);
                      return (<tr key={course.id}><td className="code">{course.code}</td><td>{course.title}</td><td>{course.capacity}</td><td>{course.current_enrollments}</td><td>{course.available_slots}</td><td>{fillPercent}%</td>
                      <td className="actions"><button className="btn-edit" onClick={() => startEditCourse(course)}>Edit</button><button className="btn-delete" onClick={() => handleDeleteCourse(course.id)}>Delete</button></td></tr>);
                    })}</tbody></table>
                  ) : <p className="no-data">No courses found</p>}
                </div>
              </div>
            )}

            {/* Students Tab */}
            {activeTab === 'students' && (
              <div className="students-section"><h2>All Students ({students.length})</h2>
                {students.length > 0 ? (
                  <table className="students-table"><thead><tr><th>SID</th><th>Name</th><th>Email</th><th>Enrolled Courses</th><th>Grades Count</th><th>Joined</th></tr></thead>
                  <tbody>{students.map((student) => (<tr key={student.id}><td className="sid">{student.student_id || 'N/A'}</td><td>{student.name}</td><td className="email">{student.email}</td><td>{student.enrolled_courses}</td><td>{student.grades_count}</td><td>{new Date(student.created_at).toLocaleDateString()}</td></tr>))}</tbody></table>
                ) : <p className="no-data">No students found</p>}
              </div>
            )}

            {/* User Management Tab */}
            {activeTab === 'users' && (
              <div className="users-management">
                <div className="form-section"><h2>{editingUser ? 'Edit User' : 'Create New User'}</h2>
                  <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
                    <div className="form-row">
                      <div className="form-group"><label>Name</label><input type="text" name="name" value={userForm.name} onChange={handleUserFormChange} placeholder="Full name" required /></div>
                      <div className="form-group"><label>Email</label><input type="email" name="email" value={userForm.email} onChange={handleUserFormChange} placeholder="user@example.com" required /></div>
                      {!editingUser && (<div className="form-group"><label>Password</label><input type="password" name="password" value={userForm.password} onChange={handleUserFormChange} placeholder="Min 6 characters" required /></div>)}
                      {editingUser && editingUser.role !== 'admin' && (<div className="form-group"><label>New Password</label><input type="password" name="password" value={userForm.password} onChange={handleUserFormChange} placeholder="Leave blank to keep current" /></div>)}
                      {editingUser && editingUser.role === 'admin' && (<div className="form-group info-note"><p>Admin passwords cannot be changed from this panel.</p></div>)}
                      <div className="form-group"><label>Role</label><select name="role" value={userForm.role} onChange={handleUserFormChange}><option value="student">Student</option><option value="faculty">Faculty</option><option value="admin">Admin</option></select></div>
                    </div>
                    <div className="form-actions"><button type="submit" className="btn-submit">{editingUser ? 'Update User' : 'Create User'}</button>{editingUser && <button type="button" className="btn-cancel" onClick={cancelEditUser}>Cancel</button>}</div>
                  </form>
                </div>
                <div className="list-section"><h2>All Users ({users.length})</h2>
                  {users.length > 0 ? (
                    <table className="users-table"><thead><tr><th>SID</th><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                    <tbody>{users.map((user) => (<tr key={user.id}><td className="sid">{user.student_id || 'N/A'}</td><td>{user.name}</td><td className="email">{user.email}</td><td><span className={`role-badge role-${user.role}`}>{user.role}</span></td><td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="actions"><button className="btn-edit" onClick={() => startEditUser(user)}>Edit</button><button className="btn-delete" onClick={() => handleDeleteUser(user.id)}>Delete</button></td></tr>))}</tbody></table>
                  ) : <p className="no-data">No users found</p>}
                </div>
              </div>
            )}

            {/* ENROLLMENTS TAB (NEW) */}
            {activeTab === 'enrollments' && (
              <div className="enrollments-management">
                <h2>Manage Student Enrollments</h2>
                <div className="enrollment-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Select Student</label>
                      <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                        <option value="">-- Choose a student --</option>
                        {students.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.email})</option>))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Select Course</label>
                      <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
                        <option value="">-- Choose a course --</option>
                        {courses.map(c => (<option key={c.id} value={c.id}>{c.code} - {c.title} (Available: {c.available_slots})</option>))}
                      </select>
                    </div>
                    <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                      <button onClick={handleEnrollStudent} disabled={loading || !selectedStudent || !selectedCourse} className="btn-submit">Enroll Student</button>
                    </div>
                  </div>
                </div>

                {selectedStudent && (
                  <div className="student-enrollments">
                    <h3>Current Enrollments</h3>
                    {enrollmentLoading ? <div className="loading">Loading enrollments...</div> : (
                      studentEnrollments.length > 0 ? (
                        <table className="enrollments-table">
                          <thead><tr><th>Course Code</th><th>Course Title</th><th>Enrolled Date</th><th>Action</th></tr></thead>
                          <tbody>
                            {studentEnrollments.map(enr => (
                              <tr key={enr.id}>
                                <td>{enr.code}</td>
                                <td>{enr.title}</td>
                                <td>{new Date(enr.enrolled_at).toLocaleDateString()}</td>
                                <td><button className="btn-delete" onClick={() => handleUnenrollStudent(enr.id)}>Unenroll</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <p className="no-data">This student is not enrolled in any courses.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* INSTRUCTOR ASSIGNMENTS TAB */}
            {activeTab === 'instructorAssignments' && (
              <div className="enrollments-management">
                <h2>Manage Instructor Course Assignments</h2>
                <div className="enrollment-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Select Instructor</label>
                      <select
                        value={selectedTeacherForAssignment}
                        onChange={(e) => setSelectedTeacherForAssignment(e.target.value)}
                      >
                        <option value="">-- Choose an instructor --</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.name} ({teacher.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Select Course</label>
                      <select
                        value={selectedCourseForAssignment}
                        onChange={(e) => setSelectedCourseForAssignment(e.target.value)}
                      >
                        <option value="">-- Choose a course --</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.code} - {course.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                      <button
                        onClick={handleAssignCourseToTeacher}
                        disabled={loading || !selectedTeacherForAssignment || !selectedCourseForAssignment}
                        className="btn-submit"
                      >
                        Assign Course
                      </button>
                    </div>
                  </div>
                </div>

                {selectedTeacherForAssignment && (
                  <div className="student-enrollments">
                    <h3>Current Instructor Assignments</h3>
                    {assignmentLoading ? (
                      <div className="loading">Loading assignments...</div>
                    ) : teacherAssignments.length > 0 ? (
                      <table className="enrollments-table">
                        <thead>
                          <tr>
                            <th>Course Code</th>
                            <th>Course Title</th>
                            <th>Capacity</th>
                            <th>Current Enrolled</th>
                            <th>Assigned At</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teacherAssignments.map((assignment) => (
                            <tr key={assignment.id}>
                              <td>{assignment.code}</td>
                              <td>{assignment.title}</td>
                              <td>{assignment.capacity}</td>
                              <td>{assignment.current_enrollments}</td>
                              <td>{new Date(assignment.assigned_at).toLocaleDateString()}</td>
                              <td>
                                <button
                                  className="btn-delete"
                                  onClick={() => handleRemoveTeacherAssignment(assignment.id)}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="no-data">This instructor has no assigned courses.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* REGISTRATION PERIODS TAB (NEW) */}
            {activeTab === 'registration' && (
              <div className="registration-periods-management">
                <div className="form-section">
                  <h2>{editingPeriod ? 'Edit Registration Period' : 'Create New Registration Period'}</h2>
                  <form onSubmit={editingPeriod ? handleUpdatePeriod : handleCreatePeriod}>
                    <div className="form-row">
                      <div className="form-group"><label>Semester</label><select name="semester" value={periodForm.semester} onChange={handlePeriodFormChange}><option>Spring</option><option>Summer</option><option>Fall</option><option>Winter</option></select></div>
                      <div className="form-group"><label>Year</label><input type="number" name="year" value={periodForm.year} onChange={handlePeriodFormChange} required /></div>
                      <div className="form-group"><label>Start Date</label><input type="datetime-local" name="start_date" value={periodForm.start_date} onChange={handlePeriodFormChange} required /></div>
                      <div className="form-group"><label>End Date</label><input type="datetime-local" name="end_date" value={periodForm.end_date} onChange={handlePeriodFormChange} required /></div>
                      <div className="form-group"><label>Add/Drop Deadline</label><input type="datetime-local" name="add_drop_deadline" value={periodForm.add_drop_deadline} onChange={handlePeriodFormChange} /></div>
                      <div className="form-group"><label><input type="checkbox" name="is_active" checked={periodForm.is_active} onChange={handlePeriodFormChange} /> Active</label></div>
                    </div>
                    <div className="form-actions"><button type="submit" className="btn-submit">{editingPeriod ? 'Update Period' : 'Create Period'}</button>{editingPeriod && <button type="button" className="btn-cancel" onClick={cancelEditPeriod}>Cancel</button>}</div>
                  </form>
                </div>

                <div className="list-section">
                  <h2>All Registration Periods</h2>
                  {registrationPeriods.length > 0 ? (
                    <table className="periods-table">
                      <thead><tr><th>Semester</th><th>Year</th><th>Start Date</th><th>End Date</th><th>Add/Drop Deadline</th><th>Active</th><th>Actions</th></tr></thead>
                      <tbody>
                        {registrationPeriods.map(period => (
                          <tr key={period.id}>
                            <td>{period.semester}</td><td>{period.year}</td>
                            <td>{new Date(period.start_date).toLocaleString()}</td><td>{new Date(period.end_date).toLocaleString()}</td>
                            <td>{period.add_drop_deadline ? new Date(period.add_drop_deadline).toLocaleString() : 'N/A'}</td>
                            <td>{period.is_active ? '✅ Active' : '❌ Inactive'}</td>
                            <td className="actions"><button className="btn-edit" onClick={() => startEditPeriod(period)}>Edit</button><button className="btn-delete" onClick={() => handleDeletePeriod(period.id)}>Delete</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="no-data">No registration periods found</p>}
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && statistics && (
              <div className="reports-section">
                <h2>Course Enrollment Report</h2>
                {statistics.enrollmentReport && statistics.enrollmentReport.length > 0 ? (
                  <table className="reports-table"><thead><tr><th>Course Code</th><th>Course Title</th><th>Capacity</th><th>Current Enrollment</th><th>Available Slots</th><th>Fill Percentage</th></tr></thead>
                  <tbody>{statistics.enrollmentReport.map((report) => (<tr key={report.id}><td className="code">{report.code}</td><td>{report.title}</td><td>{report.capacity}</td><td>{report.current_enrollments}</td><td>{report.available_slots}</td><td><div className="progress-bar"><div className="progress-fill" style={{ width: `${report.fillPercentage}%` }}>{report.fillPercentage}%</div></div></td></tr>))}</tbody></table>
                ) : <p className="no-data">No enrollment data</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminPortal;