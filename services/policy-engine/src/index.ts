import { serve } from 'bun';
import Redis from 'ioredis';
import { createDb } from '@solagent/db';
import { env } from './config/env.js';
import { createApp } from './app.js';

const redis = new Redis(env.REDIS_URL);
const db = createDb(env.DATABASE_URL);

const app = createApp({ db, redis });

console.log(`Policy Engine Service running on port ${env.PORT}`);

serve({
  port: env.PORT,
  fetch: app.fetch,
});
