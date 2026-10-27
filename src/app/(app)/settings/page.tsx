import { asc, count, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { createCategory, createUnit, deleteCategory, deleteUnit, renameCategory, setMinQty } from "@/app/actions/settings";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { getDb } from "@/db";
import { categories, customers, products, stock, units } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "ตั้งค่า" };

const inlineInput = { height: 36, border: "1px solid #B9C5D1", borderRadius: 8, padding: "0 10px", minWidth: 0, fontSize: 15 } as const;

export default async function SettingsPage() {
  await requireAdmin();
  const db = getDb();
  const [cats, us, prods] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, n: count(products.id) })
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.name)),
    db
      .select({ id: units.id, name: units.name, n: count(products.id) })
      .from(units)
      .leftJoin(products, eq(products.unit, units.name))
      .groupBy(units.id)
      .orderBy(asc(units.id)),
    db
      .select({
        id: products.id, sku: products.sku, name: products.name, unit: products.unit, minQty: products.minQty,
        customer: customers.name, qty: sql<number>`coalesce(sum(${stock.qty}), 0)::int`,
      })
      .from(products)
      .innerJoin(customers, eq(products.customerId, customers.id))
      .leftJoin(stock, eq(stock.productId, products.id))
      .groupBy(products.id, customers.id)
      .orderBy(asc(customers.name), asc(products.name)),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>ตั้งค่า</h1><p>หลังบ้านสำหรับแอดมิน: หมวดหมู่ หน่วยนับ และจำนวนขั้นต่ำของสินค้า</p></div>
        <Link className="btn" style={{ flex: "none", display: "inline-flex", alignItems: "center" }} href="/users">จัดการผู้ใช้</Link>
      </div>

      <div className="filters">
        <a href="#categories">หมวดหมู่สินค้า</a>
        <a href="#units">หน่วยนับ</a>
        <a href="#min-qty">จำนวนขั้นต่ำ</a>
      </div>

      <div className="card panel" id="categories">
        <h2>หมวดหมู่สินค้า</h2>
        <ActionForm action={createCategory} resetOnOk>
          <div className="form-grid">
            <div className="field"><label htmlFor="c-name">ชื่อหมวดหมู่ใหม่</label><input id="c-name" name="name" required /></div>
            <SubmitButton>เพิ่มหมวดหมู่</SubmitButton>
          </div>
        </ActionForm>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ชื่อหมวดหมู่</th><th className="num">สินค้า</th><th></th></tr></thead>
            <tbody>
              {cats.length === 0 && <tr><td colSpan={3} className="empty-row">ยังไม่มีหมวดหมู่</td></tr>}
              {cats.map((c) => (
                <tr key={c.id}>
                  <td>
                    <ActionForm action={renameCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input name="name" defaultValue={c.name} required aria-label={`ชื่อหมวดหมู่ ${c.name}`} style={{ ...inlineInput, width: 220 }} />
                        <SubmitButton className="btn" style={{ height: 36, flex: "none" }}>บันทึก</SubmitButton>
                      </div>
                    </ActionForm>
                  </td>
                  <td className="num"><Link href={`/products?category=${c.id}`}>{c.n}</Link></td>
                  <td>
                    <ActionForm action={deleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton className="btn danger" style={{ height: 36, flex: "none", alignSelf: "flex-start" }}>ลบ</SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card panel" id="units">
        <h2>หน่วยนับ</h2>
        <ActionForm action={createUnit} resetOnOk>
          <div className="form-grid">
            <div className="field"><label htmlFor="u-name">ชื่อหน่วยใหม่</label><input id="u-name" name="name" required placeholder="เช่น ม้วน, ถุง" /></div>
            <SubmitButton>เพิ่มหน่วย</SubmitButton>
          </div>
        </ActionForm>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>หน่วย</th><th className="num">สินค้าที่ใช้</th><th></th></tr></thead>
            <tbody>
              {us.length === 0 && <tr><td colSpan={3} className="empty-row">ยังไม่มีหน่วยนับ</td></tr>}
              {us.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="num">{u.n}</td>
                  <td>
                    <ActionForm action={deleteUnit}>
                      <input type="hidden" name="id" value={u.id} />
                      <SubmitButton className="btn danger" style={{ height: 36, flex: "none", alignSelf: "flex-start" }}>ลบ</SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card panel" id="min-qty">
        <h2>จำนวนขั้นต่ำ</h2>
        <p className="meta" style={{ margin: 0 }}>ถ้าคงเหลือรวมทุกตำแหน่งต่ำกว่าขั้นต่ำ สินค้าจะขึ้นเตือนที่แดชบอร์ด ใส่ 0 ถ้าไม่ต้องการเตือน</p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>SKU</th><th>สินค้า</th><th>ลูกค้า</th><th className="num">คงเหลือ</th><th>ขั้นต่ำ</th></tr></thead>
            <tbody>
              {prods.length === 0 && <tr><td colSpan={5} className="empty-row">ยังไม่มีสินค้า</td></tr>}
              {prods.map((p) => (
                <tr key={p.id}>
                  <td className="mono"><Link href={`/products/${p.id}`}>{p.sku}</Link></td>
                  <td>{p.name}</td>
                  <td>{p.customer}</td>
                  <td className="num">
                    {p.minQty > 0 && p.qty < p.minQty && <span className="tag low" style={{ marginRight: 8 }}>ต่ำกว่าขั้นต่ำ</span>}
                    {p.qty.toLocaleString()} {p.unit}
                  </td>
                  <td>
                    <ActionForm action={setMinQty}>
                      <input type="hidden" name="id" value={p.id} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input name="minQty" type="number" min={0} required defaultValue={p.minQty} aria-label={`ขั้นต่ำของ ${p.name}`} style={{ ...inlineInput, width: 110, textAlign: "right" }} />
                        <SubmitButton className="btn" style={{ height: 36, flex: "none" }}>บันทึก</SubmitButton>
                      </div>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
