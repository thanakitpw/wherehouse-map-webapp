"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { movements, products, stock } from "@/db/schema";
import { int, str, type FormState } from "@/lib/form";
import { requireUser } from "@/lib/session";

function readProduct(fd: FormData) {
  const minQty = int(fd, "minQty");
  return {
    customerId: int(fd, "customerId"),
    categoryId: int(fd, "categoryId") || null,
    sku: str(fd, "sku").toUpperCase(),
    name: str(fd, "name"),
    unit: str(fd, "unit") || "ลัง",
    minQty: Number.isInteger(minQty) && minQty > 0 ? minQty : 0,
    customsNo: str(fd, "customsNo").toUpperCase(),
    containerNo: str(fd, "containerNo").toUpperCase().replace(/\s+/g, ""),
  };
}

function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

export async function createProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const p = readProduct(fd);
  if (!p.customerId || !p.sku || !p.name) return { error: "กรอกลูกค้า, SKU และชื่อสินค้าให้ครบ" };
  try {
    await getDb().insert(products).values(p);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `SKU ${p.sku} มีอยู่แล้ว` };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: `เพิ่มสินค้า ${p.name} แล้ว` };
}

export async function updateProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = int(fd, "id");
  const p = readProduct(fd);
  if (!p.customerId || !p.sku || !p.name) return { error: "กรอกลูกค้า, SKU และชื่อสินค้าให้ครบ" };
  const db = getDb();
  const [cur] = await db.select().from(products).where(eq(products.id, id));
  if (!cur) return { error: "ไม่พบสินค้า" };
  if (cur.customerId !== p.customerId) {
    const [s] = await db.select({ n: count() }).from(stock).where(eq(stock.productId, id));
    if (s.n) return { error: "เปลี่ยนเจ้าของไม่ได้ เพราะสินค้านี้ยังมีอยู่ในคลัง" };
  }
  try {
    await db.update(products).set(p).where(eq(products.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `SKU ${p.sku} มีอยู่แล้ว` };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: "บันทึกแล้ว" };
}

export async function deleteProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = int(fd, "id");
  const db = getDb();
  const [[s], [m]] = await Promise.all([
    db.select({ n: count() }).from(stock).where(eq(stock.productId, id)),
    db.select({ n: count() }).from(movements).where(eq(movements.productId, id)),
  ]);
  if (s.n || m.n) return { error: "ลบไม่ได้ เพราะสินค้านี้มีในคลังหรือมีประวัติแล้ว" };
  await db.delete(products).where(eq(products.id, id));
  revalidatePath("/", "layout");
  redirect("/products");
}
