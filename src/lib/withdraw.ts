import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { movements, products, stock, withdrawals } from "@/db/schema";
import { docNo } from "./format";

export type WithdrawLine = { stockId: number; qty: number };

// ตัดสต็อกตามรายการ แล้วออกใบเบิก 1 ใบ (ทุกรายการต้องเป็นของลูกค้ารายเดียวกัน)
export async function applyWithdrawal(opts: {
  userId: number;
  lines: WithdrawLine[];
  note?: string;
  onlyCode?: string;
}): Promise<{ error: string } | { id: number; doc: string; positions: number; summary: string[] }> {
  const lines = opts.lines
    .map((l) => ({ stockId: Number(l.stockId), qty: Math.floor(Number(l.qty)) }))
    .filter((l) => l.qty > 0);
  if (!lines.length) return { error: "ใส่จำนวนที่ต้องการเบิกอย่างน้อย 1 รายการ" };

  // ทำใน transaction และล็อกแถวสต็อกไว้ กันสองคนเบิกตำแหน่งเดียวกันพร้อมกันจนสต็อกติดลบ
  return getDb().transaction(async (db) => {
    const rows = await db
      .select({
        id: stock.id, code: stock.locationCode, qty: stock.qty, productId: stock.productId,
        customerId: products.customerId, name: products.name, unit: products.unit,
      })
      .from(stock)
      .innerJoin(products, eq(stock.productId, products.id))
      .where(inArray(stock.id, lines.map((l) => l.stockId)))
      .for("update", { of: stock });

    // ตรวจทุกรายการก่อน แล้วค่อยตัดสต็อก
    const plan = [];
    for (const l of lines) {
      const row = rows.find((r) => r.id === l.stockId);
      if (!row || (opts.onlyCode && row.code !== opts.onlyCode)) return { error: "มีรายการที่ไม่พบในคลังแล้ว รีเฟรชหน้าแล้วลองใหม่" };
      if (l.qty > row.qty) return { error: `${row.code} มี ${row.name} ${row.qty} ${row.unit} แต่จะเบิก ${l.qty}` };
      plan.push({ ...row, take: l.qty });
    }
    const customerIds = new Set(plan.map((p) => p.customerId));
    if (customerIds.size > 1) return { error: "ใบเบิกหนึ่งใบเบิกได้เฉพาะสินค้าของลูกค้ารายเดียว" };

    const [w] = await db
      .insert(withdrawals)
      .values({ customerId: plan[0].customerId, note: (opts.note ?? "").trim(), userId: opts.userId })
      .returning({ id: withdrawals.id });
    const doc = docNo(w.id);

    for (const p of plan) {
      if (p.take === p.qty) await db.delete(stock).where(eq(stock.id, p.id));
      else await db.update(stock).set({ qty: p.qty - p.take }).where(eq(stock.id, p.id));
    }
    await db.insert(movements).values(
      plan.map((p) => ({
        type: "OUT" as const, locationCode: p.code, customerId: p.customerId, productId: p.productId,
        qty: p.take, userId: opts.userId, withdrawalId: w.id, note: `ใบเบิก ${doc}`,
      })),
    );

    const totals = new Map<string, number>();
    for (const p of plan) totals.set(`${p.name}|${p.unit}`, (totals.get(`${p.name}|${p.unit}`) ?? 0) + p.take);
    const summary = [...totals].map(([k, n]) => { const [name, unit] = k.split("|"); return `${name} ${n} ${unit}`; });
    return { id: w.id, doc, positions: new Set(plan.map((p) => p.code)).size, summary };
  });
}
