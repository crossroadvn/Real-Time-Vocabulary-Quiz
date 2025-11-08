import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  DIFFICULTY_BONUS,
  compareAnswers,
  createApp,
  isScoreRequest,
  QUESTIONS,
  type ScoreRequest,
} from '../app.js';

describe('compareAnswers', () => {
  it('matches answers ignoring case and surrounding whitespace', () => {
    expect(compareAnswers(' Serendipity ', 'serendipity')).toBe(true);
  });

  it('returns false when answers differ', () => {
    expect(compareAnswers('Acumen', 'Penury')).toBe(false);
  });
});

describe('isScoreRequest', () => {
  it('validates payload shape', () => {
    const payload: ScoreRequest = {
      quizId: 'quiz-1',
      userId: 'user-1',
      questionId: 'vocab-1',
      answer: 'Serendipity',
    };

    expect(isScoreRequest(payload)).toBe(true);
  });

  it('rejects payload with missing properties', () => {
    expect(isScoreRequest({ quizId: 'quiz-1' })).toBe(false);
  });
});

describe('POST /score', () => {
  it('awards positive delta for correct answer based on difficulty', async () => {
    const app = createApp();
    const payload: ScoreRequest = {
      quizId: 'quiz-1',
      userId: 'user-1',
      questionId: 'vocab-4',
      answer: QUESTIONS['vocab-4'].answer,
    };

    const response = await request(app).post('/score').send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ correct: true, delta: DIFFICULTY_BONUS.hard });
  });

  it('returns negative delta for incorrect answer', async () => {
    const app = createApp();
    const payload: ScoreRequest = {
      quizId: 'quiz-1',
      userId: 'user-1',
      questionId: 'vocab-1',
      answer: 'Incorrect',
    };

    const response = await request(app).post('/score').send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ correct: false, delta: -10 });
  });

  it('responds with 400 for invalid payload', async () => {
    const app = createApp();

    const response = await request(app).post('/score').send({ quizId: 'quiz-1' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});

