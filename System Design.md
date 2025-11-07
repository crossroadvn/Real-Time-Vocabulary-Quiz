# Real‑Time Vocabulary Quiz — System Design

> **Purpose:** Design a scalable, reliable real‑time quiz feature that meets the acceptance criteria (multi-user join by quiz ID, accurate real‑time scoring, live leaderboard). This document is version 1.0 of the challenge deliverable and includes an architecture diagram (text), component descriptions, data flow, technology choices, AI collaboration notes for the design phase, and considerations (scalability, reliability, monitoring, security, trade-offs).

---

## 1. High‑level Architecture (diagram — ASCII)

```
                +----------------------+        +--------------------+
  Clients       |  CDN / Static Host   |        |  Authentication    |
 (Web/Mobile)   | (optional for assets)|        |  (OAuth / JWT)     |
     |          +----------+-----------+        +----------+---------+
     |                     |                              |
     |   HTTPS (REST)      |                              |
     |  WebSocket (WS)     |                              |
     v                     v                              v
+---------------------------------------------------------------+
|                         Load Balancer / API Gateway          |
|  (NGINX / Traefik / Cloud LB)                                |
+----------------------+----------------------+----------------+
                       |                      |
             +---------v---------+   +--------v---------+
             | Real‑time Servers |   | HTTP API Servers |
             | (WebSocket /      |   | (REST/GraphQL)    |
             | Socket.IO / uWS)  |   | Node.js / FastAPI |
             +---------+---------+   +--------+---------+
                       |                      |
          Pub/Sub /   |                      |  Persistent
         SessionSync  |                      |  Storage
       (Redis / Kafka) |                      |  (Postgres)
                       v                      v
              +----------------------+   +--------------------+
              |  Session Store /     |   |  Relational DB /   |
              |  Short‑term state    |   |  Long‑term storage |
              |  (Redis: hashes,     |   |  (Postgres: users,  |
              |   sorted sets)       |   |   quizzes, history) |
              +----------------------+   +--------------------+
                       |                      |
                       v                      v
                +--------------+       +-------------------+
                | Leaderboard  |       | Analytics / Logs  |
                | Service      |       | (Prometheus,      |
                | (can be part |       |  Grafana, Loki)   |
                |  of RT server|       +-------------------+
                +--------------+
```

*Note*: Real‑time servers are horizontally scalable; session state is kept in Redis and replicated via Pub/Sub so any server instance can push updates to connected clients.

---

## 2. Component Description

**Clients (Web & Mobile)**

* Connect via WebSocket (fallback to long-polling if necessary).
* Present quiz UI: join by quiz ID, show questions, accept answers, show leaderboard.
* Keep a local optimistic UI for snappy feedback; authoritative scoring comes from the server.

**CDN / Static Host**

* Optional, serves static assets and single‑page app.

**Load Balancer / API Gateway**

* Terminates TLS, performs routing (WebSocket sticky cookie optional), rate limiting, WAF rules.
* Routes WebSocket traffic to Real‑time servers and REST calls to API servers.

**Real‑time Server(s)**

* Manages WebSocket connections, handles join/leave events, accepts answer submissions, computes scoring (or delegates to Scoring Engine), publishes score updates to other instances via Pub/Sub, and pushes leaderboard updates to connected clients.
* Technology options: Node.js + Socket.IO / uWS / ws; Go + gorilla/websocket; Elixir + Phoenix Channels (BEAM) for very high concurrency.

**HTTP API Servers**

* Provide user management, quiz CRUD, persist completed sessions, return quiz metadata and question sets.
* Implement authentication/authorization.

**Message Broker / Pub‑Sub (Redis / Kafka)**

* Broadcast events (score updates, session changes) between instances for real‑time sync.
* Redis Pub/Sub or Redis Streams for low‑latency small messages; Kafka if ordered durable logs and high throughput are needed.

**Session Store / Cache (Redis)**

* Fast in‑memory store for ephemeral state: live leaderboard (sorted sets), per‑user score, question timers, connection mapping.
* Use Redis sorted sets (`ZADD`) for leaderboards to get top N quickly.

**Persistent DB (Postgres)**

* Durable storage for users, quizzes, question banks, session history, and audit logs.

**Leaderboard Service**

* Logical service that reads/writes Redis sorted sets and enforces leaderboard rules (tie breakers, score decay if any).
* Can be integrated into Real‑time servers or separated for scale.

**Authentication Service**

* Issues JWT tokens to clients after login. Short‑lived tokens for real‑time websockets; possibility to use cookie + session for browsers.

