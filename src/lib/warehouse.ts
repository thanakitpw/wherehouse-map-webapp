import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, locations, products, reservations, stock, users } from "@/db/schema";
import type { CustomerOption, Slot } from "./types";

// โหลดสถานะทุกตำแหน่ง (1,080 ตำแหน่ง) พร้อมของและการจอง
export async function getSlots(): Promise<Slot[]> {
  const db = await getDb();
  const [locs, stockRows, resRows] = await Promise.all([
    db.select().from(locations).orderBy(asc(locations.code)),
    db
      .select({
        stockId: stock.id,
        code: stock.locationCode,
        qty: stock.qty,
        receivedAt: stock.receivedAt,
        receivedBy: users.name,
        productId: products.id,
        name: products.name,
        sku: products.sku,
        unit: products.unit,
        customerId: customers.id,
        customerName: customers.name,
        phone: customers.phone,
      })
      .from(stock)
      .innerJoin(products, eq(stock.productId, products.id))
      .innerJoin(customers, eq(products.customerId, customers.id))
      .leftJoin(users, eq(stock.receivedBy, users.id))
      .orderBy(asc(stock.id)),
    db
      .select({ code: reservations.locationCode, eta: reservations.eta, customerId: customers.id, customerName: customers.name, phone: customers.phone })
      .from(reservations)
      .innerJoin(customers, eq(reservations.customerId, customers.id)),
  ]);

  const byCode = new Map<string, Slot>();
  for (const l of locs) {
    byCode.set(l.code, { ...l, status: "empty", customer: null, items: [], receivedAt: null, receivedBy: null, eta: null });
  }
  for (const r of stockRows) {
    const s = byCode.get(r.code);
    if (!s) continue;
    s.status = "occ";
    s.customer = { id: r.customerId, name: r.customerName, phone: r.phone };
    s.items.push({ stockId: r.stockId, productId: r.productId, name: r.name, sku: r.sku, qty: r.qty, unit: r.unit });
    const at = r.receivedAt.toISOString();
    if (!s.receivedAt || at > s.receivedAt) {
      s.receivedAt = at;
      s.receivedBy = r.receivedBy;
    }
  }
  for (const r of resRows) {
    const s = byCode.get(r.code);
    if (!s || s.status === "occ") continue;
    s.status = "res";
    s.customer = { id: r.customerId, name: r.customerName, phone: r.phone };
    s.eta = r.eta;
  }
  return [...byCode.values()];
}

export async function getCustomerOptions(): Promise<CustomerOption[]> {
  const db = await getDb();
  const [cs, ps] = await Promise.all([
    db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(asc(customers.name)),
    db.select({ id: products.id, name: products.name, sku: products.sku, unit: products.unit, customerId: products.customerId }).from(products).orderBy(asc(products.name)),
  ]);
  return cs.map((c) => ({ ...c, products: ps.filter((p) => p.customerId === c.id) }));
}
