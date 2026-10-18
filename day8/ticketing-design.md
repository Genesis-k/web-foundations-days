# TicketHub: System Architecture & Flash-Sale Design

A comprehensive system architecture and capacity design for "TicketHub", an online ticketing platform engineered to handle both standard daily traffic and high-demand concert ticket sales without double-booking or service degradation.

---

## 1. System Requirements

### Functional Requirements
* **Browse Events**: Users can search and view upcoming concerts, venues, dates, and pricing tiers.
* **Interactive Seat Map**: Users can view real-time seat availability (available, held, booked) for an event.
* **Temporary Seat Hold**: Users can select a seat and hold it exclusively for 10 minutes while completing checkout.
* **Payment & Order Fulfillment**: Users can pay for held seats; upon successful payment, digital tickets with verifiable QR codes are issued.
* **Ticket Management**: Users can view their purchased tickets and order histories under their profile.

### Non-Functional Requirements
* **Strict Correctness (Zero Overbooking)**: Under no circumstances may two users purchase or hold the same physical seat (ACID consistency).
* **Fairness**: High-demand sales must enforce first-come, first-served (FIFO) queue ordering via a virtual waiting room to prevent bot abuse and starvation.
* **High Availability & Fault Tolerance**: 99.99% availability; third-party payment gateway failures must not corrupt ticket inventory state.
* **Low Latency**: Seat map reads must load in under 100 ms; seat-holding requests must resolve in under 200 ms.

---

## 2. Capacity Estimates: Normal Traffic vs. "Big Sale"

### A. Baseline Metrics
* **Registered Users**: 2,000,000
* **Normal Day Visitors**: 50,000 users/day
* **Normal Day Page Views**: $50,000 \times 10 = 500,000\text{ views/day}$
* **Normal Day Purchases**: 5,000 tickets sold/day
* **Flash Sale Scenario**: 200,000 users competing for 20,000 seats within the first 10 minutes (600 seconds).

---

### B. Traffic Estimations

#### Normal Day Traffic ($1\text{ day} \approx 86,400\text{ seconds}$)
* **Read Throughput (Page Views)**:
  $$\frac{500,000 \text{ views}}{86,400 \text{ s}} \approx 5.8 \text{ reads/second}$$
* **Write Throughput (Purchases)**:
  $$\frac{5,000 \text{ purchases}}{86,400 \text{ s}} \approx 0.058 \text{ writes/second}$$

#### "Big Sale" Flash Traffic ($10\text{ minutes} = 600\text{ seconds}$)
* **Write Throughput (Hold & Purchase Attempts)**:
  * 200,000 users attempting to hold seats within 600 seconds:
    $$\frac{200,000 \text{ attempts}}{600 \text{ s}} \approx 333.3 \text{ write attempts/second}$$
  * Peak spike factor ($3\times$ during minute one): $\approx 1,000\text{ write attempts/second}$.
* **Read Throughput (Seat Map Polling & Queue Inquiries)**:
  * 200,000 active users refreshing seat availability or polling every 3 seconds:
    $$\frac{200,000 \text{ active users}}{3 \text{ s polling interval}} \approx 66,667 \text{ reads/second}$$

#### Traffic Comparison
| Metric | Normal Day | Big Sale (Peak) | Surge Factor |
| :--- | :--- | :--- | :--- |
| **Active Users** | 50,000 / day | 200,000 / 10 min | ~57× concurrent density |
| **Read RPS** | 5.8 reads/sec | 66,667 reads/sec | ~11,500× increase |
| **Write RPS** | 0.06 writes/sec | 1,000 writes/sec | ~16,600× increase |
| **Inventory Scarcity** | Ample supply | 10 buyers per seat (90% unserved) | Extreme contention |

---

## 3. REST API Design

### 1. List Events
* **Method**: `GET`
* **Path**: `/api/v1/events`
* **Description**: Returns a paginated list of upcoming events with venue details and date filters.
* **Success Status**: `200 OK`

---

### 2. Get Event Seat Map
* **Method**: `GET`
* **Path**: `/api/v1/events/:id/seats`
* **Description**: Returns all seat statuses (`available`, `held`, `booked`) for a given event venue.
* **Success Status**: `200 OK`

---

### 3. Hold Seat(s)
* **Method**: `POST`
* **Path**: `/api/v1/seats/hold`
* **Description**: Places a temporary 10-minute hold on one or more available seats for the authenticated user.
* **Success Status**: `201 Created`
* **Request Body**:
```json
{
  "eventId": 501,
  "seatIds": [1204, 1205]
}
```
* **Response Body**:
```json
{
  "holdId": "hld_98a7c2d1",
  "seatIds": [1204, 1205],
  "expiresAt": "2026-10-18T18:40:00Z",
  "status": "HELD"
}
```

