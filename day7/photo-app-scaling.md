# SnapShare: System Architecture & Scaling Plan

A comprehensive capacity estimation, architectural specification, and scaling strategy for "SnapShare", a high-throughput photo-sharing platform.

---

## 1. System Assumptions & Baseline Metrics

* **Registered User Base:** 10,000,000 (10 Million users)
* **Daily Active Percentage:** 10%
* **Daily Active Users (DAU):** 
  $$10,000,000 \times 0.10 = 1,000,000 \text{ active users/day}$$
* **User Activity Assumptions:**
  * Photo uploads: 1 photo per active user/day
  * Feed views: 50 feed views per active user/day
* **Asset Storage Metrics:**
  * Average original photo size: 2 MB
  * Average generated thumbnail size: 50 KB ($0.05\text{ MB}$)
  * Total storage footprint per upload: $2.05\text{ MB}$
* **Time Conversion:** 1 day = 86,400 seconds
* **Traffic Peak Factor:** $5\times$ average load

---

## 2. Traffic & Storage Estimations

### A. Uploads per Second (Writes)
* **Daily Upload Volume:**
  $$1,000,000 \text{ DAU} \times 1 \text{ upload} = 1,000,000 \text{ uploads/day}$$
* **Average Uploads per Second:**
  $$\frac{1,000,000 \text{ uploads}}{86,400 \text{ seconds}} \approx 11.57 \text{ uploads/sec} \approx 12 \text{ uploads/sec}$$
* **Peak Uploads per Second ($5\times$ multiplier):**
  $$11.57 \times 5 \approx 57.87 \text{ uploads/sec} \approx 58 \text{ uploads/sec}$$

---

### B. Feed Views per Second (Reads)
* **Daily Feed Views:**
  $$1,000,000 \text{ DAU} \times 50 \text{ views} = 50,000,000 \text{ views/day}$$
* **Average Feed Views per Second:**
  $$\frac{50,000,000 \text{ views}}{86,400 \text{ seconds}} \approx 578.7 \text{ views/sec} \approx 579 \text{ views/sec}$$
* **Peak Feed Views per Second ($5\times$ multiplier):**
  $$578.7 \times 5 \approx 2,893.5 \text{ views/sec} \approx 2,894 \text{ views/sec}$$

---

### C. Annual Storage Footprint
* **Daily Storage Ingestion:**
  * Original photos: $1,000,000 \times 2\text{ MB} = 2,000,000\text{ MB} = 2\text{ TB/day}$
  * Thumbnails: $1,000,000 \times 0.05\text{ MB} = 50,000\text{ MB} = 0.05\text{ TB/day}$
  * Combined daily ingestion: $2.05\text{ TB/day}$
* **Total Storage per Year:**
  $$2.05\text{ TB/day} \times 365\text{ days} = 748.25\text{ TB/year}$$

---

## 3. Read-Heavy vs. Write-Heavy Profile

SnapShare is **overwhelmingly read-heavy**, operating at a **50:1 read-to-write ratio** (50,000,000 feed requests versus 1,000,000 photo uploads daily).

### Architectural Design Implications:
1. **Aggressive In-Memory Caching:** Feed lookups cannot execute multi-table relational joins on every request under peak read loads of 2,894 requests/sec; user feeds and active profile sessions must be pre-computed and stored in an in-memory cache (Redis).
2. **Dedicated Read Replicas:** Read queries must be routed to read-only database replicas so high-frequency user feed scrolling never blocks the primary write database.
3. **Edge Caching for Static Media:** Heavy image payloads must be served through a Content Delivery Network (CDN) so image download bandwidth bypasses application servers entirely.

---

## 4. Storage Architecture: Why Databases Must Not Store Photos

Photos should **never** be stored as raw binary data (BLOBs) directly inside relational or document databases.

### Problems with Storing Binary Files in the Database:
* **Database Buffer Thrashing:** Relational database caches (like the InnoDB buffer pool) are optimized for indexed tabular rows; dumping 2 MB binary files into table records flushes indexes out of RAM, devastating query throughput.
* **Backup & Replication Overhead:** Database snapshots, replication lag, and point-in-time restores become unmanageable when the database size balloons by over 2 TB every day.
* **High Infrastructure Costs:** Transactional, high-IOPS disk storage is vastly more expensive than distributed object storage.

### The Solution: Cloud Object Storage
Photo files and thumbnails reside in dedicated **Object Storage** (e.g., AWS S3, Cloudflare R2). The relational database stores only structured metadata:
* `photo_id` (Primary Key)
* `user_id` (Foreign Key referencing the uploader)
* `image_url` (Direct string link to the original 2 MB file in Object Storage)
* `thumbnail_url` (Direct string link to the 50 KB file in Object Storage)
* `created_at` (Timestamp for feed sorting)

---

## 5. System Architecture Diagram

