#!/usr/bin/env python3
"""
Full Database Reset and Seeding Script
Drops existing tables, recreates schema, and seeds legacy + new accounts,
courses, teacher assignments, and student enrollments.
"""

import psycopg2
import bcrypt

# Database connection
conn = psycopg2.connect(
    dbname="sms_db",
    user="postgres",
    password="12345678",
    host="localhost",
    port="1145"
)
cur = conn.cursor()

# Step 1: Drop old tables
cur.execute("""
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS teacher_courses CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS students CASCADE;
""")

# Step 2: Recreate schema
cur.execute("""
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student','faculty','admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teacher_courses (
    id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, course_id)
);

CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

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
""")

# Step 3: Insert accounts
users = [
    # Admins (no student_id)
    ("System Admin", "admin@example.com", "admin123", "admin", None),
    ("David Admin", "david@example.com", "david123", "admin", None),
    # Faculty (no student_id)
    ("Dr. Smith", "dr.smith@example.com", "faculty123", "faculty", None),
    ("Prof. Jones", "prof.jones@example.com", "faculty123", "faculty", None),
    ("Mr. Wilson", "mr.wilson@example.com", "faculty123", "faculty", None),
    ("Sophia Faculty", "sophia@example.com", "sophia123", "faculty", None),
    # Students (with student_id)
    ("Alice Johnson", "alice@example.com", "student123", "student", "STU001"),
    ("Bob Smith", "bob@example.com", "student123", "student", "STU002"),
    ("Charlie Brown", "charlie@example.com", "student123", "student", "STU003"),
    ("Diana Prince", "diana@example.com", "student123", "student", "STU004"),
    ("Eve Davis", "eve@example.com", "student123", "student", "STU005"),
    ("Josh", "student@example.com", "student123", "student", "STU006"),
    ("Kevin Student", "kevin@example.com", "kevin123", "student", "STU007"),
    ("Emily Student", "emily@example.com", "emily123", "student", "STU008"),
    ("Ryan Student", "ryan@example.com", "ryan123", "student", "STU009"),
]

user_ids = {}
for name, email, password, role, student_id in users:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    cur.execute(
        "INSERT INTO students (name, email, password_hash, role, student_id) VALUES (%s, %s, %s, %s, %s) RETURNING id;",
        (name, email, hashed.decode(), role, student_id)
    )
    user_id = cur.fetchone()[0]
    user_ids[email] = user_id

# Step 4: Insert courses
courses = [
    ("CS101", "Introduction to Computer Science", 30),
    ("CS102", "Data Structures", 25),
    ("CS201", "Algorithms", 25),
    ("MATH101", "Calculus I", 40),
    ("MATH102", "Calculus II", 35),
]
course_ids = {}
for code, title, capacity in courses:
    cur.execute(
        "INSERT INTO courses (code, title, capacity) VALUES (%s, %s, %s) RETURNING id;",
        (code, title, capacity)
    )
    course_id = cur.fetchone()[0]
    course_ids[code] = course_id

# Step 5: Assign teachers
teacher_assignments = {
    "dr.smith@example.com": ["CS101", "CS102"],
    "prof.jones@example.com": ["CS102", "CS201"],
    "mr.wilson@example.com": ["MATH101", "MATH102"],
    "sophia@example.com": ["CS101"],
}
for teacher_email, course_codes in teacher_assignments.items():
    for code in course_codes:
        cur.execute(
            "INSERT INTO teacher_courses (teacher_id, course_id) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
            (user_ids[teacher_email], course_ids[code])
        )

# Step 6: Enroll students
student_enrollments = {
    "alice@example.com": ["CS101", "MATH101"],
    "bob@example.com": ["CS101", "MATH102"],
    "charlie@example.com": ["CS102", "CS201", "MATH101"],
    "diana@example.com": ["CS201", "MATH102"],
    "eve@example.com": ["CS101", "CS102", "MATH101"],
    "kevin@example.com": ["CS101", "MATH101"],
    "emily@example.com": ["CS102", "MATH102"],
    "ryan@example.com": ["CS201", "MATH101"],
    "student@example.com": ["CS101"],  # Josh
}
for student_email, course_codes in student_enrollments.items():
    for code in course_codes:
        cur.execute(
            "INSERT INTO enrollments (student_id, course_id) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
            (user_ids[student_email], course_ids[code])
        )

# Commit changes
conn.commit()
cur.close()
conn.close()

print("✓ Database reset and seeding complete!")
