# Student Management System (SMS)

A comprehensive student management system built with Node.js, Express, PostgreSQL, and React. The system supports course registration, grade management, student profiles, attendance tracking, and admin/faculty dashboards.

## 🌟 What this README covers

This guide explains how to open the project step by step, install dependencies, configure the database, run the backend and frontend, and access the application in your browser.

## 📋 Prerequisites

Before opening the project, make sure you have the following installed:

- **Node.js** 14 or newer
- **npm** (included with Node.js)
- **PostgreSQL** 12 or newer
- **Redis** server running locally
- **Python** 3.7 or newer (optional, for seed script)
- A code editor such as **Visual Studio Code**

## 🔧 Step 1: Open the project in VS Code

1. Open Visual Studio Code.
2. Select **File > Open Folder...**.
3. Navigate to `c:\Users\aviso\Documents\GitHub\project-M`.
4. Click **Select Folder**.
5. The project root should now appear in the Explorer panel.

> Tip: If you already have VS Code open, use **File > Open Folder...** and choose the same path.

## 📥 Step 2: Install backend dependencies

1. Open a terminal in VS Code by selecting **Terminal > New Terminal**.
2. Make sure the terminal is in the project root: `c:\Users\aviso\Documents\GitHub\project-M`.
3. Run:

```bash
npm install
```

This installs the backend dependencies defined in `package.json`.

## 🗄️ Step 3: Set up the PostgreSQL database

1. Start PostgreSQL if it is not already running.
2. Create the database:

```bash
createdb sms_db
```

3. Run the schema file to create tables:

```bash
psql -U postgres -d sms_db -f schema.sql
```

If your PostgreSQL user is named differently, replace `postgres` with your user name.

## 🔑 Step 4: Configure environment variables

1. In the project root, copy `.env.example` to `.env`.

```bash
copy .env.example .env
```

2. Open `.env` in VS Code.
3. Update the values to match your local setup, for example:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/sms_db
PORT=3001
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
REDIS_URL=redis://localhost:6379 <-also change to your redis>
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=debug
```

## 🌱 Step 5: Seed sample data (optional but recommended)

To populate sample users, courses, and enrollment data, run the seed script.

1. In one terminal, start the backend server (see Step 6 below).
2. In another terminal, run:

```bash
python seed_data.py
```

If Python is not installed, you can skip this step and create test data manually.

## 🚀 Step 6: Run the backend server

In the project root terminal, start the backend:

```bash
npm run dev
```

This runs the server with auto-reload. The backend listens at:

```text
http://localhost:3001
```

## 🌐 Step 7: Run the frontend app

1. Open a second terminal in VS Code.
2. Change into the frontend directory:

```bash
cd frontend
```

3. Install frontend dependencies:

```bash
npm install
```

4. Start the React app:

```bash
npm start
```

The frontend will open at:

```text
http://localhost:3000
```

The React app should proxy API requests to the backend running on port `3001`.

## 🧭 Step 8: Open the app in your browser

1. After starting both servers, open your browser.
2. Go to:

```text
http://localhost:3000
```

3. Use seeded credentials or create a new account to log in.

## ✅ How to use the app

### Student portal
- View profile and statistics
- Register for courses
- View grades
- View attendance

### Faculty portal
- Manage assigned courses
- Create attendance sessions
- Record grades

### Admin portal
- Manage courses and users
- Assign teachers
- View system reports

## 📁 Project structure overview

```
project-M/
├── schema.sql
├── seed_data.py
├── server.js
├── package.json
├── .env.example
├── routes/
│   ├── admin.js
│   ├── assessments.js
│   ├── attendance.js
│   ├── auth.js
│   ├── grades.js
│   ├── profile.js
│   ├── registration.js
│   ├── student.js
│   └── sso.js
├── middleware/
│   └── auth.js
├── frontend/
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js
│       ├── Login.jsx
│       ├── StudentPortal.jsx
│       ├── FacultyPortal.jsx
│       ├── AdminPortal.jsx
│       └── *.css
└── README.md
```

## 📌 Quick commands summary

```bash
# Open project folder in VS Code
code .

# Install backend dependencies
npm install

# Start backend server
npm run dev

# Install frontend dependencies
cd frontend
npm install

# Start frontend
npm start
```

## 📝 Notes

- If the frontend does not open automatically, manually visit `http://localhost:3000`.
- If the backend fails, check `DATABASE_URL`, `PORT`, and Redis connectivity.
- The seed script is optional but recommended for quick testing.

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

**Last Updated**: 2026-04-18
**Project Status**: ended

## ⚠️ Known Environment Constraints (Added Note)

This section is added as a clarification note without changing existing setup instructions.

### Redis memory limit in the current environment

- The current Redis environment may have a small memory cap (around **30 MB** in some deployments).
- Under higher load or larger datasets, Redis eviction and lock/cache behavior can differ from a larger production Redis instance.
- Performance and concurrency test results should be interpreted with this limit in mind.

### Seed dataset scale

- The current `seed_data.py` is designed for **demo/testing coverage**, not large-scale benchmarking.
- It does **not** generate a 5000-record-level dataset by default.
- If 5k+ scale validation is required, use an additional data generation script or extend the existing seed process.

### Testing recommendation  

1. Validate functional flows with the default seed data first.
2. Run separate large-scale tests with expanded synthetic data.
3. Record Redis memory constraints alongside performance results in reports.
PS C:\Users\aviso\Documents\GitHub\project-M> node test-concurrency.js
redis testing :
🚀 Starting Concurrency Test: Sending 10 simultaneous requests...
Request 1: 🔒 Blocked by Redis Lock (429)
Request 2: ❌ Failed with Status 400
Error Data: { error: 'You are already enrolled for this course' }
Request 3: 🔒 Blocked by Redis Lock (429)
Request 4: 🔒 Blocked by Redis Lock (429)
Request 5: 🔒 Blocked by Redis Lock (429)
Request 6: 🔒 Blocked by Redis Lock (429)
Request 7: 🔒 Blocked by Redis Lock (429)
Request 8: 🔒 Blocked by Redis Lock (429)
Request 9: 🔒 Blocked by Redis Lock (429)
Request 10: 🔒 Blocked by Redis Lock (429)

--- TEST SUMMARY ---
Total Requests: 10
Successful Enrollments: 0
Redis Protections (429): 9
Other Failures: 1
