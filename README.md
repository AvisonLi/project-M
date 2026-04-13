# Student Management System (SMS)

A comprehensive student management system built with Node.js, Express, PostgreSQL, and React. The system supports course registration with concurrent request handling, grade management, student profiles, and an administrative dashboard.

## 🌟 Features

### Core Functionality
- **User Authentication**: Secure login and registration with JWT and bcrypt
- **Role-Based Access Control**: Three user roles (student, faculty, admin) with distinct permissions
- **Course Management**: Create, update, delete courses (admin only)
- **User Management**: Full CRUD operations for user accounts (admin only)
- **Teacher Course Assignment**: Assign courses to faculty members (admin only)
- **Course Registration**: Concurrent-safe course registration for students using Redis distributed locks
- **Grade Management**: Record and retrieve student grades with GPA calculations
- **Student Profiles**: View and update student information and statistics
- **Faculty Dashboard**: Faculty Portal for managing assigned courses and recording grades
- **Admin Dashboard**: Comprehensive admin interface for system management and reporting

### Security & Performance
- JWT-based authentication with 24-hour token expiration
- Role-based authorization for all protected endpoints
- Redis-based distributed locking for concurrent request handling
- PostgreSQL connection pooling with parameterized queries
- Input validation and error handling
- CORS protection
- Password hashing with bcrypt
- Prepared statements to prevent SQL injection

## 📋 Prerequisites

- **Node.js** 14+ and npm
- **PostgreSQL** 12+ database
- **Redis** server running
- **Python** 3.7+ (for load testing)

## 📂 Project Structure

```
sms-project/
├── schema.sql                  # Database schema
├── server.js                   # Main server entry point
├── package.json                # Node.js dependencies
├── .env.example               # Environment variables template
├── routes/
│   ├── auth.js                # Authentication endpoints
│   ├── registration.js        # Course registration endpoints
│   ├── grades.js              # Grade management endpoints
│   ├── profile.js             # Student profile endpoints
│   └── admin.js               # Admin endpoints
├── frontend/
│   ├── Login.jsx              # Login/Registration component
│   ├── Navbar.jsx             # Navigation component
│   ├── StudentPortal.jsx      # Student interface
│   ├── FacultyPortal.jsx      # Faculty interface
│   ├── AdminPortal.jsx        # Admin interface
│   └── *.css                  # Component styles
├── load_test.py               # Concurrent load testing script
└── README.md                  # This file
```

## 🚀 Installation & Setup

### 1. Clone and Install Dependencies

```bash
cd sms-project
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
createdb sms_db
```

Initialize the schema:

```bash
psql -U postgres -d sms_db -f schema.sql
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sms_db
PORT=3001
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=debug
```

### 4. Seed Sample Data

The project includes an automated seeding script to populate initial test data:

```bash
# Install Python requests library
pip install requests

# Start the backend (in another terminal)
npm run dev

# Run the seeding script
python seed_data.py
```

This creates sample users (admin, faculty, students), courses, and teacher assignments.

**Test Credentials after seeding:**
- Admin: `admin@example.com` / `admin123`
- Faculty: `dr.smith@example.com` / `faculty123`
- Student: `alice@example.com` / `student123`

## 🏃 Running the Application

### Start Backend Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will be available at `http://localhost:3001`

### Start Frontend (React)

```bash
cd frontend
npm install
npm start
```

The frontend will run on `http://localhost:3000` and proxy API calls to `http://localhost:3001`

## 📡 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| POST | `/login` | User login | No |
| POST | `/register` | New user registration | No |
| POST | `/verify` | Verify JWT token | Yes |

**Login Request:**
```json
{
  "email": "student@example.com",
  "password": "student123"
}
```

