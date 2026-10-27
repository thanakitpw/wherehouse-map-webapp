"use server";

import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { int, str, type FormState } from "@/lib/form";
import { requireAdmin } from "@/lib/session";

export async function createUser(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const username = str(fd, "username").toLowerCase();
  const name = str(fd, "name");
  const password = str(fd, "password");
  const role = str(fd, "role") === "admin" ? "admin" : "staff";
  if (!/^[a-z0-9._-]{3,}$/.test(username)) return { error: "ชื่อผู้ใช้ต้องเป็น a-z, 0-9 อย่างน้อย 3 ตัว" };
  if (!name) return { error: "กรอกชื่อที่แสดง" };
  if (password.length < 6) return { error: "รหัสผ่านอย่างน้อย 6 ตัว" };
  const db = getDb();
  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  if (dup) return { error: `ชื่อผู้ใช้ ${username} มีอยู่แล้ว` };
  await db.insert(users).values({ username, name, role, passwordHash: await bcrypt.hash(password, 10) });
  revalidatePath("/users");
  return { ok: `เพิ่มผู้ใช้ ${username} แล้ว` };
}

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = int(fd, "id");
  const password = str(fd, "password");
  if (password.length < 6) return { error: "รหัสผ่านอย่างน้อย 6 ตัว" };
  await getDb().update(users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(users.id, id));
  return { ok: "เปลี่ยนรหัสผ่านแล้ว" };
}

export async function deleteUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const id = int(fd, "id");
  if (id === me.id) return { error: "ลบบัญชีที่กำลังใช้อยู่ไม่ได้" };
  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) return { error: "ไม่พบผู้ใช้" };
  if (target.role === "admin") {
    const [a] = await db.select({ n: count() }).from(users).where(eq(users.role, "admin"));
    if (a.n <= 1) return { error: "ต้องมีแอดมินอย่างน้อย 1 คน" };
  }
  // ประวัติเก่ายังอ้างถึงผู้ใช้นี้ จึงเปลี่ยนเป็นปิดการใช้งานด้วยการล้างรหัสผ่านแทนการลบจริง
  await db.update(users).set({ passwordHash: "!disabled", username: `${target.username}#off${target.id}` }).where(eq(users.id, id));
  revalidatePath("/users");
  return { ok: `ปิดการใช้งาน ${target.username} แล้ว` };
}
