"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { customers, movements, products, reservations } from "@/db/schema";
import { int, str, type FormState } from "@/lib/form";
import { requireUser } from "@/lib/session";

export async function createCustomer(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const name = str(fd, "name");
  if (!name) return { error: "กรอกชื่อลูกค้า" };
  await getDb().insert(customers).values({ name, phone: str(fd, "phone"), note: str(fd, "note") });
  revalidatePath("/", "layout");
  return { ok: `เพิ่มลูกค้า ${name} แล้ว` };
}

export async function updateCustomer(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = int(fd, "id");
  const name = str(fd, "name");
  if (!name) return { error: "กรอกชื่อลูกค้า" };
  await getDb().update(customers).set({ name, phone: str(fd, "phone"), note: str(fd, "note") }).where(eq(customers.id, id));
  revalidatePath("/", "layout");
  return { ok: "บันทึกแล้ว" };
}

// ลบได้เฉพาะลูกค้าที่ไม่มีสินค้า ไม่มีการจอง และไม่มีประวัติ
export async function deleteCustomer(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = int(fd, "id");
  const db = getDb();
  const [[p], [r], [m]] = await Promise.all([
    db.select({ n: count() }).from(products).where(eq(products.customerId, id)),
    db.select({ n: count() }).from(reservations).where(eq(reservations.customerId, id)),
    db.select({ n: count() }).from(movements).where(eq(movements.customerId, id)),
  ]);
  if (p.n || r.n || m.n) return { error: "ลบไม่ได้ เพราะลูกค้านี้มีสินค้า การจอง หรือประวัติในระบบแล้ว" };
  await db.delete(customers).where(eq(customers.id, id));
  revalidatePath("/", "layout");
  redirect("/customers");
}