---

### 4. Create Order & Checkout
* **Method**: `POST`
* **Path**: `/api/v1/orders/checkout`
* **Description**: Validates active hold token, processes payment intent, and confirms permanent seat booking.
* **Success Status**: `200 OK`
* **Request Body**:
```json
{
  "holdId": "hld_98a7c2d1",
  "paymentMethodId": "pm_card_visa_4242"
}
```
* **Response Body**:
```json
{
  "orderId": "ord_77192",
  "totalAmount": 150.00,
  "currency": "USD",
  "status": "CONFIRMED",
  "ticketIds": [9901, 9902]
}
```

---

### 5. View User Tickets
* **Method**: `GET`
* **Path**: `/api/v1/users/me/tickets`
* **Description**: Retrieves all confirmed tickets, venue admission codes, and QR payloads for the current user.
* **Success Status**: `200 OK`

---

## 4. Relational Data Model

```
+--------------------+           +--------------------+
|       users        |           |       events       |
+--------------------+           +--------------------+
| user_id (PK)       |           | event_id (PK)      |
| name               |           | title              |
| email (UNIQUE)     |           | venue              |
| created_at         |           | event_date         |
+--------------------+           +--------------------+
          |                                |
          | 1:N                            | 1:N
          v                                v
+--------------------+           +--------------------+
|       orders       |           |       seats        |
+--------------------+           +--------------------+
| order_id (PK)      |           | seat_id (PK)       |
| user_id (FK)       |           | event_id (FK)      |
| total_amount       |           | section, row, num  |
| status             |           | status (Enum)      |
| created_at         |           | held_by_user (FK)  |
+--------------------+           | hold_expires_at    |
          |                      | version (Locking)  |
          | 1:N                  +--------------------+
          v                                |
+--------------------+                     |
|      tickets       |<--------------------+
+--------------------+ (1:1 per booked seat)
| ticket_id (PK)     |
| order_id (FK)      |
| seat_id (FK, UNIQUE|
| qr_code_hash       |
+--------------------+
```

### Table Definitions (DDL)

```sql
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    venue VARCHAR(150) NOT NULL,
    event_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seats (
    seat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    section VARCHAR(20) NOT NULL,
    row_num VARCHAR(10) NOT NULL,
    seat_num INTEGER NOT NULL,
    status TEXT CHECK(status IN ('AVAILABLE', 'HELD', 'BOOKED')) DEFAULT 'AVAILABLE',
    held_by_user INTEGER,
    hold_expires_at TIMESTAMP,
    version INTEGER DEFAULT 0,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (held_by_user) REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE (event_id, section, row_num, seat_num)
);

CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status TEXT CHECK(status IN ('PENDING', 'PAID', 'CANCELLED')) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE tickets (
    ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL UNIQUE,
    qr_code_hash VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (seat_id) REFERENCES seats(seat_id)
);
```

---

## 5. Preventing Double-Booking (Concurrency & Atomicity)

To guarantee that two users clicking on the same seat at the exact same millisecond cannot both claim it, TicketHub uses a **two-phase reservation model**:

```
[Seat: AVAILABLE]
       │
       │ Atomic conditional UPDATE / Redis SETNX
       v
[Seat: HELD (10-minute hold_expires_at)]
       │
       ├──────────────────────────────┐
       │ (Payment Success within TTL) │ (Payment Fails or TTL Expires)
       v                              v
[Seat: BOOKED]                 [Seat: AVAILABLE]
(Final ticket created)         (Hold released)
```

### Implementation Mechanics:
1. **Atomic Conditional Database Update**:
   When holding a seat, the application runs an atomic SQL statement with a strict status check:
   ```sql
   UPDATE seats
   SET status = 'HELD',
       held_by_user = :userId,
       hold_expires_at = DATETIME('now', '+10 minutes'),
       version = version + 1
   WHERE seat_id = :seatId
     AND (status = 'AVAILABLE' OR (status = 'HELD' AND hold_expires_at < DATETIME('now')));
   ```
2. **Database Result Verification**:
   The database engine locks only the single target seat row. If two concurrent transactions execute simultaneously, the database serializes them:
   * **User A's query** executes first: matches `status = 'AVAILABLE'`, updates the row, returns `Rows Affected = 1` (Hold Granted).
   * **User B's query** executes second: the seat status is now `'HELD'` with an unexpired timestamp. Zero rows are updated (`Rows Affected = 0`). The application immediately returns `409 Conflict` ("Seat has just been selected by another user").
