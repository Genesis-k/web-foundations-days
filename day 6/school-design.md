# School Database System Design

A relational database design for managing academic enrollments, student profiles, and course catalogs.

---

## 1. Table Explanations

* **`students`**: Stores identity and profile data for registered learners. Each record represents an individual student identified uniquely by `student_id`, alongside required attributes (`name`) and a strictly unique identifier (`email`).
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

## 3. Recommended Index & Rationale

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);
```

### Rationale for Indexing `course_id`:
1. **Foreign Keys Lack Automatic Indexes**: In relational database management systems (including SQLite, PostgreSQL, and MySQL), defining a column as a `FOREIGN KEY` does **not** automatically create an underlying B-tree index for it. Only the table's `PRIMARY KEY` (`enrolment_id`) receives an automatic index.
2. **Preventing Full Table Scans on Reverse Lookups**: The junction table will naturally be queried in two directions: looking up a student's courses and looking up a course's enrolled students. Without an index on `course_id`, any query that filters by course (e.g., retrieving all students enrolled in "Introduction to Computer Science") or joins `courses` to `enrolments` must perform an expensive, sequential full table scan across every single record in the `enrolments` table.
3. **Optimizing Grouping and Aggregation**: Analytical queries like calculating class sizes (`COUNT(student_id) ... GROUP BY course_id`) or computing course grade distributions require scanning `enrolments` by course. Adding this index reduces the search and join complexity from linear $O(N)$ time to logarithmic $O(\log N)$ time, preventing database bottlenecks as enrollment numbers scale into tens of thousands of rows.

---

## 4. Architectural Choice: SQL vs. NoSQL

For an academic management system, **SQL (Relational Database)** is distinctly the superior architecture over NoSQL. Academic records demand strict referential integrity, strong schema enforcement, and ACID transaction guarantees: operations such as registering for classes, capping class enrollments, and recording final grades cannot tolerate eventual consistency, orphaned records, or silent data duplication. If course titles, student names, or unit codes update, relational normalization guarantees that the change is reflected across all queries instantly without risk of stale data. 

In contrast, a document-oriented NoSQL database (such as MongoDB) would force an awkward modeling decision: either embedding arrays of course subdocuments inside student documents (which causes massive data duplication across students and risks hitting document size limits) or referencing IDs across collections (which requires multiple round-trip application-level joins that lack database-enforced foreign key constraints). Relational SQL engines provide foreign key cascades, unique constraints, and declarative multi-table joins natively at the engine level, making SQL the reliable, maintainable choice for institutional data.