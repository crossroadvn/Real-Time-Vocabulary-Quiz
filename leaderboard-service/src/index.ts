import 'dotenv/config';

import cors from 'cors';
import express, { Request, Response } from 'express';
import { Redis as RedisClient } from 'ioredis';

type JoinRequest = {
  userId: string;
  username: string;
};

type ScoreRequest = JoinRequest & {
  delta: number;
};

type LeaderboardEntry = {
  userId: string;
  username: string;
  score: number;
  rank: number;
};

type LeaderboardResponse = {
  quizId: string;
  leaderboard: LeaderboardEntry[];
  userScore: number;
};

const PORT = Number(process.env.LEADERBOARD_SERVICE_PORT ?? 5002);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const redis = new RedisClient(REDIS_URL);

const app = express();
app.use(cors());
app.use(express.json());

// AI-ASSISTED: Redis leaderboard access pattern derived from AI draft, reviewed and adjusted for resilience.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/sessions/:quizId', async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const response = await buildLeaderboardResponse(quizId, req.query.userId as string | undefined);
    res.json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load leaderboard');
  }
});

app.post('/sessions/:quizId/join', async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const body: JoinRequest = req.body;

    if (!isJoinRequest(body)) {
      return res.status(400).json({ error: 'Invalid join payload' });
    }

    await ensureUser(quizId, body.userId, body.username);
    const response = await buildLeaderboardResponse(quizId, body.userId);
    res.json(response);
  } catch (error) {
    handleError(res, error, 'Failed to join leaderboard');
  }
});

app.post('/sessions/:quizId/score', async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const body: ScoreRequest = req.body;

    if (!isScoreRequest(body)) {
      return res.status(400).json({ error: 'Invalid score payload' });
    }

    await ensureUser(quizId, body.userId, body.username);
    const key = leaderboardKey(quizId);
    await redis.zincrby(key, body.delta, body.userId);

    const response = await buildLeaderboardResponse(quizId, body.userId);
    res.json(response);
  } catch (error) {
    handleError(res, error, 'Failed to update score');
  }
});

app.listen(PORT, () => {
  console.log(`Leaderboard service listening on port ${PORT}`);
});

function leaderboardKey(quizId: string): string {
  return `leaderboard:${quizId}`;
}

function usernamesKey(quizId: string): string {
  return `leaderboard:${quizId}:usernames`;
}

async function ensureUser(quizId: string, userId: string, username: string): Promise<void> {
  const lbKey = leaderboardKey(quizId);
  const userKey = usernamesKey(quizId);
  const pipeline = redis.pipeline();
  pipeline.zadd(lbKey, 'NX', 0, userId);
  pipeline.hset(userKey, userId, username);
  pipeline.expire(lbKey, 60 * 60 * 4);
  pipeline.expire(userKey, 60 * 60 * 4);
  await pipeline.exec();
}

async function buildLeaderboardResponse(quizId: string, userId?: string): Promise<LeaderboardResponse> {
  const key = leaderboardKey(quizId);
  const userKey = usernamesKey(quizId);

  const [top, userScoreValue, usernameMap] = await Promise.all([
    redis.zrevrange(key, 0, 19, 'WITHSCORES'),
    userId ? redis.zscore(key, userId) : Promise.resolve(null),
    redis.hgetall(userKey),
  ]);

  const leaderboard: LeaderboardEntry[] = [];
  for (let i = 0; i < top.length; i += 2) {
    const id = top[i];
    const score = Number(top[i + 1]);
    leaderboard.push({
      userId: id,
      username: usernameMap[id] ?? 'Anonymous',
      score,
      rank: Math.floor(i / 2) + 1,
    });
  }

  const userScore = userScoreValue ? Number(userScoreValue) : 0;

  return {
    quizId,
    leaderboard,
    userScore,
  };
}

function isJoinRequest(value: unknown): value is JoinRequest {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<JoinRequest>;
  return [candidate.userId, candidate.username].every((field) => typeof field === 'string' && field.length > 0);
}

function isScoreRequest(value: unknown): value is ScoreRequest {
  if (!isJoinRequest(value)) return false;
  const candidate = value as Partial<ScoreRequest>;
  return typeof candidate.delta === 'number';
}

function handleError(res: Response, error: unknown, message: string) {
  console.error(message, error);
  res.status(500).json({ error: message });
}

