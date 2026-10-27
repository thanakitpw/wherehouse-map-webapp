import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { customers, movements, products, users, withdrawals } from "@/db/schema";
import { docNo, thDateTime } from "@/lib/format";
import { PrintButton } from "./PrintButton";

export default async function WithdrawalPage({ params }: PageProps<"/withdraw/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const actor = alias(users, "actor");
  const [w] = await db
    .select({ id: withdrawals.id, at: withdrawals.createdAt, note: withdrawals.note, customer: customers.name, phone: customers.phone, by: actor.name })
    .from(withdrawals)
    .innerJoin(customers, eq(withdrawals.customerId, customers.id))
    .leftJoin(actor, eq(withdrawals.userId, actor.id))
    .where(eq(withdrawals.id, id));
  if (!w) notFound();
  const lines = await db
    .select({ id: movements.id, code: movements.locationCode, qty: movements.qty, name: products.name, sku: products.sku, unit: products.unit })
    .from(movements)
    .leftJoin(products, eq(movements.productId, products.id))
    .where(eq(movements.withdrawalId, id))
    .orderBy(asc(movements.locationCode));

  const totals = new Map<string, { name: string; sku: string; unit: string; qty: number }>();
  for (const l of lines) {
    const k = l.sku ?? "";
    const t = totals.get(k) ?? { name: l.name ?? "", sku: k, unit: l.unit ?? "", qty: 0 };
    t.qty += l.qty ?? 0;
    totals.set(k, t);
  }

  return (
    <div className="page">
      <div className="page-head no-print">
        <p style={{ margin: 0 }}><Link href="/withdraw">← เบิกสินค้า</Link></p>
        <PrintButton />
      </div>

      <div className="card panel doc">
        <div className="page-head">
          <div>
            <h1>ใบเบิกสินค้า</h1>
            <p className="mono" style={{ fontSize: 18, color: "#14202B" }}>{docNo(w.id)}</p>
          </div>
          <div className="meta" style={{ textAlign: "right" }}>
            {thDateTime(w.at)}<br />ผู้เบิก: {w.by ?? "–"}
          </div>
        </div>
        <div className="box">
          <div className="k">ลูกค้า</div>
          <div className="v">{w.customer}</div>
          {w.phone && <div className="s">{w.phone}</div>}
          {w.note && <div className="s">หมายเหตุ: {w.note}</div>}
        </div>

        <h2>รายการหยิบ (เรียงตามตำแหน่ง)</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>ตำแหน่ง</th><th>สินค้า</th><th className="num">จำนวน</th><th className="print-only">หยิบแล้ว</th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id}>
                  <td>{i + 1}</td>
                  <td className="mono"><b>{l.code}</b></td>
                  <td>{l.name} <span className="mono" style={{ fontSize: 12, color: "#4A5A6A" }}>{l.sku}</span></td>
                  <td className="num">{l.qty} {l.unit}</td>
                  <td className="print-only">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>สรุปตามสินค้า</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>สินค้า</th><th>SKU</th><th className="num">รวม</th></tr></thead>
            <tbody>
              {[...totals.values()].map((t) => (
                <tr key={t.sku}><td>{t.name}</td><td className="mono">{t.sku}</td><td className="num"><b>{t.qty.toLocaleString()}</b> {t.unit}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="signs print-only">
          <div>ผู้เบิก ............................</div>
          <div>ผู้รับสินค้า ............................</div>
        </div>
      </div>
    </div>
  );
}
