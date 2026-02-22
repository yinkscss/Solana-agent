import { loadEnv } from './config/env.js';
import { createApp } from './app.js';

const env = loadEnv();
const app = createApp(env);

console.log(`API Gateway listening on port ${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
