import "server-only";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { users, type Role } from "@/db/schema";

export const SESSION_COOKIE = "session";
const MAX_AGE_DAYS = 7;

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: number) {
  const expires = new Date(Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secretKey());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type CurrentUser = { id: number; username: string; name: string; role: Role };

// อ่านผู้ใช้จาก cookie (ถ้าไม่มีหรือหมดอายุ คืนค่า null)
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<{ userId: number }>(token, secretKey(), { algorithms: ["HS256"] });
    const [u] = await getDb()
      .select({ id: users.id, username: users.username, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, payload.userId));
    return u ?? null;
  } catch {
    return null;
  }
});

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/dashboard");
  return u;
}