**Login Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "student": {
    "id": 1,
    "name": "John Doe",
    "email": "student@example.com"
  }
}
```

### Course Registration (`/api/register`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| POST | `/` | Register for a course | Yes |
| GET | `/my-courses` | Get enrolled courses | Yes |
| GET | `/courses/available` | List available courses | No |
| DELETE | `/:courseId` | Withdraw from course | Yes |

**Register for Course:**
```json
{
  "courseId": 2
}
```

### Grades (`/api/grades`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| POST | `/add` | Record a grade | Yes |
| GET | `/my-grades` | Get student's grades | Yes |
| GET | `/student/:studentId` | Get specific student's grades | Yes |
| GET | `/course/:courseId` | Get course grades | No |
| PUT | `/:gradeId` | Update grade | Yes |
| DELETE | `/:gradeId` | Delete grade | Yes |

**Record Grade:**
```json
{
  "studentId": 1,
  "courseId": 2,
  "grade": "A",
  "gpa": 4.0
}
```

### Student Profile (`/api/profile`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| GET | `/me` | Get own profile | Yes |
| GET | `/:studentId` | Get student profile | No |
| PUT | `/me/update` | Update own profile | Yes |
| PUT | `/:studentId/admin-update` | Update student (admin) | No |
| POST | `/me/change-password` | Change password | Yes |
| GET | `/me/statistics` | Get profile statistics | Yes |

### Admin (`/api/admin`)

**Course Management:**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| POST | `/courses` | Create course (admin only) | Yes |
| GET | `/courses` | List all courses | No |
| GET | `/courses/:courseId` | Get course details | No |
| PUT | `/courses/:courseId` | Update course (admin only) | Yes |
| DELETE | `/courses/:courseId` | Delete course (admin only) | Yes |

**Student Management:**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| GET | `/students` | List all students (admin only) | Yes |
| GET | `/students/:studentId/details` | Get student details (admin only) | Yes |
| POST | `/users` | Create new user (admin only) | Yes |
| GET | `/users` | List all users (admin only) | Yes |
| GET | `/users/:userId` | Get user details (admin only) | Yes |
| PUT | `/users/:userId` | Update user profile (admin only) | Yes |
| DELETE | `/users/:userId` | Delete user (admin only) | Yes |

**Teacher Course Assignment:**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| POST | `/teacher-courses` | Assign course to teacher (admin only) | Yes |
| GET | `/teacher-courses/:teacherId` | Get teacher's assigned courses | No |
| DELETE | `/teacher-courses/:teacherId/:courseId` | Remove course from teacher (admin only) | Yes |

**Reports & Statistics:**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| GET | `/statistics/dashboard` | Dashboard statistics | No |
| GET | `/reports/course-enrollment` | Enrollment report | No |

## 🌱 Database Seeding

The project includes an automated Python seeding script to populate the database with realistic test data:

### What Gets Seeded

**Users:**
- 1 Admin user (admin@example.com)
- 3 Faculty users (Dr. Smith, Prof. Jones, Mr. Wilson)
- 5 Student users (Alice, Bob, Charlie, Diana, Eve)

**Courses:**
- 5 sample courses (CS101, CS102, CS201, MATH101, MATH102)

**Assignments & Enrollments:**
- Teacher course assignments for each faculty member
- Student enrollments distributed across courses
- Realistic enrollment patterns for testing

### Run Seeding Script

```bash
# Install required package
pip install requests

# Start the backend server in one terminal
npm run dev

# In another terminal, run the seeding script
python seed_data.py
```

The script will:
1. Create all users with appropriate roles
2. Create courses with specified capacities
3. Assign courses to faculty members
4. Enroll students in courses
5. Display credentials and summary

### Test Credentials After Seeding

```
Admin:
  Email:    admin@example.com
  Password: admin123

Faculty (Dr. Smith):
  Email:    dr.smith@example.com
  Password: faculty123
  Assigned courses: CS101, CS102

Faculty (Prof. Jones):
  Email:    prof.jones@example.com
  Password: faculty123
  Assigned courses: CS102, CS201

Faculty (Mr. Wilson):
  Email:    mr.wilson@example.com
  Password: faculty123
  Assigned courses: MATH101, MATH102

Student (Alice):
  Email:    alice@example.com
  Password: student123
  Enrolled courses: CS101, MATH101
```

## 🧪 Load Testing

The project includes a Python script to test concurrent course registration performance:

### Prerequisites

```bash
pip install requests
```

### Run Load Test

```bash
# Test with 100 concurrent requests, 5 iterations
python load_test.py
```

### Test Configuration

Edit `load_test.py` to adjust:

```python
NUM_CONCURRENT_REQUESTS = 100  # Concurrent requests per iteration
NUM_ITERATIONS = 5              # Number of test iterations
LOGIN_EMAIL = 'student@example.com'
LOGIN_PASSWORD = 'student123'
```

### Expected Results

The test will output:
- Total requests and success rate
- Rate limiting issues
- Response time statistics (min, max, avg, median, p95, p99)
- Performance assessment

**Example Output:**
```
Request Summary:
  Total Requests:      500
  Successful:          495 (99.0%)
  Rate Limited:        5
  Course Full:         0
  Already Enrolled:    0

Response Time Statistics (seconds):
  Minimum:             0.0234s
  Maximum:             1.2345s
  Average:             0.3456s
  95th Percentile:     0.7890s
  99th Percentile:     1.1234s
