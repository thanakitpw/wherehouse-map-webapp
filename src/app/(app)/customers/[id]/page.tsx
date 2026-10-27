import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCustomer, updateCustomer } from "@/app/actions/customers";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { getDb } from "@/db";
import { customers, products, reservations, stock } from "@/db/schema";
import { thDate } from "@/lib/format";

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) notFound();
  const [rows, res] = await Promise.all([
    db
      .select({ code: stock.locationCode, qty: stock.qty, at: stock.receivedAt, name: products.name, sku: products.sku, unit: products.unit })
      .from(stock)
      .innerJoin(products, eq(stock.productId, products.id))
      .where(eq(products.customerId, id))
      .orderBy(asc(stock.locationCode)),
    db.select().from(reservations).where(eq(reservations.customerId, id)).orderBy(asc(reservations.locationCode)),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p><Link href="/customers">← ลูกค้าทั้งหมด</Link></p>
          <h1>{c.name}</h1>
          <p>ใช้ {new Set(rows.map((r) => r.code)).size} ตำแหน่ง · จองไว้ {res.length} ตำแหน่ง</p>
        </div>
        <Link className="btn" style={{ flex: "none", display: "inline-flex", alignItems: "center" }} href={`/map?q=${encodeURIComponent(c.name)}`}>ดูบนผังคลัง</Link>
      </div>

      <div className="card panel">
        <h2>ข้อมูลลูกค้า</h2>
        <ActionForm action={updateCustomer}>
          <input type="hidden" name="id" value={c.id} />
          <div className="form-grid">
            <div className="field"><label htmlFor="c-name">ชื่อลูกค้า / บริษัท</label><input id="c-name" name="name" defaultValue={c.name} required /></div>
            <div className="field"><label htmlFor="c-phone">เบอร์โทร</label><input id="c-phone" name="phone" defaultValue={c.phone} /></div>
            <div className="field"><label htmlFor="c-note">หมายเหตุ</label><input id="c-note" name="note" defaultValue={c.note} /></div>
            <SubmitButton>บันทึก</SubmitButton>
          </div>
        </ActionForm>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>ตำแหน่ง</th><th>สินค้า</th><th className="num">จำนวน</th><th>รับเข้า</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="empty-row">ยังไม่มีสินค้าในคลัง</td></tr>}
            {rows.map((r) => (
              <tr key={`${r.code}-${r.sku}`}>
                <td className="mono"><Link href={`/map?sel=${r.code}`}>{r.code}</Link></td>
                <td>{r.name} <span className="mono" style={{ fontSize: 12, color: "#4A5A6A" }}>{r.sku}</span></td>
                <td className="num">{r.qty} {r.unit}</td>
                <td>{thDate(r.at)}</td>
              </tr>
            ))}
            {res.map((r) => (
              <tr key={`res-${r.id}`}>
                <td className="mono"><Link href={`/map?sel=${r.locationCode}`}>{r.locationCode}</Link></td>
                <td><span className="tag RESERVE">จองไว้</span></td>
                <td className="num">–</td>
                <td>{r.eta ? `คาดว่าเข้า ${thDate(r.eta)}` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card panel danger-zone">
        <h2>ลบลูกค้า</h2>
        <ActionForm action={deleteCustomer}>
          <input type="hidden" name="id" value={c.id} />
          <p className="meta" style={{ margin: 0 }}>ลบได้เฉพาะลูกค้าที่ยังไม่มีสินค้า การจอง หรือประวัติในระบบ</p>
          <SubmitButton className="btn danger" style={{ flex: "none", alignSelf: "flex-start" }}>ลบลูกค้านี้</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
