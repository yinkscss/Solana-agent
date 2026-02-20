import { serve } from 'bun';
import { app } from './app';
import { env } from './config/env';

console.log(`DeFi Integration Service running on port ${env.PORT}`);
serve({ port: env.PORT, fetch: app.fetch });
