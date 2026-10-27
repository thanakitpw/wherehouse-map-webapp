import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { customers, movements, products, users, type MovementType } from "@/db/schema";
import { docNo, MOVEMENT_LABEL, thDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "ประวัติเคลื่อนไหว" };

const TYPES: MovementType[] = ["IN", "OUT", "MOVE", "RESERVE", "CANCEL"];

export default async function MovementsPage({ searchParams }: PageProps<"/movements">) {
  const { type } = await searchParams;
  const filter = TYPES.find((t) => t === type);
  const actor = alias(users, "actor");
  const rows = await getDb()
    .select({
      id: movements.id, type: movements.type, code: movements.locationCode, to: movements.toLocationCode,
      qty: movements.qty, note: movements.note, at: movements.createdAt, withdrawalId: movements.withdrawalId,
      customer: customers.name, product: products.name, sku: products.sku, unit: products.unit, by: actor.name,
    })
    .from(movements)
    .leftJoin(customers, eq(movements.customerId, customers.id))
    .leftJoin(products, eq(movements.productId, products.id))
    .leftJoin(actor, eq(movements.userId, actor.id))
    .where(filter ? eq(movements.type, filter) : undefined)
    .orderBy(desc(movements.createdAt), desc(movements.id))
    .limit(200);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>ประวัติเคลื่อนไหว</h1>
          <p>ล่าสุด 200 รายการ · รับเข้า ย้าย และจอง ทำได้จากหน้าผังคลัง · เบิกหลายตำแหน่งทำที่หน้า <Link href="/withdraw">เบิกสินค้า</Link></p>
        </div>
        <form action="/map" className="searchbox" style={{ height: 44, minWidth: 260 }}>
          <input name="q" placeholder="ไปที่ตำแหน่ง เช่น AC-05-0101" aria-label="ไปที่ตำแหน่ง" style={{ fontSize: 15 }} />
          <button type="submit" className="btn primary" style={{ height: 32, flex: "none" }}>ไป</button>
        </form>
      </div>

      <div className="filters">
        <Link href="/movements" aria-current={!filter ? "page" : undefined}>ทั้งหมด</Link>
        {TYPES.map((t) => (
          <Link key={t} href={`/movements?type=${t}`} aria-current={filter === t ? "page" : undefined}>{MOVEMENT_LABEL[t]}</Link>
        ))}
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr><th>เวลา</th><th>ประเภท</th><th>ตำแหน่ง</th><th>ลูกค้า</th><th>สินค้า</th><th className="num">จำนวน</th><th>ใบเบิก</th><th>โดย</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="empty-row">ยังไม่มีรายการ</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}>{thDateTime(r.at)}</td>
                <td><span className={`tag ${r.type}`}>{MOVEMENT_LABEL[r.type]}</span></td>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>
                  <Link href={`/map?sel=${r.code}`}>{r.code}</Link>
                  {r.to && <> → <Link href={`/map?sel=${r.to}`}>{r.to}</Link></>}
                </td>
                <td>{r.customer ?? "–"}</td>
                <td>{r.product ? <>{r.product} <span className="mono" style={{ fontSize: 12, color: "#4A5A6A" }}>{r.sku}</span></> : r.withdrawalId ? "–" : r.note || "–"}</td>
                <td className="num">{r.qty ? `${r.qty} ${r.unit ?? ""}` : "–"}</td>
                <td className="mono">{r.withdrawalId ? <Link href={`/withdraw/${r.withdrawalId}`}>{docNo(r.withdrawalId)}</Link> : "–"}</td>
                <td>{r.by ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
