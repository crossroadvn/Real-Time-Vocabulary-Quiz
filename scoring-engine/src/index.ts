import 'dotenv/config';

import cors from 'cors';
import express, { Request, Response } from 'express';

type ScoreRequest = {
  quizId: string;
  userId: string;
  questionId: string;
  answer: string;
};

type ScoreResponse = {
  correct: boolean;
  delta: number;
};

const PORT = Number(process.env.SCORING_ENGINE_PORT ?? 5001);

const QUESTIONS: Record<string, { answer: string; difficulty: 'easy' | 'medium' | 'hard' }> = {
  'vocab-1': { answer: 'serendipity', difficulty: 'medium' },
  'vocab-2': { answer: 'ephemeral', difficulty: 'medium' },
  'vocab-3': { answer: 'gregarious', difficulty: 'easy' },
  'vocab-4': { answer: 'aberration', difficulty: 'hard' },
};

const DIFFICULTY_BONUS: Record<'easy' | 'medium' | 'hard', number> = {
  easy: 50,
  medium: 75,
  hard: 120,
};

const app = express();
app.use(cors());
app.use(express.json());

// AI-ASSISTED: Initial Express scaffolding produced with AI draft; refined and validated manually.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/score', (req: Request, res: Response) => {
  const payload: ScoreRequest = req.body;

  if (!isScoreRequest(payload)) {
    return res.status(400).json({ error: 'Invalid score payload' });
  }

  const question = QUESTIONS[payload.questionId];
  const correct = question ? compareAnswers(question.answer, payload.answer) : false;
  const delta = correct ? DIFFICULTY_BONUS[question?.difficulty ?? 'easy'] : -10;

  res.json({ correct, delta } satisfies ScoreResponse);
});

app.listen(PORT, () => {
  console.log(`Scoring engine listening on port ${PORT}`);
});

function isScoreRequest(value: unknown): value is ScoreRequest {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<ScoreRequest>;
  return [candidate.quizId, candidate.userId, candidate.questionId, candidate.answer].every(
    (field) => typeof field === 'string' && field.length > 0
  );
}

function compareAnswers(expected: string, actual: string): boolean {
  return expected.trim().toLowerCase() === actual.trim().toLowerCase();
}

