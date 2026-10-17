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
```

---

### 4. Update a Book
* **Method:** `PUT`
* **Path:** `/api/books/:id`
* **Description:** Replaces all details of an existing book record by its ID.
* **Success Status Code:** `200 OK`
* **Example Request Body:**
```json
{
  "title": "Clean Code: A Handbook of Agile Software Craftsmanship",
  "author": "Robert C. Martin",
  "isbn": "978-0132350884",
  "publishedYear": 2008,
  "copiesAvailable": 3
}
```

---

### 5. Delete a Book
* **Method:** `DELETE`
* **Path:** `/api/books/:id`
* **Description:** Permanently removes a book entry from the catalog by its ID.
* **Success Status Code:** `204 No Content`

---

### 6. List Books by Author
* **Method:** `GET`
* **Path:** `/api/books?author={authorName}`
* **Description:** Filters and returns all books written by a specific author using a URL query parameter.
* **Success Status Code:** `200 OK`

---

## Standard Error Responses

### `400 Bad Request`
* **When it occurs:** The client sends an invalid, malformed, or incomplete request payload that violates data validation rules.
* **Example Scenario:** A client sends a `POST /api/books` or `PUT /api/books/12` request omitting the mandatory `title` attribute or passing a negative integer for `copiesAvailable`:
```json
{
  "error": "Bad Request",
  "status": 400,
  "message": "Field 'title' is required and 'copiesAvailable' must be a positive integer."
}
```

### `404 Not Found`
* **When it occurs:** The client requests a URL path or specific resource ID that does not exist in the database.
* **Example Scenario:** A client sends a `GET`, `PUT`, or `DELETE` request for `/api/books/999` when ID `999` has been deleted or was never created:
```json
{
  "error": "Not Found",
  "status": 404,
  "message": "Book with ID 999 does not exist."
}
```