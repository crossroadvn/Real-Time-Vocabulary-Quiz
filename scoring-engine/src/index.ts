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

type QuestionDefinition = {
  prompt: string;
  options: string[];
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
};

const QUESTIONS: Record<string, QuestionDefinition> = {
  'vocab-1': {
    prompt: 'Which word describes discovering something valuable by accident?',
    options: ['Somber', 'Serendipity', 'Discord', 'Candor'],
    answer: 'Serendipity',
    difficulty: 'medium',
  },
  'vocab-2': {
    prompt: 'Select the word that means lasting for a very short time.',
    options: ['Ephemeral', 'Robust', 'Tenacious', 'Lucid'],
    answer: 'Ephemeral',
    difficulty: 'medium',
  },
  'vocab-3': {
    prompt: 'Choose the word that means sociable and fond of company.',
    options: ['Austere', 'Furtive', 'Gregarious', 'Vigilant'],
    answer: 'Gregarious',
    difficulty: 'easy',
  },
  'vocab-4': {
    prompt: 'Identify the word that refers to a departure from what is normal or expected.',
    options: ['Aberration', 'Dogma', 'Paragon', 'Levity'],
    answer: 'Aberration',
    difficulty: 'hard',
  },
  'vocab-5': {
    prompt: 'Which word best describes someone who speaks persuasively and fluently?',
    options: ['Obstinate', 'Eloquent', 'Opaque', 'Stoic'],
    answer: 'Eloquent',
    difficulty: 'easy',
  },
  'vocab-6': {
    prompt: 'Select the word that means to make something bad or unsatisfactory better.',
    options: ['Ameliorate', 'Aggravate', 'Vacillate', 'Illuminate'],
    answer: 'Ameliorate',
    difficulty: 'medium',
  },
  'vocab-7': {
    prompt: 'Choose the word that means stubbornly refusing to change one’s opinion.',
    options: ['Obdurate', 'Veracious', 'Altruistic', 'Mercurial'],
    answer: 'Obdurate',
    difficulty: 'hard',
  },
  'vocab-8': {
    prompt: 'Which word refers to the ability to make good judgments quickly?',
    options: ['Acumen', 'Apathy', 'Deference', 'Penury'],
    answer: 'Acumen',
    difficulty: 'medium',
  },
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

