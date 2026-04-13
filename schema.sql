-- =========================
-- Students table (Enhanced)
-- =========================
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE,  -- Student ID (SID)
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student','faculty','admin')),
    phone VARCHAR(20),
    address TEXT,
    date_of_birth DATE,
    major VARCHAR(100),
    year VARCHAR(20), -- Freshman, Sophomore, etc.
    gpa NUMERIC(3,2) DEFAULT 0.0 CHECK (gpa >= 0 AND gpa <= 4.0),
    credits_earned INT DEFAULT 0,
    profile_picture_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Courses table (Enhanced)
-- =========================
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    capacity INT NOT NULL CHECK (capacity > 0),
    current_enrollments INT DEFAULT 0,
    department VARCHAR(100),
    credits INT DEFAULT 3,
    semester VARCHAR(20), -- Fall, Spring, Summer
    year INT, -- Academic year
    schedule JSONB, -- Store schedule as JSON (days, times, location)
    prerequisites JSONB, -- Array of prerequisite course codes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Teacher Courses (assignment)
-- =========================
CREATE TABLE teacher_courses (
    id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT true, -- Primary instructor vs assistant
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, course_id)
);

-- =========================
-- Enrollments table (Enhanced)
-- =========================
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'enrolled' CHECK (status IN ('enrolled','waitlist','dropped')),
    waitlist_position INT,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dropped_at TIMESTAMP,
    grade_posted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- =========================
-- Grades table (Enhanced)
-- =========================
CREATE TABLE grades (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    grade VARCHAR(5) CHECK (grade IN ('A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F')),
    gpa NUMERIC(3,2) CHECK (gpa >= 0 AND gpa <= 4.0),
    is_posted BOOLEAN DEFAULT false, -- Grade visibility toggle
    feedback TEXT, -- Personalized feedback from instructor
    assessment_breakdown JSONB, -- Individual assessment scores
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- =========================
-- Assessments table (for detailed grade tracking)
-- =========================
CREATE TABLE assessments (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- Quiz, Midterm, Final, Assignment, etc.
    max_score NUMERIC(5,2) NOT NULL,
    weight NUMERIC(5,2) NOT NULL, -- Percentage weight in final grade
    due_date TIMESTAMP,
    is_graded BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Student Assessments (individual scores)
-- =========================
CREATE TABLE student_assessments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assessment_id INT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    score NUMERIC(5,2),
    feedback TEXT,
    submitted_at TIMESTAMP,
    graded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, assessment_id)
);

-- =========================
-- Attendance Sessions
-- =========================
CREATE TABLE attendance_sessions (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    session_date TIMESTAMP NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    checkin_methods JSONB DEFAULT '["qr", "manual"]', -- Array of allowed methods
    qr_code VARCHAR(500), -- Generated QR code data
    manual_code VARCHAR(10), -- Random code for manual entry
    bluetooth_enabled BOOLEAN DEFAULT false,
    bluetooth_uuid VARCHAR(36), -- Bluetooth beacon UUID
    created_by INT NOT NULL REFERENCES students(id), -- Teacher who created
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Attendance Records
-- =========================
CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    checkin_method VARCHAR(20) NOT NULL, -- qr, manual, bluetooth
    checkin_time TIMESTAMP NOT NULL,
    latitude NUMERIC(10,8), -- For location-based checkins
    longitude NUMERIC(11,8),
    device_info JSONB, -- Browser/device info for security
    is_valid BOOLEAN DEFAULT true, -- Can be marked invalid by instructor
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, student_id)
);

-- =========================
-- Waitlist table
-- =========================
CREATE TABLE waitlist (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    position INT NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notified_at TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- =========================
-- Course Registration Periods
-- =========================
CREATE TABLE registration_periods (
    id SERIAL PRIMARY KEY,
    semester VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    add_drop_deadline TIMESTAMP,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(semester, year)
);

-- =========================
-- Academic History (transcript data)
-- =========================
CREATE TABLE academic_history (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_code VARCHAR(20) NOT NULL,
    course_title VARCHAR(100) NOT NULL,
    grade VARCHAR(5),
    gpa NUMERIC(3,2),
    semester VARCHAR(20),
    year INT,
    credits INT DEFAULT 3,
    status VARCHAR(20) DEFAULT 'completed', -- completed, in_progress, withdrawn
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- SSO Integration table
-- =========================
CREATE TABLE sso_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    provider_type VARCHAR(50) NOT NULL, -- university_sso, google, microsoft, etc.
    client_id VARCHAR(255),
    client_secret VARCHAR(255),
    redirect_uri VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    config JSONB, -- Additional provider-specific config
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- SSO User mappings
-- =========================
CREATE TABLE sso_mappings (
    id SERIAL PRIMARY KEY,
    local_user_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    sso_provider_id INT NOT NULL REFERENCES sso_providers(id) ON DELETE CASCADE,
    sso_user_id VARCHAR(255) NOT NULL,
    sso_email VARCHAR(255),
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sso_provider_id, sso_user_id)
);

-- =========================
-- System Settings
-- =========================
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Audit Log
-- =========================
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES students(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Indexes for performance
-- =========================
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_role ON students(role);
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_is_active ON students(is_active);
CREATE INDEX idx_courses_code ON courses(code);
CREATE INDEX idx_courses_semester_year ON courses(semester, year);
CREATE INDEX idx_courses_is_active ON courses(is_active);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_grades_student_id ON grades(student_id);
CREATE INDEX idx_grades_course_id ON grades(course_id);
CREATE INDEX idx_grades_is_posted ON grades(is_posted);
CREATE INDEX idx_assessments_course_id ON assessments(course_id);
CREATE INDEX idx_student_assessments_student_id ON student_assessments(student_id);
CREATE INDEX idx_student_assessments_assessment_id ON student_assessments(assessment_id);
CREATE INDEX idx_attendance_sessions_course_id ON attendance_sessions(course_id);
CREATE INDEX idx_attendance_sessions_session_date ON attendance_sessions(session_date);
CREATE INDEX idx_attendance_records_session_id ON attendance_records(session_id);
CREATE INDEX idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX idx_waitlist_course_id ON waitlist(course_id);
CREATE INDEX idx_waitlist_position ON waitlist(position);
CREATE INDEX idx_registration_periods_active ON registration_periods(is_active);
CREATE INDEX idx_academic_history_student_id ON academic_history(student_id);
CREATE INDEX idx_sso_mappings_local_user_id ON sso_mappings(local_user_id);
CREATE INDEX idx_sso_mappings_sso_provider_id ON sso_mappings(sso_provider_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_teacher_courses_teacher_id ON teacher_courses(teacher_id);
CREATE INDEX idx_teacher_courses_course_id ON teacher_courses(course_id);
