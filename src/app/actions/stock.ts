"use server";

import { desc, eq, inArray, or, sql } from "drizzle-orm";
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

// รับสินค้าเข้าตำแหน่งเดียว
export async function receiveStock(input: { code: string; productId: number; qty: number }): Promise<ActionResult> {
  return receiveStockMany({ productId: input.productId, lines: [{ code: input.code, qty: input.qty }] });
}

// รับสินค้าตัวเดียวกันเข้าหลายตำแหน่งในครั้งเดียว (ตรวจทุกตำแหน่งก่อน ถ้าผิดสักตำแหน่งจะไม่บันทึกเลย)
export async function receiveStockMany(input: { productId: number; lines: { code: string; qty: number }[] }): Promise<ActionResult> {
  const u = await guard();
  const db = getDb();
  const lines = input.lines.map((l) => ({ code: String(l.code), qty: Math.floor(Number(l.qty)) }));
  if (!lines.length) return { error: "เลือกตำแหน่งอย่างน้อย 1 ตำแหน่ง" };
  if (new Set(lines.map((l) => l.code)).size !== lines.length) return { error: "มีตำแหน่งซ้ำกัน" };
  if (lines.some((l) => !(l.qty > 0))) return { error: "จำนวนต้องมากกว่า 0 ทุกตำแหน่ง" };

  const [p] = await db.select().from(products).where(eq(products.id, input.productId));
  if (!p) return { error: "ไม่พบสินค้า" };

  const codes = lines.map((l) => l.code);
  const [locs, owners, res] = await Promise.all([
    db.select({ code: locations.code }).from(locations).where(inArray(locations.code, codes)),
    db
      .select({ code: stock.locationCode, customerId: products.customerId })
      .from(stock)
      .innerJoin(products, eq(stock.productId, products.id))
      .where(inArray(stock.locationCode, codes)),
    db.select().from(reservations).where(inArray(reservations.locationCode, codes)),
  ]);
  const known = new Set(locs.map((l) => l.code));
  const missing = codes.find((c) => !known.has(c));
  if (missing) return { error: `ไม่พบตำแหน่ง ${missing}` };
  const otherOwner = owners.find((o) => o.customerId !== p.customerId);
  if (otherOwner) return { error: `${otherOwner.code} มีสินค้าของลูกค้ารายอื่นอยู่แล้ว` };
  const otherRes = res.find((r) => r.customerId !== p.customerId);
  if (otherRes) return { error: `${otherRes.locationCode} จองไว้ให้ลูกค้ารายอื่น` };

  await db.transaction(async (tx) => {
    for (const l of lines) {
      await tx
        .insert(stock)
        .values({ locationCode: l.code, productId: p.id, qty: l.qty, receivedBy: u.id })
        .onConflictDoUpdate({
          target: [stock.locationCode, stock.productId],
          set: { qty: sql`${stock.qty} + ${l.qty}`, receivedAt: new Date(), receivedBy: u.id },
        });
    }
    if (res.length) await tx.delete(reservations).where(inArray(reservations.id, res.map((r) => r.id)));
    await tx.insert(movements).values(
      lines.map((l) => ({ type: "IN" as const, locationCode: l.code, customerId: p.customerId, productId: p.id, qty: l.qty, userId: u.id })),
    );
  });
  const total = lines.reduce((n, l) => n + l.qty, 0);
  return done(
    lines.length === 1
      ? `รับ ${p.name} ${total} ${p.unit} เข้า ${lines[0].code} แล้ว`
      : `รับ ${p.name} รวม ${total} ${p.unit} เข้า ${lines.length} ตำแหน่งแล้ว`,
  );
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
