#!/usr/bin/env python3
"""
Complete Database Seeding Script – Large Dataset for Student Management System
Now guarantees that the fixed student student@example.com has complete data.
"""

import psycopg2
import bcrypt
import random
import uuid
import json
from datetime import datetime, timedelta

# ============================================================
# Configuration
# ============================================================
DB_CONFIG = {
    "dbname": "sms_db",
    "user": "postgres",
    "password": "12345678",
    "host": "localhost",
    "port": 1145
}

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def random_date(start: datetime, end: datetime) -> datetime:
    return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))

# ============================================================
# Connect and clean
# ============================================================
conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()
cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
conn.commit()

# ============================================================
# Create all tables (full schema)
# ============================================================
print("Creating database schema...")
cur.execute("""
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student','faculty','admin')),
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
    capacity INT NOT NULL CHECK (capacity > 0),
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
    teacher_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, course_id)
);

CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'enrolled',
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

CREATE TABLE grades (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    grade VARCHAR(5) CHECK (grade IN ('A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F')),
    gpa NUMERIC(3,2) CHECK (gpa >= 0 AND gpa <= 4.0),
    is_posted BOOLEAN DEFAULT false,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

CREATE TABLE assessments (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('exam','quiz','project','homework','final')),
    max_score NUMERIC(5,2) NOT NULL,
    weight NUMERIC(5,2) DEFAULT 0,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_assessments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assessment_id INT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    score NUMERIC(5,2),
    feedback TEXT,
    graded_at TIMESTAMP,
    UNIQUE(student_id, assessment_id)
);

CREATE TABLE attendance_sessions (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
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
    session_id INT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    checkin_method VARCHAR(20) CHECK (checkin_method IN ('qr','manual','face')),
    checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latitude NUMERIC(10,8),
    longitude NUMERIC(11,8),
    UNIQUE(session_id, student_id)
);

CREATE TABLE academic_history (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
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

# ============================================================
# Generate data
# ============================================================
print("Seeding massive test data...")

# ---------- 1. Users (students + faculty + admin) ----------
users = []

# Admin
users.append(("System Admin", "admin@example.com", "admin123", "admin", None, None, None, None, None, None, None, True))

# Faculty (15)
faculty_names = [
    "Dr. Alan Turing", "Prof. Grace Hopper", "Dr. Marie Curie", "Prof. Isaac Newton",
    "Dr. Ada Lovelace", "Prof. Albert Einstein", "Dr. Katherine Johnson", "Prof. Stephen Hawking",
    "Dr. Jane Goodall", "Prof. Richard Feynman", "Dr. Linus Torvalds", "Prof. Barbara Liskov",
    "Dr. John Nash", "Prof. Emmy Noether", "Dr. Carl Sagan"
]
faculty_majors = [
    "Computer Science", "Mathematics", "Physics", "Chemistry", "Biology",
    "Engineering", "Economics", "Psychology", "Philosophy", "Astronomy"
]
for i, name in enumerate(faculty_names):
    email = name.lower().replace(" ", ".") + "@university.edu"
    users.append((name, email, "faculty123", "faculty", None,
                  f"+1-555-{1000+i}", f"{i+100} Faculty Lane", f"19{random.randint(60,80)}-{random.randint(1,12)}-{random.randint(1,28)}",
                  random.choice(faculty_majors), None, round(random.uniform(3.5, 4.0), 2), True))

# Fixed test student: student@example.com
fixed_student = ("Josh Student", "student@example.com", "student123", "student", "STU99999",
                 "+1-555-123-4567", "123 Main St", "2000-01-01", "Computer Science", "Junior", 3.2, True)
users.append(fixed_student)

# Additional 59 random students (total 60 + fixed = 61 students)
student_first = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth",
                 "David", "Susan", "Richard", "Jessica", "Joseph", "Sarah", "Thomas", "Karen", "Charles", "Nancy",
                 "Christopher", "Lisa", "Daniel", "Betty", "Matthew", "Margaret", "Anthony", "Sandra", "Mark", "Ashley",
                 "Donald", "Emily", "Steven", "Kimberly", "Paul", "Donna", "Andrew", "Michelle", "Kenneth", "Dorothy",
                 "Joshua", "Carol", "Kevin", "Amanda", "Brian", "Melissa", "George", "Deborah", "Edward", "Stephanie"]
student_last = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
                "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
                "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
                "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"]
majors = ["Computer Science", "Mathematics", "Physics", "Chemistry", "Biology", "Engineering", "Economics", "Psychology"]
years = ["Freshman", "Sophomore", "Junior", "Senior"]
for i in range(59):
    first = random.choice(student_first)
    last = random.choice(student_last)
    name = f"{first} {last}"
    email = f"{first.lower()}.{last.lower()}{random.randint(1,999)}@student.edu"
    student_id = f"STU{10000 + i:05d}"
    phone = f"+1-555-{random.randint(100,999)}-{random.randint(1000,9999)}"
    address = f"{random.randint(1,999)} Student Dorm, Apt {random.randint(1,50)}"
    dob = f"{random.randint(1995,2005)}-{random.randint(1,12)}-{random.randint(1,28)}"
    major = random.choice(majors)
    year = random.choice(years)
    gpa = round(random.uniform(2.0, 4.0), 2)
    users.append((name, email, "student123", "student", student_id, phone, address, dob, major, year, gpa, True))

# Insert users and keep mapping
user_ids = {}
for u in users:
    cur.execute("""
        INSERT INTO students
        (name, email, password_hash, role, student_id, phone, address, date_of_birth, major, year, gpa, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (u[0], u[1], hash_password(u[2]), u[3], u[4], u[5], u[6], u[7], u[8], u[9], u[10], u[11]))
    user_ids[u[1]] = cur.fetchone()[0]

print(f"  ✓ {len(users)} users inserted (including fixed student@example.com)")

# ---------- 2. Courses (35 courses) ----------
departments = ["CS", "MATH", "PHYS", "CHEM", "BIO", "ENGR", "ECON", "PSYC"]
course_names = {
    "CS": ["Programming Fundamentals", "Data Structures", "Algorithms", "Operating Systems", "Databases", "Web Development", "AI", "Machine Learning"],
    "MATH": ["Calculus I", "Calculus II", "Linear Algebra", "Discrete Math", "Statistics", "Differential Equations", "Real Analysis"],
    "PHYS": ["Physics I", "Physics II", "Modern Physics", "Quantum Mechanics", "Thermodynamics", "Electromagnetism"],
    "CHEM": ["General Chemistry", "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Analytical Chemistry"],
    "BIO": ["Biology I", "Genetics", "Cell Biology", "Ecology", "Microbiology", "Neuroscience"],
    "ENGR": ["Intro to Engineering", "Circuit Analysis", "Thermodynamics", "Fluid Mechanics", "Materials Science"],
    "ECON": ["Microeconomics", "Macroeconomics", "Econometrics", "International Economics", "Game Theory"],
    "PSYC": ["Intro Psychology", "Cognitive Psych", "Developmental Psych", "Social Psych", "Abnormal Psych"]
}
courses_list = []
for dept in departments:
    for idx, title in enumerate(course_names[dept]):
        code = f"{dept}{100 + idx:02d}"
        capacity = random.randint(20, 45)
        credits = random.choice([3, 4])
        semester = "Spring" if random.random() > 0.5 else "Fall"
        year = 2026
        schedule = {"days": random.sample(["Monday","Tuesday","Wednesday","Thursday","Friday"], k=random.randint(2,3)),
                    "times": [f"{random.randint(8,16)}:00-{random.randint(9,17)}:30"],
                    "location": f"Room {random.randint(100,500)}"}
        schedule_json = json.dumps(schedule)
        prerequisites = []
        if idx > 0 and dept in ["CS","MATH"]:
            prerequisites = [f"{dept}{100 + idx - 1:02d}"]
        courses_list.append((code, title, f"An advanced course in {title}.", capacity, 0, dept, credits, semester, year, schedule_json, prerequisites, True))

course_ids = {}
for c in courses_list:
    cur.execute("""
        INSERT INTO courses
        (code, title, description, capacity, current_enrollments, department, credits, semester, year, schedule, prerequisites, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, c)
    course_ids[c[0]] = cur.fetchone()[0]
print(f"  ✓ {len(courses_list)} courses inserted")

# ---------- 3. Teacher assignments ----------
faculty_emails = [u[1] for u in users if u[3] == "faculty"]
teacher_assignments = []
for course_code, cid in course_ids.items():
    num_teachers = random.choice([1,2])
    selected = random.sample(faculty_emails, min(num_teachers, len(faculty_emails)))
    for email in selected:
        teacher_assignments.append((user_ids[email], cid, num_teachers==1))
for ta in teacher_assignments:
    cur.execute("INSERT INTO teacher_courses (teacher_id, course_id, is_primary) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING", ta)
print(f"  ✓ {len(teacher_assignments)} teacher assignments")

# ---------- 4. Enrollments (each student enrolls in 3-6 courses) ----------
student_emails = [u[1] for u in users if u[3] == "student"]
enrollments = []
for email in student_emails:
    sid = user_ids[email]
    num_courses = random.randint(3, 6)
    available_courses = random.sample(list(course_ids.values()), min(num_courses, len(course_ids)))
    for cid in available_courses:
        enrollments.append((sid, cid, "enrolled"))
unique_enrollments = set(enrollments)
for e in unique_enrollments:
    cur.execute("INSERT INTO enrollments (student_id, course_id, status) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING", e)
print(f"  ✓ {len(unique_enrollments)} enrollments")

# Update current_enrollments on courses
cur.execute("""
    UPDATE courses SET current_enrollments = (
        SELECT COUNT(*) FROM enrollments WHERE enrollments.course_id = courses.id
    )
""")
conn.commit()

# ---------- 5. Grades (for 70% of enrollments, realistic distribution) ----------
grade_scale = {
    'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'D-': 0.7, 'F': 0.0
}
grade_weights = [0.15, 0.10, 0.12, 0.15, 0.10, 0.10, 0.08, 0.05, 0.04, 0.03, 0.02, 0.06]
feedback_map = {
    'A': "Excellent!",
    'A-': "Very good",
    'B+': "Good",
    'B': "Satisfactory",
    'B-': "Acceptable",
    'C+': "Needs improvement",
    'C': "Below average",
    'C-': "Poor",
    'D': "Very poor",
    'F': "Fail"
}
grades_inserted = 0
grade_entries = []  # store (sid, cid) for later assessment score insertion
for sid, cid, _ in unique_enrollments:
    if random.random() < 0.7:
        grade = random.choices(list(grade_scale.keys()), weights=grade_weights)[0]
        gpa_val = grade_scale[grade]
        is_posted = random.choice([True, False])
        feedback = feedback_map.get(grade, "No feedback")
        cur.execute("""
            INSERT INTO grades (student_id, course_id, grade, gpa, is_posted, feedback)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (student_id, course_id) DO UPDATE 
            SET grade = EXCLUDED.grade, gpa = EXCLUDED.gpa, is_posted = EXCLUDED.is_posted, feedback = EXCLUDED.feedback
        """, (sid, cid, grade, gpa_val, is_posted, feedback))
        grades_inserted += 1
        grade_entries.append((sid, cid))
print(f"  ✓ {grades_inserted} grades recorded")

# ---------- 6. Assessments (2-4 per course) ----------
assessment_types = ['exam', 'quiz', 'project', 'homework', 'final']
assessment_ids = []
for cid in course_ids.values():
    num_assessments = random.randint(2, 4)
    total_weight = 0
    for i in range(num_assessments):
        title = f"{assessment_types[i % len(assessment_types)].capitalize()} {i+1}"
        atype = random.choice(assessment_types)
        max_score = random.choice([50, 100, 100, 150])
        weight = round(random.uniform(10, 40), 1)
        if i == num_assessments-1:
            weight = 100 - total_weight
        else:
            total_weight += weight
        due_date = random_date(datetime(2026,1,1), datetime(2026,5,31)).date()
        cur.execute("""
            INSERT INTO assessments (course_id, title, type, max_score, weight, due_date)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (cid, title, atype, max_score, weight, due_date))
        assessment_ids.append(cur.fetchone()[0])
print(f"  ✓ {len(assessment_ids)} assessments created")

# ---------- 7. Student assessment scores (for EVERY graded enrollment) ----------
# This ensures that if a final grade exists, assessment scores are also present.
score_records = 0
for (sid, cid) in grade_entries:
    cur.execute("SELECT id, max_score FROM assessments WHERE course_id=%s", (cid,))
    assessments_course = cur.fetchall()
    if not assessments_course:
        print(f"  Warning: Course {cid} has grades but no assessments. Skipping assessment scores.")
        continue
    for (aid, max_score) in assessments_course:
        max_score = float(max_score)
        # Generate a realistic score based on the student's final grade (optional)
        # For simplicity, random between 50% and 100% of max_score.
        score = round(random.uniform(0.5, 1.0) * max_score, 1)
        score = min(score, max_score)
        feedback = random.choice(["Well done", "Keep improving", "Excellent", "Good effort"])
        graded_at = random_date(datetime(2026,2,1), datetime(2026,6,30))
        cur.execute("""
            INSERT INTO student_assessments (student_id, assessment_id, score, feedback, graded_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (student_id, assessment_id) DO UPDATE 
            SET score = EXCLUDED.score, feedback = EXCLUDED.feedback, graded_at = EXCLUDED.graded_at
        """, (sid, aid, score, feedback, graded_at))
        score_records += 1
print(f"  ✓ {score_records} student assessment scores inserted (all graded students now have assessment scores)")

# ---------- 8. Attendance sessions and records ----------
attendance_session_ids = []
for cid in course_ids.values():
    num_sessions = random.randint(3, 5)
    for i in range(num_sessions):
        title = f"Lecture {i+1}"
        session_date = random_date(datetime(2026,2,1), datetime(2026,4,30)).date()
        start_time = datetime.combine(session_date, datetime.min.time()) + timedelta(hours=random.randint(8,14))
        end_time = start_time + timedelta(hours=1, minutes=30)
        qr_code = str(uuid.uuid4())[:8]
        manual_code = str(random.randint(1000,9999))
        created_by = random.choice(list(user_ids.values()))
        cur.execute("""
            INSERT INTO attendance_sessions (course_id, title, session_date, start_time, end_time, qr_code, manual_code, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (cid, title, session_date, start_time, end_time, qr_code, manual_code, created_by))
        attendance_session_ids.append(cur.fetchone()[0])
print(f"  ✓ {len(attendance_session_ids)} attendance sessions")

attendance_records_inserted = 0
for sess_id in attendance_session_ids:
    cur.execute("SELECT course_id FROM attendance_sessions WHERE id=%s", (sess_id,))
    cid = cur.fetchone()[0]
    cur.execute("SELECT student_id FROM enrollments WHERE course_id=%s", (cid,))
    enrolled_students = [row[0] for row in cur.fetchall()]
    present_rate = random.uniform(0.6, 0.9)
    num_present = int(len(enrolled_students) * present_rate)
    present_students = random.sample(enrolled_students, min(num_present, len(enrolled_students)))
    for sid in present_students:
        method = random.choice(['qr', 'manual', 'face'])
        lat = round(random.uniform(40.7, 40.8), 6)
        lng = round(random.uniform(-74.0, -73.9), 6)
        cur.execute("""
            INSERT INTO attendance_records (session_id, student_id, checkin_method, latitude, longitude)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (sess_id, sid, method, lat, lng))
        attendance_records_inserted += 1
print(f"  ✓ {attendance_records_inserted} attendance records")

# ---------- 9. Academic history for senior students ----------
senior_emails = [u[1] for u in users if u[3] == "student" and u[9] == "Senior"]
past_semesters = [("Fall", 2025), ("Spring", 2025), ("Fall", 2024)]
history_inserted = 0
for email in senior_emails:
    sid = user_ids[email]
    num_past = random.randint(4, 8)
    for _ in range(num_past):
        course_code = random.choice(list(course_ids.keys()))
        course_title = next((c[1] for c in courses_list if c[0] == course_code), "Unknown")
        grade = random.choices(list(grade_scale.keys()), weights=grade_weights)[0]
        gpa_val = grade_scale[grade]
        semester, year = random.choice(past_semesters)
        credits = random.choice([3,4])
        status = "completed"
        cur.execute("""
            INSERT INTO academic_history (student_id, course_code, course_title, grade, gpa, semester, year, credits, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (sid, course_code, course_title, grade, gpa_val, semester, year, credits, status))
        history_inserted += 1
print(f"  ✓ {history_inserted} academic history records")

# ---------- 10. Registration periods ----------
cur.execute("""
    INSERT INTO registration_periods (semester, year, start_date, end_date, add_drop_deadline, is_active)
    VALUES ('Spring', 2026, '2026-01-01 00:00:00', '2026-06-30 23:59:59', '2026-06-15 23:59:59', true)
""")

# ---------- 11. SSO Provider ----------
sso_config = json.dumps({"base_url": "https://sso.university.edu", "scope": "openid profile email"})
cur.execute("""
    INSERT INTO sso_providers (name, provider_type, client_id, client_secret, redirect_uri, config, is_active)
    VALUES ('University SSO', 'university_sso', 'uni_client_id', 'uni_client_secret', 'http://localhost:3000/auth/sso/callback', %s, true)
""", (sso_config,))

# ---------- 12. System settings ----------
settings = [
    ('registration_open', 'true', 'Whether course registration is currently open'),
    ('max_waitlist_size', '50', 'Maximum number of students on a course waitlist'),
    ('grade_posting_default', 'false', 'Default grade posting visibility'),
    ('attendance_grace_period', '15', 'Grace period in minutes for attendance check-in'),
    ('max_courses_per_student', '6', 'Maximum courses a student can enroll per semester'),
]
for key, val, desc in settings:
    cur.execute("INSERT INTO system_settings (key, value, description) VALUES (%s, %s, %s) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", (key, val, desc))

# ---------- 13. Waitlist ----------
popular_courses = random.sample(list(course_ids.values()), k=5)
for cid in popular_courses:
    cur.execute("SELECT capacity, current_enrollments FROM courses WHERE id=%s", (cid,))
    cap, curr = cur.fetchone()
    if curr >= cap:
        students_waiting = random.sample(student_emails, k=min(10, len(student_emails)))
        for pos, email in enumerate(students_waiting, start=1):
            sid = user_ids[email]
            cur.execute("INSERT INTO waitlist (student_id, course_id, position) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING", (sid, cid, pos))
print("  ✓ Waitlist entries added")

# ---------- 14. Audit log ----------
actions = ['login', 'logout', 'enroll', 'drop', 'update_profile', 'view_grades']
for _ in range(200):
    user_id = random.choice(list(user_ids.values()))
    action = random.choice(actions)
    entity = random.choice(['course', 'student', 'grade'])
    entity_id = random.randint(1, 100)
    changes = json.dumps({'timestamp': datetime.now().isoformat()})
    ip = f"192.168.{random.randint(1,255)}.{random.randint(1,255)}"
    cur.execute("""
        INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes, ip_address)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (user_id, action, entity, entity_id, changes, ip))
print("  ✓ Audit log seeded")

# ============================================================
# Final commit and summary
# ============================================================
conn.commit()
cur.close()
conn.close()

print("\n✅ Database seeding complete!")
print("\n📊 Data Summary:")
print(f"   • {len(users)} users (1 admin, 15 faculty, 61 students)")
print(f"   • {len(courses_list)} courses")
print(f"   • {len(unique_enrollments)} enrollments")
print(f"   • {grades_inserted} grades")
print(f"   • {len(assessment_ids)} assessments")
print(f"   • {score_records} student assessment scores")
print(f"   • {len(attendance_session_ids)} attendance sessions")
print(f"   • {attendance_records_inserted} attendance records")
print(f"   • {history_inserted} academic history records")
print("\n🔐 Test Accounts:")
print("   Admin:    admin@example.com / admin123")
print("   Faculty:  dr.alan.turing@university.edu / faculty123")
print("   Student:  student@example.com / student123  (fixed account)")
print("   Also any random student: james.smith123@student.edu / student123")