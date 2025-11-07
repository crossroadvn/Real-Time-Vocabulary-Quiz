import 'dotenv/config';

import cors from 'cors';
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import axios from 'axios';

type JoinPayload = {
  quizId: string;
  userId: string;
  username: string;
};

type SubmitAnswerPayload = {
  quizId: string;
  userId: string;
  username: string;
  questionId: string;
  answer: string;
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

type ScoringResponse = {
  correct: boolean;
  delta: number;
};

const PORT = Number(process.env.RT_SERVER_PORT ?? 4000);
const SCORING_ENGINE_URL = process.env.SCORING_ENGINE_URL ?? 'http://localhost:5001';
const LEADERBOARD_SERVICE_URL = process.env.LEADERBOARD_SERVICE_URL ?? 'http://localhost:5002';

const app = express();
app.use(cors());
app.use(express.json());

// AI-ASSISTED: Socket.IO server bootstrap skeleton suggested by ChatGPT; manually reviewed and extended with validation & error handling.
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/leaderboard/:quizId', async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const { data } = await axios.get<LeaderboardResponse>(`${LEADERBOARD_SERVICE_URL}/sessions/${quizId}`);
    res.json(data);
  } catch (error) {
    handleHttpError('Failed to fetch leaderboard', error, res);
  }
});

io.on('connection', (socket: Socket) => {
  socket.on('join_quiz', async (payload: JoinPayload, ack?: (data: unknown) => void) => {
    if (!isJoinPayload(payload)) {
      return sendAck(ack, { error: 'Invalid join payload' });
    }

    const { quizId, userId, username } = payload;
    const room = makeRoomId(quizId);

    try {
      const { data } = await axios.post<LeaderboardResponse>(
        `${LEADERBOARD_SERVICE_URL}/sessions/${quizId}/join`,
        { userId, username }
      );

      await socket.join(room);
      io.to(room).emit('leaderboard_update', data);
      sendAck(ack, { status: 'joined', leaderboard: data });
    } catch (error) {
      sendAck(ack, { error: 'Failed to join quiz' });
    }
  });

  socket.on('submit_answer', async (payload: SubmitAnswerPayload, ack?: (data: unknown) => void) => {
    if (!isSubmitPayload(payload)) {
      return sendAck(ack, { error: 'Invalid answer payload' });
    }

    const { quizId, userId, username, questionId, answer } = payload;
    const room = makeRoomId(quizId);

    try {
      const scoringResult = await axios.post<ScoringResponse>(`${SCORING_ENGINE_URL}/score`, {
        quizId,
        userId,
        questionId,
        answer,
      });

      const leaderboardResult = await axios.post<LeaderboardResponse>(
        `${LEADERBOARD_SERVICE_URL}/sessions/${quizId}/score`,
        {
          userId,
          username,
          delta: scoringResult.data.delta,
        }
      );

      sendAck(ack, {
        correct: scoringResult.data.correct,
        delta: scoringResult.data.delta,
        newScore: leaderboardResult.data.userScore,
      });

      io.to(room).emit('leaderboard_update', leaderboardResult.data);
    } catch (error) {
      sendAck(ack, { error: 'Failed to process answer' });
    }
  });

  socket.on('disconnect', () => {
    // No-op for now; future improvement: inform services about disconnect.
  });
});

function isJoinPayload(value: unknown): value is JoinPayload {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<JoinPayload>;
  return [candidate.quizId, candidate.userId, candidate.username].every((field) => typeof field === 'string' && field.length > 0);
}

function isSubmitPayload(value: unknown): value is SubmitAnswerPayload {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<SubmitAnswerPayload>;
  return [candidate.quizId, candidate.userId, candidate.username, candidate.questionId, candidate.answer].every(
    (field) => typeof field === 'string' && field.length > 0
  );
}

function makeRoomId(quizId: string): string {
  return `quiz:${quizId}`;
}

function sendAck(ack: ((data: unknown) => void) | undefined, payload: unknown) {
  if (typeof ack === 'function') {
    ack(payload);
  }
}

function handleHttpError(message: string, error: unknown, res: Response) {
  const status = (axios.isAxiosError(error) && error.response?.status) || 500;
  res.status(status).json({ error: message });
}

httpServer.listen(PORT, () => {
  console.log(`Real-time server listening on port ${PORT}`);
});