3. **Permanent Order Commitment**:
   When processing `/api/v1/orders/checkout`, the transition from `HELD` to `BOOKED` is wrapped in an ACID transaction requiring that `held_by_user == current_user` and `hold_expires_at > NOW()`. A unique database constraint on `tickets(seat_id)` makes it impossible at the storage layer for two tickets to share a seat.

---

## 6. System Architecture

```text
                           +---------------------------+
                           |  200,000 Flash-Sale Users |
                           +---------------------------+
                                         |
                                         v
                           +---------------------------+
                           |   Cloudflare / Edge CDN   |
                           |  (Virtual Waiting Room)   |
                           +---------------------------+
                                         |
                            (Admitted Traffic: 500 RPS)
                                         v
                           +---------------------------+
                           |       Load Balancer       |
                           +---------------------------+
                                         |
                     +-------------------+-------------------+
                     |                                       |
                     v                                       v
          +--------------------+                  +--------------------+
          |    App Server 1    |                  |    App Server 2    |
          |  (Stateless Node)  |                  |  (Stateless Node)  |
          +--------------------+                  +--------------------+
                     |         \                  /         |
                     |          +-------+--------+          |
                     |                  |                   |
                     v                  v                   v
          +--------------------+ +-------------+ +--------------------+
          |    Redis Cache     | | Redis Lock  | |   Message Queue    |
          | (Seat Availability)| | (Hold TTLs) | |     (RabbitMQ)     |
          +--------------------+ +-------------+ +--------------------+
                     |                                      |
                     v                                      v
          +--------------------+                  +--------------------+
          | Read Replica DB    |                  |   Worker Service   |
          | (Seat Map Reads)   |                  | (Release Expired   |
          +--------------------+                  |  Holds & Emails)   |
                     ^                            +--------------------+
                     | (Replication)                        |
          +--------------------+                            |
          |  Primary SQL DB    |<---------------------------+
          | (ACID Bookings)    |
          +--------------------+
```

### Component Breakdown
1. **Edge CDN & Virtual Waiting Room**: Intercepts 200,000 simultaneous connections at the network edge, queuing users in a FIFO tokenized waiting room and admitting only a controlled stream (e.g., 500 users/second) to protect origin servers from collapse.
2. **Load Balancer**: Distributes incoming admitted requests across multiple auto-scaled stateless application servers using least-connections routing.
3. **Stateless App Servers**: Authenticates requests, executes business validation, checks admission tokens, and manages transaction orchestration.
4. **Redis Cache (Seat Map)**: Serves high-frequency seat status reads from memory with sub-millisecond response times, shielding the relational database from 66,000+ polling RPS.
5. **Redis Distributed Lock / TTL Registry**: Stores active hold keys (`hold:seat:{id}`) with an automatic 10-minute expiration timer to ensure rapid lock release.
6. **Primary SQL Database (Writer)**: The single source of truth that enforces foreign keys, row-level locks, and atomic transitions (`AVAILABLE` $\to$ `HELD` $\to$ `BOOKED`).
7. **Read Replica Database**: Offloads non-critical queries (order history, artist biographies, venue policies) from the primary writer.
8. **Message Queue & Background Workers**: Asynchronously coordinates post-order fulfillment (generating ticket PDFs, signing QR codes, sending confirmation emails) and cleans up abandoned holds.

---

## 7. Architectural Trade-offs

### Trade-off 1: Virtual Waiting Room vs. Open Free-for-All
* **Decision**: We place a **virtual queue (waiting room)** in front of high-demand sales rather than allowing all 200,000 users to hit the application servers concurrently.
* **Positive Impact**: Prevents cascading server crashes, eliminates database connection pool starvation, and guarantees a smooth, predictable checkout experience for users who advance to the front of the queue.
* **Negative Impact**: Creates perceived friction for users who must wait in a digital line, requiring client-side polling and token-validation infrastructure.

---

### Trade-off 2: Two-Phase Seat Hold with Expiration vs. Immediate Checkout
* **Decision**: We implement a **temporary 10-minute hold** rather than requiring immediate atomic card payment upon seat selection.
* **Positive Impact**: Prevents customer anxiety and cart abandonment by guaranteeing that once a seat is selected, no one can steal it while the user enters payment details or resolves two-factor authentication (3D Secure).
* **Negative Impact**: Temporarily locks inventory away from other buyers if a user holds a seat and abandons the browser tab, requiring automated background workers to restore expired seats back to `AVAILABLE`.