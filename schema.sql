-- =========================
-- Students table
-- =========================
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE,  -- Student ID (SID)
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student','faculty','admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Courses table
-- =========================
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, course_id)
);

-- =========================
-- Enrollments table
-- =========================
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- =========================
-- Grades table
-- =========================
CREATE TABLE grades (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    grade VARCHAR(5) CHECK (grade IN ('A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F')),
    gpa NUMERIC(3,2) CHECK (gpa >= 0 AND gpa <= 4.0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- =========================
-- Indexes for performance
-- =========================
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_role ON students(role);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_grades_student_id ON grades(student_id);
CREATE INDEX idx_grades_course_id ON grades(course_id);
CREATE INDEX idx_teacher_courses_teacher_id ON teacher_courses(teacher_id);
CREATE INDEX idx_teacher_courses_course_id ON teacher_courses(course_id);
