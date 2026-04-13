#!/usr/bin/env python3
"""
Final Seeding – Fixed student@example.com has complete data.
Course IDs are small (1-6). No old IDs remain.
"""

import psycopg2
import bcrypt
import random
import uuid
import json
from datetime import datetime, timedelta

DB_CONFIG = {
    "dbname": "sms_db",
    "user": "postgres",
    "password": "12345678",
    "host": "localhost",
    "port": 1145
}

def hash_password(pw):
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def random_date(start, end):
    return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()
cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
conn.commit()

# ---------- Create tables (simplified but complete) ----------
cur.execute("""
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student',
    phone VARCHAR(20),
    address TEXT,
    date_of_birth DATE,
    major VARCHAR(50),
    year VARCHAR(20),
    gpa NUMERIC(3,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    capacity INT NOT NULL,
    current_enrollments INT DEFAULT 0,
    department VARCHAR(50),
    credits INT,
    semester VARCHAR(10),
    year INT,
    schedule JSONB,
    prerequisites TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teacher_courses (
    id SERIAL PRIMARY KEY,
    teacher_id INT REFERENCES students(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, course_id)
);

CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'enrolled',
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

CREATE TABLE grades (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    grade VARCHAR(5),
    gpa NUMERIC(3,2),
    is_posted BOOLEAN DEFAULT false,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

CREATE TABLE assessments (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    type VARCHAR(20),
    max_score NUMERIC(5,2) NOT NULL,
    weight NUMERIC(5,2) DEFAULT 0,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_assessments (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    assessment_id INT REFERENCES assessments(id) ON DELETE CASCADE,
    score NUMERIC(5,2),
    feedback TEXT,
    graded_at TIMESTAMP,
    UNIQUE(student_id, assessment_id)
);

CREATE TABLE attendance_sessions (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    session_date DATE NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    qr_code VARCHAR(50),
    manual_code VARCHAR(10),
    created_by INT REFERENCES students(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    checkin_method VARCHAR(20),
    checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latitude NUMERIC(10,8),
    longitude NUMERIC(11,8),
    UNIQUE(session_id, student_id)
);

CREATE TABLE academic_history (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    course_code VARCHAR(20),
    course_title VARCHAR(100),
    grade VARCHAR(5),
    gpa NUMERIC(3,2),
    semester VARCHAR(10),
    year INT,
    credits INT,
    status VARCHAR(20)
);

CREATE TABLE registration_periods (
    id SERIAL PRIMARY KEY,
    semester VARCHAR(10),
    year INT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    add_drop_deadline TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE sso_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    provider_type VARCHAR(50),
    client_id VARCHAR(255),
    client_secret VARCHAR(255),
    redirect_uri VARCHAR(255),
    config JSONB,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE,
    value TEXT,
    description TEXT
);

CREATE TABLE waitlist (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    course_id INT REFERENCES courses(id),
    position INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES students(id),
    action VARCHAR(255),
    entity_type VARCHAR(50),
    entity_id INT,
    changes JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")
conn.commit()
print("Schema created.")

# ---------- Users ----------
users = [
    ("System Admin", "admin@example.com", "admin123", "admin", None, None, None, None, None, None, None, True),
    ("Faculty User", "faculty@example.com", "faculty123", "faculty", None, "+1-555-0000", "100 Faculty Lane", "1975-01-01", "Computer Science", None, 4.0, True),
    ("Josh Student", "student@example.com", "student123", "student", "STU99999", "+1-555-123-4567", "123 Main St, Apt 4B", "2000-05-15", "Computer Science", "Junior", 3.2, True),
]


# Add 15 random faculty
faculty_names = ["Dr. Alan Turing", "Prof. Grace Hopper", "Dr. Marie Curie", "Prof. Isaac Newton", "Dr. Ada Lovelace"]
for i, name in enumerate(faculty_names):
    email = name.lower().replace(" ", ".") + "@university.edu"
    users.append((name, email, "faculty123", "faculty", None, f"+1-555-{1000+i}", f"{i+100} Faculty Lane", "1970-01-01", "Computer Science", None, 4.0, True))

# Add 50 random students
for i in range(50):
    name = f"Student{i} Last{i}"
    email = f"student{i}@student.edu"
    student_id = f"STU{10000+i:05d}"
    users.append((name, email, "student123", "student", student_id, f"+1-555-{i}", f"{i} Dorm St", "2000-01-01", "Computer Science", "Sophomore", round(random.uniform(2.0,4.0),2), True))

user_ids = {}
for u in users:
    cur.execute("""
        INSERT INTO students (name, email, password_hash, role, student_id, phone, address, date_of_birth, major, year, gpa, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, (u[0], u[1], hash_password(u[2]), u[3], u[4], u[5], u[6], u[7], u[8], u[9], u[10], u[11]))
    user_ids[u[1]] = cur.fetchone()[0]
print(f"Users inserted: {len(users)}")
# ---------- Academic history for fixed student (many records) ----------
fixed_student_id = user_ids["student@example.com"]
past_courses = [
    ("CS100", "Intro to Programming", "A", 4.0, "Fall", 2025, 3, "completed"),
    ("MATH100", "College Algebra", "B+", 3.3, "Fall", 2025, 3, "completed"),
    ("ENGL101", "English Composition", "A-", 3.7, "Spring", 2025, 3, "completed"),
    ("PHYS100", "Intro Physics", "B", 3.0, "Spring", 2025, 4, "completed"),
    ("CS200", "Data Structures", "A", 4.0, "Fall", 2024, 3, "completed"),
    ("MATH200", "Calculus II", "B+", 3.3, "Fall", 2024, 4, "completed"),
    ("HIST101", "World History", "A-", 3.7, "Spring", 2024, 3, "completed"),
    ("CHEM101", "General Chemistry", "B", 3.0, "Spring", 2024, 4, "completed"),
    ("ECON101", "Microeconomics", "A-", 3.7, "Fall", 2023, 3, "completed"),
    ("PSYC101", "Intro Psychology", "B+", 3.3, "Fall", 2023, 3, "completed"),
]
for (code, title, grade, gpa, sem, yr, cred, status) in past_courses:
    cur.execute("""
        INSERT INTO academic_history (student_id, course_code, course_title, grade, gpa, semester, year, credits, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (fixed_student_id, code, title, grade, gpa, sem, yr, cred, status))

# ---------- Courses (only the ones we need) ----------
course_defs = [
    ("CS101", "Programming Fundamentals", 30, "Computer Science", 3, "Spring", 2026),
    ("MATH101", "Calculus I", 35, "Mathematics", 4, "Spring", 2026),
    ("CHEM102", "Inorganic Chemistry", 25, "Chemistry", 3, "Spring", 2026),
    ("BIO101", "Biology I", 28, "Biology", 3, "Spring", 2026),
    ("PHYS101", "Physics I", 30, "Physics", 4, "Spring", 2026),
    ("ENGR100", "Intro to Engineering", 32, "Engineering", 3, "Spring", 2026),
]
course_ids = {}
for code, title, cap, dept, cred, sem, yr in course_defs:
    cur.execute("""
        INSERT INTO courses (code, title, capacity, department, credits, semester, year, description, schedule, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, true) RETURNING id
    """, (code, title, cap, dept, cred, sem, yr, f"Course on {title}", json.dumps({"days":["Monday","Wednesday"],"times":["10:00-11:30"]})))
    course_ids[code] = cur.fetchone()[0]
print(f"Courses inserted: {list(course_ids.values())} (IDs 1-6)")

# ---------- Teacher assignments ----------
faculty_id = user_ids["faculty@example.com"]
for cid in course_ids.values():
    cur.execute("INSERT INTO teacher_courses (teacher_id, course_id, is_primary) VALUES (%s, %s, true) ON CONFLICT DO NOTHING", (faculty_id, cid))

# ---------- Enroll fixed student ----------
fixed_student_id = user_ids["student@example.com"]
for cid in course_ids.values():
    cur.execute("INSERT INTO enrollments (student_id, course_id, status) VALUES (%s, %s, 'enrolled') ON CONFLICT DO NOTHING", (fixed_student_id, cid))

# Enroll other random students to make statistics meaningful
other_student_ids = [uid for email, uid in user_ids.items() if email.endswith("@student.edu") and email != "student@example.com"]
for cid in course_ids.values():
    for sid in random.sample(other_student_ids, min(15, len(other_student_ids))):
        cur.execute("INSERT INTO enrollments (student_id, course_id, status) VALUES (%s, %s, 'enrolled') ON CONFLICT DO NOTHING", (sid, cid))
cur.execute("UPDATE courses SET current_enrollments = (SELECT COUNT(*) FROM enrollments WHERE enrollments.course_id = courses.id)")
print("Enrollments done.")

# ---------- Grades for fixed student ----------
grade_map = {
    "CS101": ("A", 4.0, True, "Excellent!"),
    "MATH101": ("B+", 3.3, True, "Good progress"),
    "CHEM102": ("B-", 2.7, True, "Acceptable"),
    "BIO101": ("A-", 3.7, False, "Very good"),
    "PHYS101": ("B", 3.0, True, "Satisfactory"),
    "ENGR100": ("A-", 3.7, False, "Very good"),
}
for code, (grade, gpa, posted, feedback) in grade_map.items():
    cid = course_ids[code]
    cur.execute("""
        INSERT INTO grades (student_id, course_id, grade, gpa, is_posted, feedback)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (student_id, course_id) DO UPDATE SET grade=EXCLUDED.grade, gpa=EXCLUDED.gpa, is_posted=EXCLUDED.is_posted, feedback=EXCLUDED.feedback
    """, (fixed_student_id, cid, grade, gpa, posted, feedback))

# Random grades for other students
for cid in course_ids.values():
    cur.execute("SELECT student_id FROM enrollments WHERE course_id=%s AND student_id != %s", (cid, fixed_student_id))
    for (sid,) in cur.fetchall():
        if random.random() < 0.7:
            grade = random.choice(['A','A-','B+','B','B-','C+','C','C-','D','F'])
            gpa = {'A':4.0,'A-':3.7,'B+':3.3,'B':3.0,'B-':2.7,'C+':2.3,'C':2.0,'C-':1.7,'D':1.0,'F':0.0}[grade]
            posted = random.choice([True, False])
            cur.execute("INSERT INTO grades (student_id, course_id, grade, gpa, is_posted) VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING", (sid, cid, grade, gpa, posted))
print("Grades inserted.")

# ---------- Assessments and student scores ----------
assessment_types = ['exam', 'quiz', 'project', 'homework']
for cid in course_ids.values():
    num = random.randint(2,4)
    total_weight = 0
    for i in range(num):
        title = f"{assessment_types[i % len(assessment_types)].capitalize()} {i+1}"
        atype = assessment_types[i % len(assessment_types)]
        max_score = random.choice([50,100])
        weight = round(100/num, 1) if i == num-1 else round(random.uniform(10,40),1)
        total_weight += weight
        due_date = random_date(datetime(2026,2,1), datetime(2026,5,31)).date()
        cur.execute("""
            INSERT INTO assessments (course_id, title, type, max_score, weight, due_date)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """, (cid, title, atype, max_score, weight, due_date))
        aid = cur.fetchone()[0]
        # Insert scores for all students who have a grade in this course
        cur.execute("SELECT student_id FROM grades WHERE course_id=%s", (cid,))
        for (sid,) in cur.fetchall():
            score = round(random.uniform(0.6, 1.0) * max_score, 1)
            cur.execute("INSERT INTO student_assessments (student_id, assessment_id, score, feedback, graded_at) VALUES (%s, %s, %s, 'Well done', NOW()) ON CONFLICT DO NOTHING", (sid, aid, score))
print("Assessments and scores inserted.")

# ---------- Attendance sessions and records ----------
for cid in course_ids.values():
    num_sessions = random.randint(3,5)
    for i in range(num_sessions):
        session_date = random_date(datetime(2026,2,1), datetime(2026,4,30)).date()
        start_time = datetime.combine(session_date, datetime.min.time()) + timedelta(hours=random.randint(8,14))
        end_time = start_time + timedelta(hours=1, minutes=30)
        qr_code = str(uuid.uuid4())[:8]
        manual_code = str(random.randint(1000,9999))
        cur.execute("""
            INSERT INTO attendance_sessions (course_id, title, session_date, start_time, end_time, qr_code, manual_code, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (cid, f"Lecture {i+1}", session_date, start_time, end_time, qr_code, manual_code, faculty_id))
        sess_id = cur.fetchone()[0]
        # Mark fixed student present
        cur.execute("INSERT INTO attendance_records (session_id, student_id, checkin_method) VALUES (%s, %s, 'manual') ON CONFLICT DO NOTHING", (sess_id, fixed_student_id))
        # Mark random other students present
        cur.execute("SELECT student_id FROM enrollments WHERE course_id=%s AND student_id != %s", (cid, fixed_student_id))
        others = [row[0] for row in cur.fetchall()]
        for sid in random.sample(others, min(int(len(others)*0.7), len(others))):
            cur.execute("INSERT INTO attendance_records (session_id, student_id, checkin_method) VALUES (%s, %s, 'qr') ON CONFLICT DO NOTHING", (sess_id, sid))
print("Attendance sessions and records inserted.")

# ---------- Academic history for fixed student ----------
history = [
    ("CS100", "Intro to Programming", "A", 4.0, "Fall", 2025, 3, "completed"),
    ("MATH100", "College Algebra", "B+", 3.3, "Fall", 2025, 3, "completed"),
    ("ENGL101", "English Composition", "A-", 3.7, "Spring", 2025, 3, "completed"),
    ("PHYS100", "Intro Physics", "B", 3.0, "Spring", 2025, 4, "completed"),
]
for code, title, grade, gpa, sem, yr, cred, status in history:
    cur.execute("""
        INSERT INTO academic_history (student_id, course_code, course_title, grade, gpa, semester, year, credits, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (fixed_student_id, code, title, grade, gpa, sem, yr, cred, status))
print("Academic history inserted.")

# ---------- Registration period ----------
cur.execute("""
    INSERT INTO registration_periods (semester, year, start_date, end_date, add_drop_deadline, is_active)
    VALUES ('Spring', 2026, '2026-01-01 00:00:00', '2026-06-30 23:59:59', '2026-06-15 23:59:59', true)
""")

# ---------- System settings ----------
for key,val in [('registration_open','true'), ('max_waitlist_size','50')]:
    cur.execute("INSERT INTO system_settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO NOTHING", (key, val))

conn.commit()
cur.close()
conn.close()
print("Seeding complete!")
print("\nFixed student: student@example.com / student123")
print("Course IDs are now 1-6. No more 403 errors.")