"use server";

import { desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { customers, locations, movements, products, reservations, stock, users } from "@/db/schema";
import { MOVEMENT_LABEL, thDate, thDateTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult, HistoryRow } from "@/lib/types";
import { applyWithdrawal } from "@/lib/withdraw";

async function guard() {
  const u = await getCurrentUser();
  if (!u) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  return u;
}

async function locationExists(code: string) {
  const [l] = await getDb().select({ code: locations.code }).from(locations).where(eq(locations.code, code));
  return !!l;
}

async function stockCustomerIds(code: string) {
  const rows = await getDb()
    .select({ customerId: products.customerId })
    .from(stock)
    .innerJoin(products, eq(stock.productId, products.id))
    .where(eq(stock.locationCode, code));
  return [...new Set(rows.map((r) => r.customerId))];
}

function done(ok: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok };
}

// รับสินค้าเข้าตำแหน่ง
export async function receiveStock(input: { code: string; productId: number; qty: number }): Promise<ActionResult> {
  const u = await guard();
  const db = getDb();
  const qty = Math.floor(Number(input.qty));
  if (!(qty > 0)) return { error: "จำนวนต้องมากกว่า 0" };
  if (!(await locationExists(input.code))) return { error: "ไม่พบตำแหน่งนี้" };

  const [p] = await db.select().from(products).where(eq(products.id, input.productId));
  if (!p) return { error: "ไม่พบสินค้า" };

  const owners = await stockCustomerIds(input.code);
  if (owners.some((id) => id !== p.customerId)) return { error: "ตำแหน่งนี้มีสินค้าของลูกค้ารายอื่นอยู่แล้ว" };

  const [r] = await db.select().from(reservations).where(eq(reservations.locationCode, input.code));
  if (r && r.customerId !== p.customerId) return { error: "ตำแหน่งนี้จองไว้ให้ลูกค้ารายอื่น" };

  await db
    .insert(stock)
    .values({ locationCode: input.code, productId: p.id, qty, receivedBy: u.id })
    .onConflictDoUpdate({
      target: [stock.locationCode, stock.productId],
      set: { qty: sql`${stock.qty} + ${qty}`, receivedAt: new Date(), receivedBy: u.id },
    });
  if (r) await db.delete(reservations).where(eq(reservations.id, r.id));
  await db.insert(movements).values({ type: "IN", locationCode: input.code, customerId: p.customerId, productId: p.id, qty, userId: u.id });
  return done(`รับ ${p.name} ${qty} ${p.unit} เข้า ${input.code} แล้ว`);
}

// เบิกสินค้าออกจากตำแหน่งเดียว (ออกใบเบิกให้อัตโนมัติ)
export async function withdrawStock(input: { code: string; items: { stockId: number; qty: number }[] }): Promise<ActionResult> {
  const u = await guard();
  const r = await applyWithdrawal({ userId: u.id, lines: input.items, onlyCode: input.code });
  if ("error" in r) return { error: r.error };
  return done(`${r.doc} เบิกออกแล้ว: ${r.summary.join(", ")}`);
}

// ย้ายของทั้งพาเลทไปตำแหน่งว่าง
export async function moveStock(input: { from: string; to: string }): Promise<ActionResult> {
  const u = await guard();
  const db = getDb();
  if (input.from === input.to) return { error: "เลือกตำแหน่งปลายทางที่ไม่ใช่ตำแหน่งเดิม" };
  if (!(await locationExists(input.to))) return { error: "ไม่พบตำแหน่งปลายทาง" };

  const owners = await stockCustomerIds(input.from);
  if (!owners.length) return { error: "ตำแหน่งต้นทางไม่มีสินค้า" };
  if ((await stockCustomerIds(input.to)).length) return { error: "ตำแหน่งปลายทางมีสินค้าอยู่แล้ว" };
  const [r] = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.locationCode, input.to));
  if (r) return { error: "ตำแหน่งปลายทางถูกจองไว้แล้ว" };

  await db.update(stock).set({ locationCode: input.to }).where(eq(stock.locationCode, input.from));
  await db.insert(movements).values({ type: "MOVE", locationCode: input.from, toLocationCode: input.to, customerId: owners[0], userId: u.id });
  return done(`ย้ายพาเลทจาก ${input.from} ไป ${input.to} แล้ว`);
}

