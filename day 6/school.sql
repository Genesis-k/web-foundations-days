-- Enable foreign key constraint enforcement in SQLite
PRAGMA foreign_keys = ON;

-- 1. TABLE DEFINITIONS
-- Students table
CREATE TABLE students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- Courses table
CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL
);

-- Enrolments table (Junction table linking students and courses)
CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    UNIQUE (student_id, course_id) -- Prevents duplicate enrolments for the same course
);

-- 2. SAMPLE DATA INSERTIONS

-- Insert 4 students (David Kimani is intentionally left without enrolments for testing)
INSERT INTO students (name, email) VALUES
('Alice Wambui', 'alice.wambui@example.com'),
('Brian Otieno', 'brian.otieno@example.com'),
('Clara Chebet', 'clara.chebet@example.com'),
('David Kimani', 'david.kimani@example.com');

-- Insert 3 courses
INSERT INTO courses (code, title) VALUES
('CS101', 'Introduction to Computer Science'),
('DB201', 'Database Systems'),
('WEB301', 'Web Application Development');

-- Insert 5 enrolments
INSERT INTO enrolments (student_id, course_id, grade) VALUES
(1, 1, 'A'),   -- Alice in CS101
(1, 2, 'B+'),  -- Alice in DB201
(2, 1, 'B'),   -- Brian in CS101
(2, 3, 'A-'),  -- Brian in WEB301
(3, 2, 'A');   -- Clara in DB201

-- 3. QUERIES

-- Query 1: All courses for one student (searched by name)
SELECT 
    s.name AS student_name,
    c.code AS course_code,
    c.title AS course_title,
    e.grade
FROM students s
JOIN enrolments e ON s.student_id = e.student_id
JOIN courses c ON e.course_id = c.course_id
WHERE s.name = 'Alice Wambui';

-- Query 2: All students on one course (searched by course title)
SELECT 
    c.title AS course_title,
    s.name AS student_name,
    s.email AS student_email,
    e.grade
FROM courses c
JOIN enrolments e ON c.course_id = e.course_id
JOIN students s ON e.student_id = s.student_id
WHERE c.title = 'Introduction to Computer Science';

-- Query 3: The number of students per course
SELECT 
    c.code AS course_code,
    c.title AS course_title,
    COUNT(e.student_id) AS total_enrolled
FROM courses c
LEFT JOIN enrolments e ON c.course_id = e.course_id
GROUP BY c.course_id, c.code, c.title;

-- Query 4: Students who have no enrolments
SELECT 
    s.student_id,
    s.name,
    s.email
FROM students s
LEFT JOIN enrolments e ON s.student_id = e.student_id
WHERE e.enrolment_id IS NULL;

-- Query 5: Update one enrolment's grade
UPDATE enrolments
SET grade = 'A+'
WHERE student_id = (SELECT student_id FROM students WHERE email = 'alice.wambui@example.com')
  AND course_id = (SELECT course_id FROM courses WHERE code = 'DB201');

-- Verification for Query 5: Confirm updated grade
SELECT 
    s.name, 
    c.code, 
    e.grade 
FROM enrolments e
JOIN students s ON e.student_id = s.student_id
JOIN courses c ON e.course_id = c.course_id
WHERE s.email = 'alice.wambui@example.com' AND c.code = 'DB201';