```

## 🔐 Security Considerations

1. **Password Security**: Passwords are hashed using bcrypt with 10 salt rounds
2. **JWT Tokens**: 24-hour expiration, requires re-authentication
3. **Database**: Use parameterized queries to prevent SQL injection
4. **Redis Lock**: Distributed locking prevents race conditions in concurrent registrations
5. **CORS**: Configured to accept requests from frontend only
6. **Input Validation**: All inputs are validated on the server

## 📊 Database Schema

### students
```sql
- id (PRIMARY KEY)
- name (VARCHAR)
- email (UNIQUE)
- password_hash (VARCHAR)
- role (VARCHAR: 'student', 'faculty', 'admin') DEFAULT 'student'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### courses
```sql
- id (PRIMARY KEY)
- code (VARCHAR, UNIQUE)
- title (VARCHAR)
- capacity (INT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### enrollments
```sql
- id (PRIMARY KEY)
- student_id (FOREIGN KEY → students)
- course_id (FOREIGN KEY → courses)
- created_at (TIMESTAMP)
- UNIQUE(student_id, course_id)
```

### grades
```sql
- id (PRIMARY KEY)
- student_id (FOREIGN KEY → students)
- course_id (FOREIGN KEY → courses)
- grade (VARCHAR)
- gpa (NUMERIC)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- UNIQUE(student_id, course_id)
```

### teacher_courses
```sql
- id (PRIMARY KEY)
- teacher_id (FOREIGN KEY → students, role='faculty')
- course_id (FOREIGN KEY → courses)
- created_at (TIMESTAMP)
- UNIQUE(teacher_id, course_id)
```

## 🔐 Role-Based Access Control

The system implements three user roles with specific permissions:

### Student Role
- Browse available courses
- Register for courses
- View enrolled courses and grades
- Calculate cumulative GPA
- Withdraw from courses
- Access Student Portal only

### Faculty Role
- View only courses assigned by admin
- Record and manage student grades
- View enrolled students in assigned courses
- Cannot access Admin Portal
- Cannot manage other faculty or courses

### Admin Role
- Full system access
- Create, update, delete courses
- Manage all user accounts (create, read, update, delete)
- Assign courses to faculty members
- View system statistics and reports
- Access Admin Portal with full privileges

### Portal Access Control
Each user is automatically routed to their appropriate portal after login:
- Students → Student Portal
- Faculty → Faculty Portal
- Admins → Admin Portal
- Unauthorized access attempts redirect to Login page

## 🎨 Frontend Components

### Login Component
- Login and registration forms with role selection
- Email and password validation
- JWT token management with localStorage
- Demo credentials display
- Role-based portal redirection

### Student Portal
- Dashboard with statistics (GPA, enrollments, grades)
- Browse and register for courses
- View enrolled courses with withdrawal option
- View grades and calculate cumulative GPA
- Auto-dismiss notifications (10 seconds)
- Role-based access control (student-only)

### Faculty Portal (NEW)
- View only assigned courses (not all courses)
- Select courses to manage
- View enrolled students in assigned courses
- Record and manage student grades
- Automatic GPA assignment based on letter grades
- Auto-dismiss notifications (10 seconds)
- Role-based access control (faculty-only)
- Logout button for session management

### Admin Portal (NEW)
- Dashboard with system statistics
- Full student management (create, read, update, delete)
- Full course management (create, read, update, delete)
- Teacher course assignment management
- Course enrollment reporting
- Capacity utilization analysis
- Auto-dismiss notifications (10 seconds)
- Role-based access control (admin-only)
- Logout button for session management

### Navigation Bar
- Links to main sections
- User information display
- Logout functionality
- Status indicators

## 📈 Performance Optimization

1. **Connection Pooling**: PostgreSQL pool with max 20 connections
2. **Caching**: Redis for distributed locks and session management
3. **Indexes**: Database indexes on frequently queried columns
4. **Query Optimization**: Efficient joins and aggregations
5. **Component Optimization**: React memo and lazy loading

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Ensure PostgreSQL is running:
```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Windows
pg_ctl -D "C:\Program Files\PostgreSQL\14\data" start
```

### Redis Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**: Start Redis server:
```bash
# macOS
brew services start redis

# Linux
redis-server

# Windows
redis-server.exe
```

### CORS Errors
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution**: Update `.env`:
```env
CORS_ORIGIN=http://localhost:3001
```

### JWT Token Expired
- Tokens expire after 24 hours
- User must re-login to get new token
- Token is stored in localStorage

## 📝 Development Workflow

1. Create feature branch
2. Make changes to files
3. Test with load_test.py
4. Commit and push
5. Create pull request

## 🤝 Contributing

1. Follow the existing code style
2. Write comments for complex logic
3. Test thoroughly before submitting PR
4. Update README for API changes

## 📄 License

MIT License - See LICENSE file for details

## 👥 Support

For issues and questions:
1. Check existing GitHub issues
2. Review API documentation above
3. Check troubleshooting section
4. Contact development team

## 🔄 Version History

### v10.0001 (Current)
- Added role-based access control (student, faculty, admin)
- Implemented teacher course assignment system
- Added admin user management endpoints
- Created Faculty Portal with course assignment filtering
- Enhanced Admin Portal with full user management
- Added automated database seeding script (seed_data.py)
- Implemented role-specific portal access control
- Added logout functionality to all portals
- Improved notification system with auto-dismiss (10 seconds)
- Updated API documentation with new endpoints

### v0.00001
- Initial release
- Full CRUD operations for courses
- Concurrent registration handling with Redis locks
- Grade management system
- Student profiles and statistics
- Admin dashboard
- Load testing support
- JWT-based authentication with bcrypt

---

**Last Updated**: 2026-05-12
**Project Status**: Active Development
