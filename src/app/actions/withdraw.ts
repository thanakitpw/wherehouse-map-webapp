"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { applyWithdrawal, type WithdrawLine } from "@/lib/withdraw";

// เบิกหลายตำแหน่งในครั้งเดียว แล้วคืนเลขใบเบิกให้หน้าเว็บพาไปดูใบเบิก
export async function createWithdrawal(input: { lines: WithdrawLine[]; note: string }): Promise<{ error?: string; id?: number }> {
  const u = await getCurrentUser();
  if (!u) return { error: "กรุณาเข้าสู่ระบบใหม่" };
  const r = await applyWithdrawal({ userId: u.id, lines: input.lines, note: input.note });
  if ("error" in r) return { error: r.error };
  revalidatePath("/", "layout");
  return { id: r.id };
}
