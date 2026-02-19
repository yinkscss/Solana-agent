import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export const createDb = (connectionUrl?: string) => {
  const url = connectionUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = postgres(url);
  return drizzle(client, { schema });
};

let _db: ReturnType<typeof createDb> | undefined;

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_, prop) {
    _db ??= createDb();
    return Reflect.get(_db, prop);
  },
});

export type Database = ReturnType<typeof createDb>;
