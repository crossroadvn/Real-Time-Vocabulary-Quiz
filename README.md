## Real-Time Vocabulary Quiz — Implementation Snapshot

This repository contains a scaffolded solution for the Real-Time Vocabulary Quiz challenge. It follows the architecture defined in `System Design.md` and delivers a working prototype of the core runtime components:

- `frontend`: React + Vite client showcasing quiz join, answer submissions, and real-time leaderboard updates via Socket.IO.
- `realtime-server`: Node.js + TypeScript Socket.IO gateway handling quiz sessions, delegating scoring, and broadcasting leaderboard deltas.
- `scoring-engine`: Independent scoring microservice providing deterministic scoring for vocabulary questions.
- `leaderboard-service`: Redis-backed service managing leaderboard state with sorted sets.
- `infra/docker-compose.yml`: Local orchestration for the full stack plus Redis.

### Project Structure

```text
/frontend              # React client
/realtime-server       # WebSocket gateway (Socket.IO)
/scoring-engine        # Scoring microservice
/leaderboard-service   # Leaderboard microservice (Redis)
/infra/docker-compose.yml
```

### Quick Start (Docker Compose)

```bash
cd infra
docker compose up --build
```

Frontend is served at `http://localhost:5173` (proxying to the real-time server on port `4000`).

### Frontend Hot Reload (Docker)

To work on the React client with live reload inside Docker:

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build frontend
```

This uses the `dev` stage from the frontend Dockerfile, mounts your local source for instant refresh, and loads environment variables from `frontend/docker.env.development` (including `VITE_REALTIME_URL`). The app is available at `http://localhost:5173`, still connecting to the Socket.IO server on port `4000`.

To stop the dev container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

### Running Services Individually

Each service exposes the usual Node scripts. Example:

```bash
cd realtime-server
npm install
npm run dev
```

Ensure Redis is available locally at `redis://localhost:6379` when running services without Docker Compose.

### Scoring Engine Tests

The scoring engine ships with Vitest coverage for the request validator, answer comparator, and `/score` endpoint.

```bash
cd scoring-engine
npm install
npm test
```

Use `npm test -- --watch` for an interactive rerun loop while iterating on the service.

### Environment Variables

- `RT_SERVER_PORT` (default `4000`)
- `SCORING_ENGINE_URL` (default `http://localhost:5001`)
- `LEADERBOARD_SERVICE_URL` (default `http://localhost:5002`)
- `SCORING_ENGINE_PORT` (default `5001`)
- `LEADERBOARD_SERVICE_PORT` (default `5002`)
- `REDIS_URL` (default `redis://localhost:6379`)
- `VITE_REALTIME_URL` (frontend, default `http://localhost:4000`)

### AI Collaboration Notes

Inline `// AI-ASSISTED` comments flag code locations where ChatGPT/Cursor suggestions seeded the scaffold. Additional verification details are captured in `AI_COLLABORATION.md`.

### Next Steps

- Extend question management (REST API / DB persistence).
- Add authentication and authorization checks on socket events.
- Implement automated tests (unit and integration) for scoring and leaderboard flows.

