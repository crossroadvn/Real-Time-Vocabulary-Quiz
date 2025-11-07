# Q&A:
- System Design & Technology Choice for Client Web ?
- When to use Redis sorted sets ?
- Database design for users, quizzes, question banks, session history ?
- Suggest framework for each component for development?
- Project Folder structure ?
- Use Docker Compose for Orchestration / Infra in local ?

# Technical Choices:
- Implement Client Web app: choose to use React (with Vite + Router) framework for Client Web 
- Choose between Node.js + Socket.IO / uWS / ws
- Choose to use Redis Pub/Sub
- Choose to use Redis sorted sets
- Leaderboard Service is separated for scale
- In AI Collaboration in Design part, use ChatGPT for brainstorming system (prompt: "Based on below challenge requirements, collaborate with me to fulfill 'Part 1: System Design' :") design, AI for docs (Mermaid via ChatGPT) and Cursor for coding .
- Add "Database design" part with designed schema for users, quizzes, question banks, session history.
- Implement mocking Authentication check
- Add Client Web — System Design part
- Add Recommended Tech Stack part
- Add Section 14: Project Folder Structure (Monorepo Layout). Don't share any coding folder except for infra/ and docs/ so we can refactor to microservices later
- Use Docker Compose for local development orchestration.
- Scaffold the monorepo (create starter files for frontend, realtime server, scoring engine, leaderboard service) with AI-assistance comments.