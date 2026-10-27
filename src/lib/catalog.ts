import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, units } from "@/db/schema";

// ตัวเลือกหมวดหมู่และหน่วยนับสำหรับฟอร์มสินค้า (ตั้งค่าได้ที่หน้า /settings)
export async function getProductOptions() {
  const db = getDb();
  const [cats, us] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select({ name: units.name }).from(units).orderBy(asc(units.id)),
  ]);
  return { categories: cats, units: us.map((u) => u.name) };
}
