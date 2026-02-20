import { serve } from 'bun';
import { app } from './app.js';
import { env } from './config/env.js';

console.log(`Agent Runtime Service running on port ${env.PORT}`);
serve({ port: env.PORT, fetch: app.fetch });
