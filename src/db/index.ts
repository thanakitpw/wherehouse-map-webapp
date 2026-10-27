import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy the Supabase connection string into .env.local first.");
  // prepare: false เพราะ Supabase transaction pooler (พอร์ต 6543) ไม่รองรับ prepared statements
  return drizzle(postgres(url, { prepare: false }), { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

// สร้าง connection ตอนใช้งานจริงครั้งแรก เพื่อไม่ให้ `next build` พังตอนยังไม่มี env
export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
