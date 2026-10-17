# Library Books REST API Design

A standard RESTful web API specification for managing a library's `books` resource.

---

## Resource Endpoints

### 1. List All Books
* **Method:** `GET`
* **Path:** `/api/books`
* **Description:** Retrieves an array of all books cataloged in the library.
* **Success Status Code:** `200 OK`

---

### 2. Get a Single Book
* **Method:** `GET`
* **Path:** `/api/books/:id`
* **Description:** Retrieves complete record details for a specific book by its unique ID.
* **Success Status Code:** `200 OK`

---

### 3. Create a Book
* **Method:** `POST`
* **Path:** `/api/books`
* **Description:** Adds a new book to the library catalog.
* **Success Status Code:** `201 Created`
* **Example Request Body:**
```json
{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "978-0132350884",
  "publishedYear": 2008,
  "copiesAvailable": 4
}