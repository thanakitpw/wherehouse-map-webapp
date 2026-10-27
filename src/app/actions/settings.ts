"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { categories, products, units } from "@/db/schema";
import { int, str, type FormState } from "@/lib/form";
import { requireAdmin } from "@/lib/session";

function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

export async function createCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(fd, "name");
  if (!name) return { error: "กรอกชื่อหมวดหมู่" };
  try {
    await getDb().insert(categories).values({ name });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `หมวดหมู่ ${name} มีอยู่แล้ว` };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: `เพิ่มหมวดหมู่ ${name} แล้ว` };
}

export async function renameCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = int(fd, "id");
  const name = str(fd, "name");
  if (!name) return { error: "กรอกชื่อหมวดหมู่" };
  try {
    await getDb().update(categories).set({ name }).where(eq(categories.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `หมวดหมู่ ${name} มีอยู่แล้ว` };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: "บันทึกแล้ว" };
}

export async function deleteCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = int(fd, "id");
  const db = getDb();
  const [used] = await db.select({ n: count() }).from(products).where(eq(products.categoryId, id));
  if (used.n) return { error: `ลบไม่ได้ เพราะยังมีสินค้าในหมวดนี้ ${used.n} รายการ` };
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/", "layout");
  return { ok: "ลบหมวดหมู่แล้ว" };
}

export async function createUnit(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(fd, "name");
  if (!name) return { error: "กรอกชื่อหน่วย" };
  try {
    await getDb().insert(units).values({ name });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `หน่วย ${name} มีอยู่แล้ว` };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: `เพิ่มหน่วย ${name} แล้ว` };
}

export async function deleteUnit(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = int(fd, "id");
  const db = getDb();
  const [u] = await db.select().from(units).where(eq(units.id, id));
  if (!u) return { error: "ไม่พบหน่วยนี้" };
  const [used] = await db.select({ n: count() }).from(products).where(eq(products.unit, u.name));
  if (used.n) return { error: `ลบไม่ได้ เพราะมีสินค้าใช้หน่วย ${u.name} อยู่ ${used.n} รายการ` };
  await db.delete(units).where(eq(units.id, id));
  revalidatePath("/", "layout");
  return { ok: `ลบหน่วย ${u.name} แล้ว` };
}

export async function setMinQty(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = int(fd, "id");
  const minQty = int(fd, "minQty");
  if (!Number.isInteger(minQty) || minQty < 0) return { error: "ใส่จำนวนตั้งแต่ 0 ขึ้นไป" };
  await getDb().update(products).set({ minQty }).where(eq(products.id, id));
  revalidatePath("/", "layout");
  return { ok: "บันทึกแล้ว" };
}