```text
                        +---------------------------+
                        |  Clients (Mobile / Web)   |
                        +---------------------------+
                           /                     \
       (1) Asset Downloads & Feed Reads           (2) API & Upload Requests
                         /                         \
                        v                           v
              +-------------------+       +-------------------+
              |  Content Delivery |       |   Load Balancer   |
              |   Network (CDN)   |       |   (Nginx / ALB)   |
              +-------------------+       +-------------------+
                        |                           |
                        | (Cache Miss)              v
                        |                 +-------------------+
                        |                 |    App Servers    |
                        |                 | (Stateless Nodes) |
                        |                 +-------------------+
                        |                    /     |     \
                        |       +-----------+      |      +------------+
                        |       |                  |                   |
                        v       v                  v                   v
                +---------------+        +-------------------+   +---------------+
                | Object Storage|        |  In-Memory Cache  |   | Message Queue |
                | (AWS S3 / R2) |        |  (Redis Cluster)  |   | (RabbitMQ/SQS)|
                +---------------+        +-------------------+   +---------------+
                       ^                                                 |
                       |                                                 v
                       | (Save 50KB Thumbnail)                   +---------------+
                       +-----------------------------------------| Worker Server |
                                                                 | (Image Resize)|
                                                                 +---------------+
                                         |
                     +-------------------+-------------------+
                     |                                       |
               (Writes Only)                           (Reads Only)
                     v                                       v
          +----------------------+               +----------------------+
          |   Primary Database   |---(Replication)->| Read Replica DB   |
          | (PostgreSQL / MySQL) |               | (Read-Only Cluster)  |
          +----------------------+               +----------------------+
```

---

## 6. One-Sentence Component Definitions

1. **Content Delivery Network (CDN):** Serves cached photos and thumbnails from globally distributed edge servers to minimize latency and offload bandwidth from origin infrastructure.
2. **Load Balancer:** Distributes incoming user traffic evenly across multiple stateless application servers to eliminate single points of failure and prevent server hotspots.
3. **Application Servers:** Executes the core business logic, user authentication, payload validation, and database orchestration across stateless, horizontally scalable compute instances.
4. **In-Memory Cache (Redis):** Stores pre-computed user feed timelines and session tokens in fast RAM to serve high-frequency read requests in sub-millisecond timeframes.
5. **Primary Database:** Handles all transactional write operations (creating users, inserting photo metadata, recording follows) with strict ACID consistency.
6. **Database Read Replica:** Handles read-only queries from the application tier to ensure heavy timeline fetching does not contend with write locks on the primary database.
7. **Object Storage:** Stores unstructured binary photo files and generated thumbnails cost-effectively with 99.999999999% durability and virtually unlimited horizontal scale.
8. **Message Queue:** Buffers asynchronous thumbnail generation tasks to decouple image uploads from background processing and absorb traffic spikes.
9. **Thumbnail Worker:** Consumes thumbnail generation jobs from the message queue, resizes the 2 MB raw photo into a 50 KB thumbnail, uploads it to object storage, and updates the database record.

---

## 7. Step-by-Step Photo Upload Flow

1. **Upload Request:** The client sends a multipart `POST /api/photos` request containing the 2 MB image file and authentication headers to the Load Balancer.
2. **Load Balancing:** The Load Balancer forwards the request to an available, healthy Application Server instance.
3. **Authentication & Validation:** The Application Server verifies the user's session token and validates that the uploaded file matches an accepted image format and is within the size limit.
4. **Object Storage Upload:** The Application Server streams the 2 MB image directly to Object Storage and receives a persistent file URL (e.g., `s3://snapshare-media/originals/photo-101.jpg`).
5. **Metadata Insertion:** The Application Server inserts a new row into the Primary Database with `user_id`, `image_url`, `status = 'processing'`, and `created_at`.
6. **Job Dispatch:** The Application Server pushes an event payload `{ "photo_id": 101, "storage_key": "originals/photo-101.jpg" }` into the Message Queue.
7. **Client Response:** The Application Server responds to the client with `201 Created` and the initial photo metadata, unblocking the user interface in under 100 ms.
8. **Asynchronous Thumbnail Processing:** An idle Thumbnail Worker picks up the message from the queue, pulls the 2 MB image from Object Storage, generates the 50 KB thumbnail, uploads the thumbnail to Object Storage (`thumbnails/thumb-101.jpg`), and updates the database row with the `thumbnail_url` and `status = 'ready'`.

---

## 8. Architectural Trade-offs

### Trade-off 1: Asynchronous vs. Synchronous Thumbnail Generation
* **Decision:** We chose **asynchronous background processing via a message queue** instead of resizing thumbnails synchronously during the user's upload request.
* **Pros:** Keeps upload latency under 100 ms, protects application servers from CPU exhaustion caused by image processing, and guarantees jobs are not lost if a server restarts.
* **Cons (Eventual Consistency):** For 1 to 2 seconds after upload, the thumbnail does not exist yet; the client application must temporarily display a placeholder or local cached preview until the worker finishes processing.

---

### Trade-off 2: Hybrid Feed Fan-Out (Push vs. Pull)
* **Decision:** We chose a **hybrid fan-out model**: Fan-Out-on-Write (pushing new post IDs into followers' Redis feed caches) for standard users, and Fan-Out-on-Read (pulling posts at read time) for celebrity accounts with over 20,000 followers.
* **Pros:** Delivers sub-millisecond feed load times for 99% of users because their timeline is already pre-assembled in Redis memory.
* **Cons:** Introduces architectural complexity by requiring separate code paths and thresholds to handle standard users differently from high-follower accounts.