import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';

const { Pool } = pg;
let pool: pg.Pool | undefined;

export const getPool = (): pg.Pool => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('На сервере не настроен DATABASE_URL для PostgreSQL.');
  if (!pool) {
    const hostname = new URL(connectionString).hostname;
    const localDatabase = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: localDatabase ? undefined : { rejectUnauthorized: true },
    });
    attachDatabasePool(pool);
  }
  return pool;
};

export const databaseSetupHint = 'Проверь DATABASE_URL и выполни db/schema.sql в SQL Editor базы Neon.';
