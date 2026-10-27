import { gte, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { movements } from "@/db/schema";
import { MOVEMENT_LABEL } from "@/lib/format";
import { RACKS } from "@/lib/layout";
import { getSlots } from "@/lib/warehouse";

export const metadata: Metadata = { title: "รายงาน" };

export default async function ReportsPage() {
  // เริ่มวันนี้ตามเวลาไทย
  const startOfToday = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) + "T00:00:00+07:00");
  const [slots, today] = await Promise.all([
    getSlots(),
    getDb()
      .select({ type: movements.type, n: sql<number>`count(*)::int` })
      .from(movements)
      .where(gte(movements.createdAt, startOfToday))
      .groupBy(movements.type),
  ]);

  const total = slots.length;
  const occ = slots.filter((s) => s.status === "occ").length;
  const res = slots.filter((s) => s.status === "res").length;

  const byRack = RACKS.map((r) => {
    const list = slots.filter((s) => s.rack === r);
    const o = list.filter((s) => s.status === "occ").length;
    const rs = list.filter((s) => s.status === "res").length;
    return { rack: r, total: list.length, occ: o, res: rs, empty: list.length - o - rs };
  });

  const custMap = new Map<number, { id: number; name: string; pallets: number; reserved: number; qty: number }>();
  for (const s of slots) {
    if (!s.customer) continue;
    const c = custMap.get(s.customer.id) ?? { id: s.customer.id, name: s.customer.name, pallets: 0, reserved: 0, qty: 0 };
    if (s.status === "occ") { c.pallets++; c.qty += s.items.reduce((n, it) => n + it.qty, 0); }
    else c.reserved++;
    custMap.set(c.id, c);
  }
  const byCustomer = [...custMap.values()].sort((a, b) => b.pallets - a.pallets);
  const todayCount = (t: string) => today.find((x) => x.type === t)?.n ?? 0;

  return (
    <div className="page">
      <div className="page-head"><div><h1>รายงาน</h1><p>สรุปการใช้พื้นที่ Zone A และความเคลื่อนไหววันนี้</p></div></div>

      <div className="stat-row">
        <div className="card stat"><div className="k">ใช้พื้นที่แล้ว</div><div className="v">{Math.round(((occ + res) * 100) / Math.max(1, total))}%</div></div>
        <div className="card stat"><div className="k">มีสินค้า</div><div className="v">{occ}</div></div>
        <div className="card stat"><div className="k">จองไว้</div><div className="v">{res}</div></div>
        <div className="card stat"><div className="k">ว่าง</div><div className="v">{total - occ - res}</div></div>
        <div className="card stat"><div className="k">วันนี้ รับเข้า / เบิกออก</div><div className="v">{todayCount("IN")} / {todayCount("OUT")}</div></div>
      </div>

      <div className="card panel">
        <h2>การใช้พื้นที่แต่ละแร็ค</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>แร็ค</th><th>ใช้แล้ว</th><th className="num">มีสินค้า</th><th className="num">จอง</th><th className="num">ว่าง</th></tr></thead>
            <tbody>
              {byRack.map((r) => {
                const pct = Math.round(((r.occ + r.res) * 100) / Math.max(1, r.total));
                return (
                  <tr key={r.rack}>
                    <td className="mono"><b>{r.rack}</b></td>
                    <td style={{ width: "40%" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div className="bar-track" style={{ flex: 1 }}><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                        <span className="mono" style={{ width: 42, textAlign: "right" }}>{pct}%</span>
                      </div>
                    </td>
                    <td className="num">{r.occ}</td><td className="num">{r.res}</td><td className="num">{r.empty}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card panel">
        <h2>พื้นที่ที่ลูกค้าแต่ละรายใช้</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ลูกค้า</th><th className="num">พาเลทที่ใช้</th><th className="num">จองไว้</th><th className="num">จำนวนสินค้ารวม</th></tr></thead>
            <tbody>
              {byCustomer.length === 0 && <tr><td colSpan={4} className="empty-row">ยังไม่มีข้อมูล</td></tr>}
              {byCustomer.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/customers/${c.id}`}>{c.name}</Link></td>
                  <td className="num">{c.pallets}</td><td className="num">{c.reserved}</td><td className="num">{c.qty.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card panel">
        <h2>ความเคลื่อนไหววันนี้</h2>
        <div className="filters">
          {(["IN", "OUT", "MOVE", "RESERVE", "CANCEL"] as const).map((t) => (
            <Link key={t} href={`/movements?type=${t}`}>{MOVEMENT_LABEL[t]} {todayCount(t)}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