**Analytics & Monitoring**

* Prometheus for metrics, Grafana dashboards, Loki/ELK for logs, Sentry for errors, Jaeger for tracing.

---

## 3. Data Flow (step‑by‑step)

Below shows the typical flow from join → answer → leaderboard update.

1. **User opens client** and loads the SPA.
2. **User enters quiz ID** and requests to join (REST: `POST /quiz/:id/join` or WebSocket `join` event).
3. **Authentication check**: token validated by API/Real‑time server. If unauthorized, return error.
4. **Server checks quiz session**: verifies session exists, capacity, and whether quiz is accepting joins.
5. **Server registers connection**: maps `connectionId -> userId` in Redis and increments participant count.
6. **Server sends initial state**: sends current question index, remaining time, current leaderboard snapshot (top N), and user's current score.
7. **Users receive question** via broadcast or per‑user event.
8. **User submits answer** via WebSocket `submitAnswer` event with `{quizId, questionId, answer, clientTs, signature}`.
9. **Server validates answer**: server checks request authenticity, validates timestamp (to avoid replay), and checks correctness (compares to canonical answer or uses evaluation function for open answers).
10. **Scoring logic runs**: calculates delta points (e.g., correct → +100; time bonus; streak multipliers). This can be executed inside Real‑time server or delegated to a Scoring Engine microservice for consistency.
11. **Server updates ephemeral state**: updates Redis (user score hash, sorted set for leaderboard). Example: `HINCRBY user:<session>:scores <userId> <delta>`, `ZADD leaderboard:<session> <newscore> <userId>`.
12. **Server emits score update**: publishes event to Pub/Sub so all Real‑time servers push changes to clients connected to the same session on different instances.
13. **Clients receive update**: the client(s) update leaderboard UI in real time (top‑N and user's rank). Optionally, optimistic UI reconciles with server authoritative result.
14. **Session end**: final standings persisted from Redis to Postgres for history and analytics.

---

## 4. Technologies & Tools (Recommended Stack + Justification)

### Recommended Tech Stack Overview

| Layer                              | Core Technology Stack                                |
| ---------------------------------- | ---------------------------------------------------- |
| **Frontend**                       | React + Vite + Tailwind + Socket.IO Client           |
| **Backend**                        | Node.js + NestJS + Socket.IO + Redis                 |
| **Database**                       | PostgreSQL + Prisma ORM                              |
| **Cache & Real-Time**              | Redis (Sorted Sets + Pub/Sub)                        |
| **Auth**                           | JWT / Auth.js                                        |
| **Infra / Deployment**             | Docker + Nginx + Kubernetes / Render / Fly.io        |
| **Observability**                  | Sentry + Grafana + Prometheus                        |
| **Testing**                        | Vitest (frontend) + Jest / Supertest (backend)       |
| **AI Tooling (for collaboration)** | ChatGPT + Cursor AI                                  |

---

### Real-time Transport
- **Primary:** **WebSocket** implemented with **Socket.IO** (rooms, acknowledgements, auto-reconnect).
- **Alternatives:** `uWebSockets.js` or `ws` for lower-level, ultra-low-latency needs.

**Why:** low-latency, bi-directional comms are required for instant score/leaderboard updates; Socket.IO speeds development and improves reliability.

---

### Server Language / Framework
- **Node.js + TypeScript** with **NestJS** (or Express + Socket.IO).
- **Alternatives:** Go (high concurrency) or Elixir/Phoenix (massive concurrency & channels).

**Why:** TypeScript + NestJS gives modular structure, DI, type safety and fast iteration for teams; Socket.IO integrates smoothly.

---

### Ephemeral State & Pub/Sub
- **Redis (Cluster)** for:
  - **Pub/Sub** to broadcast score events across instances.
  - **Sorted Sets (ZSETs)** to maintain live leaderboards.

**Why:** sub-millisecond ops, native ZSETs for ranking, and straightforward pub/sub semantics for multi-instance sync.

---

### Persistent Storage
- **PostgreSQL** with **Prisma ORM** for:
  - Users, quizzes, question bank, session history, audit logs.

**Why:** reliable ACID storage, JSONB for flexible fields, strong tooling and type-safe DB access via Prisma.

---

### Authentication
- **JWT** for microservices + optional **Auth.js** (or comparable) for identity flows.

**Why:** stateless, simple token verification inside real-time events and microservices without central session lookup.

---

### Infrastructure & Deployment
- **Local dev:** Docker Compose for reproducible local stacks.
- **Production:** Kubernetes (Helm) or managed platforms (Render / Fly.io). **Nginx / Traefik** as ingress.

**Why:** containers standardize dev/prod environments; K8s provides autoscaling and resilience at scale.

---

### Observability & Monitoring
- **Metrics:** Prometheus + Grafana  
- **Errors:** Sentry  
- **Logs:** Loki / ELK  
- **Tracing:** Jaeger

**Why:** full-stack observability to diagnose latency, correctness, and reliability issues in real time.

---

### CI/CD & IaC
- **CI:** GitHub Actions  
- **IaC:** Terraform  
- **Builds:** Docker

**Why:** automated tests, reproducible infra provisioning, and containerized deployments.

---

### Load Testing & Scalability Verification
- **Tools:** k6 or Locust for simulating concurrent WebSocket clients and measuring submit→update latency.

**Why:** validates end-to-end behavior (scoring + Redis updates + leaderboard broadcasts) under realistic load.

---

### Security
- **Auth:** OAuth2 / JWT  
- **Transport:** TLS termination at LB  
- **Hardening:** rate limiting, input validation, server-authoritative scoring, anti-cheat heuristics

**Why:** protect data in transit, prevent abuse, and ensure fairness and integrity of scoring.

---

## 5. Leaderboard Implementation Patterns

**In‑memory sorted set (Redis)**

* Use `ZADD` to set score, `ZRANK`/`ZREVRANGE` to get top N and rank. O(log N) operations.
* When score updates arrive: update sorted set atomically and publish a small message with {sessionId, userId, newScore}.

**Sharding/Partitioning**

* Shard sessions by session id hash; each Redis instance handles a range of session IDs to reduce contention when there are extremely many concurrent sessions.

**Consistency**

* Use Redis as the source of truth for live leaderboard. Persist snapshots to Postgres periodically or at session end for durability and audit.

---

## 6. Scalability, Performance, Reliability, Maintainability

### Scalability

* **Horizontal scale** real‑time servers behind load balancer.
* **Stateless servers** hold no exclusive session state — Redis holds ephemeral data. Use sticky sessions only if necessary (but avoid unless optimizing connection reuse is critical).
* **Partitioning**: hash sessionId → server pool or Redis shard to reduce cross‑server traffic.
* **Autoscaling**: scale servers based on active connections or CPU.

### Performance

* Keep messages small (only deltas); batch updates if necessary (every 200ms) to reduce chattiness.
* Use efficient data structures (Redis sorted sets and hashes).
* Use binary protocols (optional) if JSON overhead is significant.

### Reliability

* **Graceful reconnection**: clients reconnect with token and last seen event id so servers can re-sync missed updates.
* **Leader election**: for tasks that should run once per session (e.g., session finalizer), use Redis locks or a small leader election mechanism.
* **Backpressure**: if scoring engine lags, queue updates and send in order; prioritize correctness.

### Maintainability

* Keep scoring logic encapsulated and well‑tested (unit tests + property tests). Use clear interfaces for pluggable scoring algorithms.
* Document APIs and events using OpenAPI + AsyncAPI for WebSocket events.

---

## 7. Security & Anti‑Cheat

* **Server authoritative scoring**: never trust client for correctness or timestamps.
* **Rate limiting**: prevent spam of answer submissions.
* **Timestamp & nonce checks**: prevent replay attacks. Optionally sign submissions with ephemeral tokens.
* **Answer leakage protection**: questions & correct answers stored server‑side; only necessary metadata sent client‑side.
* **Monitor suspicious patterns**: improbable accuracy or impossible response timing may indicate bots/cheats — flag and investigate.

---

## 8. Monitoring & Observability

Key metrics to emit:

* Active connections per server
* Messages/sec (submitAnswer events)
* Score updates/sec
* Latency: time from submit -> score update delivered
* Redis latency and ops/sec
* Error rates & dropped events

Create Grafana dashboards and alerts for:

* High 95th percentile latency for submit->ack
* Redis slow commands
* Error spikes and crash rates

---

## 9. Trade‑offs & Alternatives

* **Socket.IO vs raw WebSocket**: Socket.IO eases development and handles reconnections, but adds overhead. For very high scale and minimal overhead, use `uWebSockets.js` or Go/Elixir alternatives.
* **Redis Pub/Sub vs Kafka**: Redis is lower latency, simpler; Kafka offers durable, ordered logs and replay but higher operational complexity.
* **Sticky sessions**: make horizontal scaling easier (fewer cross‑node messages) but hurt resiliency and complicate autoscaling.

---

## 10. Acceptance Criteria Mapping

* **Join by quiz ID**: API + Real‑time server handle `join` event; session validation.
* **Multi‑user same session**: WebSocket rooms + Redis session store allow many users.
* **Real‑time score updates**: server computes score, updates Redis sorted set, publishes event; clients receive immediate updates.
* **Leaderboard**: Redis sorted sets provide top N quickly; broadcasting updates keeps all clients in sync.

---

## 11. AI Collaboration in Design (Required Section)

Because this challenge **explicitly requires collaboration with Generative AI tools**, this section documents how AI tools were strategically used during the **System Design phase**.  
It demonstrates responsible integration of AI into the design workflow — from brainstorming and documentation to code scaffolding.

---

### Tools Used & Roles

| Tool | Purpose | Example Tasks | Verification |
|------|----------|---------------|--------------|
| **ChatGPT (GPT-5)** | Brainstorm and co-design system architecture. | Prompted with: *“Based on below challenge requirements, collaborate with me to fulfill ‘Part 1: System Design’.”* Helped draft architecture diagrams (Mermaid), data flow explanation, Redis usage, and database schema. | Human validation of each architectural element vs. requirements and scalability constraints. Cross-checked Redis and WebSocket integration with official docs. |
| **ChatGPT (Mermaid Integration)** | Auto-generate visual architecture diagrams and sequence flows. | Created system architecture and component diagrams (server ↔ client ↔ Redis ↔ DB). | Reviewed diagram for correctness, verified all arrows and communication channels match actual design decisions. |
| **Cursor AI** | Code scaffolding and live AI pair-programming. | Generated starter monorepo structure (frontend, real-time server, scoring engine, leaderboard service) and Docker Compose boilerplate. | Verified generated code builds locally; reviewed each scaffolded file; ensured imports, type definitions, and service ports align with architecture. |
| **ChatGPT (Docs Mode)** | Drafted structured design documentation. | Produced “System Overview,” “Data Flow,” and “Technologies & Tools” sections in Markdown format. | Edited for clarity, ensured claims were technically correct, and all stack choices (React, NestJS, Redis) aligned with project feasibility. |

---

### Example Prompts Used

**Primary brainstorming prompt:**
```text
Based on below challenge requirements, collaborate with me to fulfill 'Part 1: System Design' :
```

**Diagram generation prompt:**

```text
Generate a Mermaid system architecture diagram showing Client Web (React), Real-time Server (NestJS + Socket.IO), Redis Pub/Sub, Leaderboard Service, and PostgreSQL.
```

**Cursor AI code scaffold prompt:**

```text
Scaffold a monorepo for a real-time quiz app with: 
  - frontend (React + Vite)
  - backend (NestJS + Socket.IO)
  - leaderboard microservice 
Include Docker Compose and README. Add comments marking AI-ASSISTED sections.
```

### Verification, Debugging, and Refinement (Crucially Required)

Examples of steps:

- Reviewed the generated code from Cursor using my own experience, then guided it to adjust logic or structure.

- Ran the generated project locally; when encountering errors, copied the full error stack into Cursor’s “Ask” panel to request specific fixes.

- Retested after each correction to confirm the issue was resolved.

- Reviewed UI behavior and design alignment; provided prompts to adjust layout, spacing, and component structure.

- Compared AI-suggested code with official framework documentation (React, NestJS, Redis) for compliance and correctness.

- Added linting, TypeScript strict checks, and integration tests to verify runtime stability.

---

## 12. Database Design

The database is implemented using **PostgreSQL** with **Prisma ORM** for schema management and type-safe access.  
It follows a relational model with clear normalization to support scalability, analytics, and auditability.  
Redis handles real-time ephemeral data (leaderboards, live sessions), while PostgreSQL persists long-term data.

---

### Entity Relationship Overview

**Core Entities:**
- `User` — registered learner or player.
- `Quiz` — defines metadata for a quiz session (e.g., topic, difficulty, duration).
- `Question` — represents a question belonging to a quiz or shared question bank.
- `QuizSession` — a live or historical quiz run.
- `SessionParticipant` — links users to sessions, tracking scores.
- `AnswerSubmission` — records each user’s answer attempt (for auditing, analytics).

---

### Database Schema (Prisma-style)

```prisma
model User {
  id              String    @id @default(cuid())
  username        String    @unique
  email           String    @unique
  passwordHash    String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  sessions        SessionParticipant[]
  createdQuizzes  Quiz[]    @relation("QuizCreator")
}

model Quiz {
  id              String    @id @default(cuid())
  title           String
  description     String?
  topic           String
  difficulty      String     // e.g., easy | medium | hard
  timeLimit       Int        // seconds
  createdById     String
  createdAt       DateTime   @default(now())

  // Relations
  createdBy       User       @relation("QuizCreator", fields: [createdById], references: [id])
  questions       Question[]
  sessions        QuizSession[]
}

model Question {
  id              String    @id @default(cuid())
  quizId          String?
  content         String
  options         String[]  // multiple choice options
  correctAnswer   String
  explanation     String?
  type            String     // e.g., multiple-choice, fill-in, match
  createdAt       DateTime   @default(now())

  // Relations
  quiz            Quiz?      @relation(fields: [quizId], references: [id])
}

model QuizSession {
  id              String    @id @default(cuid())
  quizId          String
  startTime       DateTime  @default(now())
  endTime         DateTime?
  status          String     // pending | active | finished

  // Relations
  quiz            Quiz       @relation(fields: [quizId], references: [id])
  participants    SessionParticipant[]
  submissions     AnswerSubmission[]
}

model SessionParticipant {
  id              String    @id @default(cuid())
  userId          String
  sessionId       String
  score           Int        @default(0)
  rank            Int?
  joinedAt        DateTime   @default(now())
  lastActivityAt  DateTime   @default(now())

  // Relations
  user            User       @relation(fields: [userId], references: [id])
  session         QuizSession @relation(fields: [sessionId], references: [id])
  submissions     AnswerSubmission[]
}

model AnswerSubmission {
  id              String    @id @default(cuid())
  sessionId       String
  userId          String
  questionId      String
  selectedAnswer  String
  isCorrect       Boolean
  submittedAt     DateTime   @default(now())

  // Relations
  session         QuizSession @relation(fields: [sessionId], references: [id])
  user            User        @relation(fields: [userId], references: [id])
  question        Question    @relation(fields: [questionId], references: [id])
}

```
---

## 13. Appendix — Sample event definitions (AsyncAPI style simplified)

* `join` (client → server): `{ sessionId, token, userId (optional) }`
* `joinAck` (server → client): `{ success, sessionState: { questionIndex, timeLeft, leaderboardTopN } }`
* `submitAnswer` (client → server): `{ sessionId, questionId, answerId, clientTs }`
* `answerResult` (server → client): `{ questionId, correct: bool, awardedPoints, newScore }`
* `scoreUpdate` (server → all clients): `{ userId, newScore, rank }`
* `leaderboardSnapshot` (server → client): `{ topN: [{userId, score, rank}] }`

---

## 14. Suggested Project Folder Structure

This project follows a **monorepo architecture** using **Docker Compose** for local orchestration.  
Each service (frontend, realtime server, leaderboard service, scoring engine) is **independent** — no shared internal code — to ensure modularity, service isolation, and simpler scaling/deployment.

---

### Suggested Folder Layout Overview

```bash
Real-Time-Vocabulary-Quiz/
├── docker-compose.yml          # Orchestrates all services in local dev
├── .env                        # Environment variables (shared configs)
├── README.md                   # Root documentation
├── docs/                       # System design, AI collaboration logs, diagrams

├── frontend/                   # Client Web App (React + Vite)
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx            # App entrypoint
│   │   ├── App.tsx             # Router and layout
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── services/           # REST + WebSocket clients
│   └── public/

├── realtime-server/            # Real-time backend (Node.js + Socket.IO)
│   ├── package.json
│   ├── src/
│   │   ├── index.ts            # Server bootstrap
│   │   ├── sockets/            # Socket.IO event handlers
│   │   ├── redis/              # Pub/Sub integration
│   │   ├── services/
│   │   │   ├── quizService.ts
│   │   │   └── scoreService.ts
│   │   ├── middlewares/
│   │   └── utils/
│   └── tests/

├── leaderboard-service/        # Leaderboard microservice
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── redis/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── services/
│   └── tests/

├── scoring-engine/             # Isolated service for scoring logic
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── scoring/
│   │   │   ├── rules/
│   │   │   ├── calculators/
│   │   │   └── utils/
│   │   ├── redis/
│   │   └── api/
│   └── tests/

├── database/                   # Prisma + migration setup
│   ├── schema.prisma
│   ├── migrations/
│   ├── seed.ts
│   └── docker/
│       └── init.sql

└── infra/
    ├── redis/                  # Redis Docker configs
    ├── postgres/               # PostgreSQL Docker configs
    ├── nginx/                  # Optional reverse proxy for local routing
    └── monitoring/             # Future: Prometheus/Grafana configs
```

---
