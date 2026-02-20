import { env } from './config/env.js';
import { createApp } from './app.js';
import { websocket } from './routes/ws.js';

const { app, context } = createApp();

await context.eventConsumer.start();

console.log(`Notification Service running on port ${env.PORT}`);

Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
  websocket,
});
