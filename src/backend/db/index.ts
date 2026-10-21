import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: mysql.Pool };

// ใช้ pool เดิมซ้ำตอน hot reload ระหว่างพัฒนา
const pool =
  globalForDb.pool ??
  mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 10, charset: "utf8mb4", dateStrings: true });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema, mode: "default" });
export type Db = typeof db;
export { pool };
