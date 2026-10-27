import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { DDL } from "./ddl";
import * as schema from "./schema";
import { seed } from "./seed";

// ฐานข้อมูลจำลอง: Postgres (PGlite) ที่รันอยู่ใน memory ของ server ไม่ต้องต่อฐานข้อมูลภายนอก
// สร้างตาราง + ใส่ข้อมูลตัวอย่างใหม่ทุกครั้งที่ server เริ่ม ข้อมูลที่แก้จะหายเมื่อรีสตาร์ท
async function createDb() {
  const db = drizzle(new PGlite(), { schema });
  await db.$client.exec(DDL);
  await seed(db);
  return db;
}

export type Db = Awaited<ReturnType<typeof createDb>>;

// เก็บไว้ใน globalThis เพื่อให้ hot reload ตอน dev ไม่สร้างฐานข้อมูลใหม่ทุกครั้งที่แก้โค้ด
const g = globalThis as { __db?: Promise<Db> };

export function getDb() {
  g.__db ??= createDb().catch((e) => {
    g.__db = undefined;
    throw e;
  });
  return g.__db;
}
