# SnapShare: System Architecture & Scaling Plan

A comprehensive capacity estimation, architectural specification, and scaling strategy for "SnapShare", a high-throughput photo-sharing social platform.

---

## 1. System Assumptions & Baseline Metrics

* **Total Registered Users:** 10,000,000 (10 Million)
* **Daily Active Ratio:** 10%
* **Daily Active Users (DAU):** 
  $$10,000,000 \times 0.10 = 1,000,000 \text{ active users/day}$$
* **User Actions per Day:**
  * Photos uploaded: 1 photo per active user/day
  * Feed pages viewed: 50 feed views per active user/day
* **Asset Payload Sizes:**
  * Original photo: 2 MB (average)
  * Resized thumbnail: 50 KB ($0.05\text{ MB}$)
  * Total storage footprint per upload: $2.05\text{ MB}$
* **Time Standard:** 1 day = 86,400 seconds
* **Traffic Peak Factor:** $5\times$ average load

---

## 2. Traffic & Storage Estimations

### A. Uploads per Second (Writes)
* **Daily Upload Volume:**
  $$1,000,000 \text{ DAU} \times 1 \text{ photo} = 1,000,000 \text{ uploads/day}$$
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

### C. Annual Storage Growth
* **Daily Storage Ingestion:**
  * Original photos ($2\text{ MB}$): $1,000,000 \times 2\text{ MB} = 2,000,000\text{ MB} = 2\text{ TB/day}$
  * Thumbnails ($50\text{ KB}$): $1,000,000 \times 0.05\text{ MB} = 50,000\text{ MB} = 0.05\text{ TB/day}$
  * Total combined storage/day: $2.05\text{ TB/day}$
* **Annual Storage Requirement:**
  $$2.05\text{ TB/day} \times 365\text{ days} = 748.25\text{ TB/year}$$

---

## 3. Read-Heavy vs. Write-Heavy Profile

SnapShare is **overwhelmingly read-heavy**, with a read-to-write ratio of **50:1** (50 million feed reads versus 1 million photo uploads daily).

### Architectural Implications:
1. **Aggressive Multi-Tier Caching:** Feed generation cannot execute raw database joins on every request without collapsing the database engine under 2,894 peak queries per second; pre-computed feeds and hot user profiles must reside in an in-memory cache (e.g., Redis).
2. **Read Replica Segregation:** Read traffic must be routed entirely away from the primary database node to dedicated read replicas to prevent queries from contending with transactional write locks.
3. **Edge Asset Offloading:** Because binary media downloads account for the vast majority of bandwidth consumption, edge Content Delivery Networks (CDNs) must cache and serve all image assets to keep heavy binary payloads off application servers.

---

## 4. Storage Architecture: Why Databases Must Not Store Photos

Photos must **never** be stored directly inside a relational or document database as raw binary BLOBs (Binary Large Objects). 

### Critical Reasons:
* **Database Bloat & Memory Starvation:** Database buffer pools are optimized to keep indexes and tabular data in RAM. Injecting large 2 MB binary objects into table rows thrashes the database page cache, evicting vital indexes and degrading query throughput.
* **Backup & Replication Overhead:** Database dumps, point-in-time recoveries, and replica synchronization become unmanageable when databases balloon by multiple terabytes each week.
* **Prohibitive Cost:** High-IOPS transactional database storage (e.g., AWS EBS Provisioned IOPS) is substantially more expensive than raw object storage.

### The Solution: Dedicated Object Storage
Photo files and generated thumbnails are placed into **Object Storage** (e.g., Amazon S3, Cloudflare R2, MinIO). The relational database only stores lightweight structured metadata records containing:
* `photo_id` (Primary Key)
* `user_id` (Foreign Key referencing the author)
* `image_url` (String path to the original photo in object storage)
* `thumbnail_url` (String path to the 50 KB thumbnail in object storage)
* `created_at` (Timestamp for chronological sorting)

---

## 5. System Architecture Diagram

```text
                     +---------------------------+
                     |  Clients (Mobile / Web)   |
                     +---------------------------+
                         /                  \
   (1) Feed Reads / Photo Assets             (2) API / Write Requests
                       /                      \
                      v                        v
            +-------------------+     +-------------------+
            |  CloudFront CDN   |     |   Load Balancer   |
            +-------------------+     +-------------------+
                      |                         |
                      | (Cache Miss)            v
                      |               +-------------------+
                      |               |    App Servers    |
                      |               | (Stateless Nodes) |
                      |               +-------------------+
                      |                  /     |     \
                      |     +-----------+      |      +------------+
                      |     |                  |                   |
                      v     v                  v                   v
              +---------------+      +-------------------+   +---------------+
              | Object Store  |      |   In-Memory Cache |   | Message Queue |
              | (S3 / R2)     |      |  (Redis Clusters) |   | (RabbitMQ/SQS)|
              +---------------+      +-------------------+   +---------------+
                     ^                                               |
                     |                                               v
                     | (Upload Thumbnail)                    +---------------+
                     +---------------------------------------| Worker Server |
                                                             | (Sharp/Pillow)|
                                                             +---------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
             (Write Writes)                          (Read Queries)
                   v                                       v
        +----------------------+               +----------------------+
        | Primary Database     |---(Replication)->| Read Replica DB   |
        | (PostgreSQL / MySQL) |               | (Read-Only Cluster)  |
        +----------------------+               +----------------------+