// จองตำแหน่งว่างไว้ให้ลูกค้า
export async function reserveLocation(input: { code: string; customerId: number; eta: string }): Promise<ActionResult> {
  const u = await guard();
  const db = getDb();
  if (!(await locationExists(input.code))) return { error: "ไม่พบตำแหน่งนี้" };
  if ((await stockCustomerIds(input.code)).length) return { error: "ตำแหน่งนี้มีสินค้าอยู่แล้ว" };
  const [c] = await db.select().from(customers).where(eq(customers.id, input.customerId));
  if (!c) return { error: "ไม่พบลูกค้า" };
  const [r] = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.locationCode, input.code));
  if (r) return { error: "ตำแหน่งนี้ถูกจองไปแล้ว" };

  const eta = /^\d{4}-\d{2}-\d{2}$/.test(input.eta) ? input.eta : null;
  await db.insert(reservations).values({ locationCode: input.code, customerId: c.id, eta, createdBy: u.id });
  await db.insert(movements).values({
    type: "RESERVE", locationCode: input.code, customerId: c.id, userId: u.id, note: eta ? `คาดว่าสินค้าเข้า ${thDate(eta)}` : "",
  });
  return done(`จอง ${input.code} ให้ ${c.name} แล้ว`);
}

export async function cancelReservation(input: { code: string }): Promise<ActionResult> {
  const u = await guard();
  const db = getDb();
  const [r] = await db.select().from(reservations).where(eq(reservations.locationCode, input.code));
  if (!r) return { error: "ตำแหน่งนี้ไม่ได้ถูกจอง" };
  await db.delete(reservations).where(eq(reservations.id, r.id));
  await db.insert(movements).values({ type: "CANCEL", locationCode: input.code, customerId: r.customerId, userId: u.id });
  return done(`ยกเลิกการจอง ${input.code} แล้ว`);
}

// ประวัติของตำแหน่ง (ล่าสุดก่อน)
export async function getLocationHistory(code: string): Promise<HistoryRow[]> {
  await guard();
  const db = getDb();
  const actor = alias(users, "actor");
  const rows = await db
    .select({
      id: movements.id,
      type: movements.type,
      from: movements.locationCode,
      to: movements.toLocationCode,
      qty: movements.qty,
      note: movements.note,
      createdAt: movements.createdAt,
      product: products.name,
      unit: products.unit,
      customer: customers.name,
      by: actor.name,
    })
    .from(movements)
    .leftJoin(products, eq(movements.productId, products.id))
    .leftJoin(customers, eq(movements.customerId, customers.id))
    .leftJoin(actor, eq(movements.userId, actor.id))
    .where(or(eq(movements.locationCode, code), eq(movements.toLocationCode, code)))
    .orderBy(desc(movements.createdAt), desc(movements.id))
    .limit(50);

  return rows.map((r) => {
    let title = MOVEMENT_LABEL[r.type];
    if (r.type === "MOVE") title = r.to === code ? `ย้ายเข้าจาก ${r.from}` : `ย้ายออกไป ${r.to}`;
    if (r.type === "RESERVE" || r.type === "CANCEL") title += r.customer ? ` · ${r.customer}` : "";
    const parts = [thDateTime(r.createdAt), r.by ? `โดย ${r.by}` : ""];
    if (r.product) parts.push(`${r.product}${r.qty ? ` ${r.qty} ${r.unit}` : ""}`);
    if (r.note) parts.push(r.note);
    return { id: r.id, title, detail: parts.filter(Boolean).join(" · ") };
  });
}
