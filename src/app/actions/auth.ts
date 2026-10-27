"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { str, type FormState } from "@/lib/form";
import { createSession, deleteSession } from "@/lib/session";

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = str(fd, "username").toLowerCase();
  const password = str(fd, "password");
  if (!username || !password) return { error: "กรอกชื่อผู้ใช้และรหัสผ่าน" };

  const [u] = await (await getDb()).select().from(users).where(eq(users.username, username));
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) {
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }
  await createSession(u.id);
  redirect(str(fd, "next").startsWith("/") ? str(fd, "next") : "/map");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
