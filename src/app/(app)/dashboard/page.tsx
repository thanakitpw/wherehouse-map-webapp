import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { customers, movements, products, stock } from "@/db/schema";
import { MOVEMENT_LABEL, thDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getSlots } from "@/lib/warehouse";
import { TrendChart, type TrendDay } from "./TrendChart";

export const metadata: Metadata = { title: "แดชบอร์ด" };

const DAYS = 14;
const TZ = "Asia/Bangkok";
const dayLabel = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
const dayFull = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// วันที่ย้อนหลัง 14 วันตามเวลาไทย (YYYY-MM-DD) เก่าสุดก่อน
function lastDays() {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  return Array.from({ length: DAYS }, (_, i) => new Date(Date.UTC(y, m - 1, d - (DAYS - 1 - i))));
}

export default async function DashboardPage() {
  const user = await requireUser();
  const db = getDb();
  const days = lastDays();
  const since = new Date(days[0].toISOString().slice(0, 10) + "T00:00:00+07:00");
  const startOfToday = new Date(days[DAYS - 1].toISOString().slice(0, 10) + "T00:00:00+07:00");
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  // ใส่ timezone เป็นข้อความตรง ๆ ไม่ใช่ parameter ไม่งั้น SELECT กับ GROUP BY ได้คนละ $n แล้ว Postgres มองว่าเป็นคนละนิพจน์
  const dayKey = sql<string>`to_char(${movements.createdAt} at time zone ${sql.raw(`'${TZ}'`)}, 'YYYY-MM-DD')`;

  const [slots, daily, today, low, recent, [{ nCust }], [{ nProd }]] = await Promise.all([
    getSlots(),
    db
      .select({ day: dayKey, type: movements.type, n: sql<number>`count(*)::int` })
      .from(movements)
      .where(and(gte(movements.createdAt, since), inArray(movements.type, ["IN", "OUT"])))
      .groupBy(dayKey, movements.type),
    db
      .select({ type: movements.type, n: sql<number>`count(*)::int` })
      .from(movements)
      .where(and(gte(movements.createdAt, startOfToday), lt(movements.createdAt, startOfTomorrow)))
      .groupBy(movements.type),
    db
      .select({
        id: products.id, sku: products.sku, name: products.name, unit: products.unit, minQty: products.minQty,
        customer: customers.name, qty: sql<number>`coalesce(sum(${stock.qty}), 0)::int`,
      })
      .from(products)
      .innerJoin(customers, eq(products.customerId, customers.id))
      .leftJoin(stock, eq(stock.productId, products.id))
      .groupBy(products.id, customers.id)
      .having(sql`${products.minQty} > 0 and coalesce(sum(${stock.qty}), 0) < ${products.minQty}`)
      .orderBy(sql`coalesce(sum(${stock.qty}), 0)::float / ${products.minQty}`, asc(products.name)),
    db
      .select({
        id: movements.id, type: movements.type, code: movements.locationCode, qty: movements.qty, at: movements.createdAt,
        customer: customers.name, product: products.name, unit: products.unit,
      })
      .from(movements)
      .leftJoin(customers, eq(movements.customerId, customers.id))
      .leftJoin(products, eq(movements.productId, products.id))
      .orderBy(desc(movements.createdAt), desc(movements.id))
      .limit(8),
    db.select({ nCust: count() }).from(customers),
    db.select({ nProd: count() }).from(products),
  ]);

  const total = slots.length;
  const occ = slots.filter((s) => s.status === "occ").length;
  const res = slots.filter((s) => s.status === "res").length;
  const todayCount = (t: string) => today.find((x) => x.type === t)?.n ?? 0;

  const trend: TrendDay[] = days.map((d) => {
    const key = d.toISOString().slice(0, 10);
    const n = (t: string) => daily.find((r) => r.day === key && r.type === t)?.n ?? 0;
    return { label: dayLabel.format(d), full: dayFull.format(d), in: n("IN"), out: n("OUT") };
  });

  const custMap = new Map<number, { id: number; name: string; pallets: number }>();
  for (const s of slots) {
    if (s.status !== "occ" || !s.customer) continue;
    const c = custMap.get(s.customer.id) ?? { id: s.customer.id, name: s.customer.name, pallets: 0 };
    c.pallets++;
    custMap.set(c.id, c);
  }
  const topCustomers = [...custMap.values()].sort((a, b) => b.pallets - a.pallets).slice(0, 5);
  const maxPallets = Math.max(1, ...topCustomers.map((c) => c.pallets));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>แดชบอร์ด</h1><p>สวัสดี {user.name} · ภาพรวมคลัง Zone A ตอนนี้</p></div>
        <Link className="btn" style={{ flex: "none", display: "inline-flex", alignItems: "center" }} href="/reports">ดูรายงานเต็ม</Link>
      </div>

      <div className="stat-row">
        <div className="card stat"><div className="k">ใช้พื้นที่แล้ว</div><div className="v">{Math.round(((occ + res) * 100) / Math.max(1, total))}%</div><div className="s">มีสินค้า {occ} · จอง {res}</div></div>
        <div className="card stat"><div className="k">ตำแหน่งว่าง</div><div className="v">{total - occ - res}</div><div className="s">จาก {total.toLocaleString()} ตำแหน่ง</div></div>
        <div className="card stat"><div className="k">วันนี้ รับเข้า / เบิกออก</div><div className="v">{todayCount("IN")} / {todayCount("OUT")}</div><div className="s">รายการ</div></div>
        <div className="card stat"><div className="k">ลูกค้า / สินค้า</div><div className="v">{nCust} / {nProd}</div><div className="s"><Link href="/products">ดูสินค้าทั้งหมด</Link></div></div>
        <div className={`card stat${low.length ? " warn" : ""}`}>
          <div className="k">สินค้าต่ำกว่าขั้นต่ำ</div><div className="v">{low.length}</div>
          <div className="s"><a href="#low-stock">{low.length ? "ดูรายการ" : "ไม่มีรายการต้องเติม"}</a></div>
        </div>
      </div>

      <div className="dash-row">
        <div className="card panel dash-wide">
          <h2>รับเข้า / เบิกออก 14 วันล่าสุด</h2>
          <TrendChart days={trend} />
        </div>

        <div className="card panel dash-side">
          <h2>ลูกค้าที่ใช้พื้นที่มากที่สุด</h2>
          {topCustomers.length === 0 && <p className="meta" style={{ margin: 0 }}>ยังไม่มีสินค้าในคลัง</p>}
          <div className="rank">
            {topCustomers.map((c) => (
              <div key={c.id}>
                <div className="rank-top"><Link href={`/customers/${c.id}`}>{c.name}</Link><span className="mono">{c.pallets} พาเลท</span></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.pallets * 100) / maxPallets}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-row">
        <div className="card panel dash-side" id="low-stock">
          <h2>สินค้าต่ำกว่าขั้นต่ำ</h2>
          {low.length === 0 ? (
            <p className="meta" style={{ margin: 0 }}>สินค้าทุกรายการยังมีมากกว่าขั้นต่ำ</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>สินค้า</th><th className="num">คงเหลือ / ขั้นต่ำ</th></tr></thead>
                <tbody>
                  {low.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/products/${p.id}`}>{p.name}</Link><div className="meta" style={{ fontSize: 13 }}>{p.customer} · <span className="mono">{p.sku}</span></div></td>
                      <td className="num">{p.qty.toLocaleString()} / {p.minQty.toLocaleString()} {p.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {user.role === "admin" && <p className="meta" style={{ margin: 0 }}>ปรับขั้นต่ำได้ที่ <Link href="/settings#min-qty">ตั้งค่า</Link></p>}
        </div>

        <div className="card panel dash-wide">
          <h2>ความเคลื่อนไหวล่าสุด</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>เวลา</th><th>ประเภท</th><th>ตำแหน่ง</th><th>รายการ</th><th className="num">จำนวน</th></tr></thead>
              <tbody>
                {recent.length === 0 && <tr><td colSpan={5} className="empty-row">ยังไม่มีรายการ</td></tr>}
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{thDateTime(r.at)}</td>
                    <td><span className={`tag ${r.type}`}>{MOVEMENT_LABEL[r.type]}</span></td>
                    <td className="mono"><Link href={`/map?sel=${r.code}`}>{r.code}</Link></td>
                    <td>{r.product ?? r.customer ?? "–"}</td>
                    <td className="num">{r.qty ? `${r.qty} ${r.unit ?? ""}` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="meta" style={{ margin: 0 }}><Link href="/movements">ดูประวัติทั้งหมด</Link></p>
        </div>
      </div>
    </div>
  );
}
