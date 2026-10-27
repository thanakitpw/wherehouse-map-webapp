import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProduct, updateProduct } from "@/app/actions/products";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { getDb } from "@/db";
import { customers, products, stock } from "@/db/schema";
import { getProductOptions } from "@/lib/catalog";
import { thDate } from "@/lib/format";

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = getDb();
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p) notFound();
  const [custs, opts, rows] = await Promise.all([
    db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(asc(customers.name)),
    getProductOptions(),
    db.select().from(stock).where(eq(stock.productId, id)).orderBy(asc(stock.locationCode)),
  ]);
  const total = rows.reduce((n, r) => n + r.qty, 0);
  // หน่วยที่ถูกลบออกจากตั้งค่าไปแล้วยังต้องเลือกค้างไว้ได้
  const units = opts.units.includes(p.unit) ? opts.units : [p.unit, ...opts.units];
  const low = p.minQty > 0 && total < p.minQty;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p><Link href="/products">← สินค้าทั้งหมด</Link></p>
          <h1>{p.name}</h1>
          <p className="mono">{p.sku} · คงเหลือ {total.toLocaleString()} {p.unit} ใน {rows.length} ตำแหน่ง</p>
          {low && <p><span className="tag low">ต่ำกว่าขั้นต่ำ {p.minQty.toLocaleString()} {p.unit}</span></p>}
        </div>
        <Link className="btn" style={{ flex: "none", display: "inline-flex", alignItems: "center" }} href={`/map?q=${encodeURIComponent(p.sku)}`}>ดูบนผังคลัง</Link>
      </div>

      <div className="card panel">
        <h2>ข้อมูลสินค้า</h2>
        <ActionForm action={updateProduct}>
          <input type="hidden" name="id" value={p.id} />
          <div className="form-grid">
            <div className="field">
              <label htmlFor="p-cust">ลูกค้า</label>
              <select id="p-cust" name="customerId" defaultValue={p.customerId}>
                {custs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="p-sku">SKU</label><input id="p-sku" name="sku" defaultValue={p.sku} required /></div>
            <div className="field"><label htmlFor="p-name">ชื่อสินค้า</label><input id="p-name" name="name" defaultValue={p.name} required /></div>
            <div className="field">
              <label htmlFor="p-cat">หมวดหมู่</label>
              <select id="p-cat" name="categoryId" defaultValue={p.categoryId ?? ""}>
                <option value="">ไม่ระบุ</option>
                {opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="p-unit">หน่วย</label>
              <select id="p-unit" name="unit" defaultValue={p.unit}>{units.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="p-min">ขั้นต่ำ (0 = ไม่เตือน)</label><input id="p-min" name="minQty" type="number" min={0} defaultValue={p.minQty} /></div>
            <SubmitButton>บันทึก</SubmitButton>
          </div>
        </ActionForm>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>ตำแหน่ง</th><th className="num">จำนวน</th><th>รับเข้าล่าสุด</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={3} className="empty-row">ไม่มีในคลังตอนนี้</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono"><Link href={`/map?sel=${r.locationCode}`}>{r.locationCode}</Link></td>
                <td className="num">{r.qty} {p.unit}</td>
                <td>{thDate(r.receivedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card panel danger-zone">
        <h2>ลบสินค้า</h2>
        <ActionForm action={deleteProduct}>
          <input type="hidden" name="id" value={p.id} />
          <p className="meta" style={{ margin: 0 }}>ลบได้เฉพาะสินค้าที่ไม่มีในคลังและยังไม่เคยมีประวัติ</p>
          <SubmitButton className="btn danger" style={{ flex: "none", alignSelf: "flex-start" }}>ลบสินค้านี้</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
