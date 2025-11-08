import 'dotenv/config';

import { createApp } from './app.js';

const PORT = Number(process.env.SCORING_ENGINE_PORT ?? 5001);

const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Scoring engine listening on port ${PORT}`);
  });
}

export { createApp };

