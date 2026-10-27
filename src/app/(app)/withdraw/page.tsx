import { asc, count, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { customers, locations, movements, products, stock, users, withdrawals } from "@/db/schema";
import { docNo, thDateTime } from "@/lib/format";
import { WithdrawBuilder, type StockRow } from "./WithdrawBuilder";

export const metadata: Metadata = { title: "เบิกสินค้า" };

export default async function WithdrawPage({ searchParams }: PageProps<"/withdraw">) {
  const { codes } = await searchParams;
  const initialCodes = typeof codes === "string" ? codes.split(",").filter(Boolean) : [];
  const db = await getDb();
  const actor = alias(users, "actor");
  const [rows, recent] = await Promise.all([
    db
      .select({
        stockId: stock.id, code: stock.locationCode, rack: locations.rack, bay: locations.bay, level: locations.level,
        qty: stock.qty, receivedAt: stock.receivedAt,
        productId: products.id, name: products.name, sku: products.sku, unit: products.unit,
        customerId: customers.id, customer: customers.name,
      })
      .from(stock)
      .innerJoin(locations, eq(stock.locationCode, locations.code))
      .innerJoin(products, eq(stock.productId, products.id))
      .innerJoin(customers, eq(products.customerId, customers.id))
      .orderBy(asc(stock.receivedAt), asc(stock.locationCode)),
    db
      .select({ id: withdrawals.id, at: withdrawals.createdAt, customer: customers.name, by: actor.name, lines: count(movements.id) })
      .from(withdrawals)
      .innerJoin(customers, eq(withdrawals.customerId, customers.id))
      .leftJoin(actor, eq(withdrawals.userId, actor.id))
      .leftJoin(movements, eq(movements.withdrawalId, withdrawals.id))
      .groupBy(withdrawals.id, customers.id, actor.id)
      .orderBy(desc(withdrawals.id))
      .limit(20),
  ]);

  const stockRows: StockRow[] = rows.map((r) => ({ ...r, receivedAt: r.receivedAt.toISOString() }));
  const custs = [...new Map(rows.map((r) => [r.customerId, { id: r.customerId, name: r.customer }])).values()].sort((a, b) =>
    a.name.localeCompare(b.name, "th"),
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>เบิกสินค้า</h1>
          <p>เบิกได้หลายตำแหน่งในครั้งเดียว ระบบออกเป็นใบเบิกใบเดียว · หนึ่งใบเบิกต่อลูกค้าหนึ่งราย</p>
        </div>
      </div>

      <WithdrawBuilder customers={custs} rows={stockRows} initialCodes={initialCodes} />

      <div className="card panel">
        <h2>ใบเบิกล่าสุด</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>เลขที่</th><th>วันที่</th><th>ลูกค้า</th><th className="num">รายการ</th><th>โดย</th></tr></thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={5} className="empty-row">ยังไม่มีใบเบิก</td></tr>}
              {recent.map((w) => (
                <tr key={w.id}>
                  <td className="mono"><Link href={`/withdraw/${w.id}`}>{docNo(w.id)}</Link></td>
                  <td>{thDateTime(w.at)}</td>
                  <td>{w.customer}</td>
                  <td className="num">{w.lines}</td>
                  <td>{w.by ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
