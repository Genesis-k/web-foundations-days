# School Database System Design

A relational database design for managing academic enrollments, student profiles, and course catalogs.

---

## 1. Table Explanations

* **`students`**: Stores core identity information for registered learners. Each record represents an individual student identified uniquely by `student_id`, alongside required attributes (`name`) and a strictly unique identifier (`email`).
* **`courses`**: Holds catalog listings of academic units offered by the institution. Each row contains an auto-incrementing `course_id`, an institutional alphanumeric unit identifier (`code`), and the descriptive `title`.
* **`enrolments`**: Acts as the junction table bridging learners and courses. It stores contextual transaction attributes that only exist when a student takes a class—specifically the earned `grade`—while linking to the primary keys of both parent entities.

---

## 2. Entity Relationships & Join Table Mechanics

### Relationship Cardinality
* **One-to-Many (`1:N`) Relationships**: 
  * `students` to `enrolments`: One student can possess zero, one, or many enrolment entries.
  * `courses` to `enrolments`: One course can have zero, one, or many enrolled students.
* **Many-to-Many (`M:N`) Relationship**: 
  * `students` to `courses`: A student may register for multiple courses across a semester, and a single course is concurrently attended by multiple students.

### Why a Join Table is Required
Relational databases cannot cleanly model an arbitrary many-to-many relationship directly inside flat columns without violating First Normal Form (1NF). Placing a list or array of course IDs inside a single `students` column prevents indexing, breaks atomic value constraints, and complicates join queries. Conversely, duplicating student details for every enrolled course causes severe data redundancy and update anomalies. 

The `enrolments` join table decomposes the `M:N` relationship into two manageable `1:N` relationships, providing a single source of truth and enabling composite uniqueness checks via `UNIQUE(student_id, course_id)`.

---

## 3. Recommended Index

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);