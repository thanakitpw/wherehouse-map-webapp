import { asc, countDistinct, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { createProduct } from "@/app/actions/products";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { getDb } from "@/db";
import { customers, products, stock } from "@/db/schema";
import { UNITS } from "@/lib/format";

export const metadata: Metadata = { title: "สินค้า" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { customer } = await searchParams;
  const customerId = Number(customer) || undefined;
  const db = await getDb();
  const [custs, list] = await Promise.all([
    db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(asc(customers.name)),
    db
      .select({
        id: products.id, sku: products.sku, name: products.name, unit: products.unit,
        customerId: customers.id, customer: customers.name,
        qty: sql<number>`coalesce(sum(${stock.qty}), 0)::int`,
        positions: countDistinct(stock.locationCode),
      })
      .from(products)
      .innerJoin(customers, eq(products.customerId, customers.id))
      .leftJoin(stock, eq(stock.productId, products.id))
      .where(customerId ? eq(products.customerId, customerId) : undefined)
      .groupBy(products.id, customers.id)
      .orderBy(asc(customers.name), asc(products.name)),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>สินค้า</h1><p>สินค้าของลูกค้าทุกราย {list.length} รายการ</p></div>
      </div>

      <div className="card panel">
        <h2>เพิ่มสินค้า</h2>
        {custs.length === 0 ? (
          <p className="meta" style={{ margin: 0 }}>เพิ่ม <Link href="/customers">ลูกค้า</Link> ก่อน แล้วค่อยเพิ่มสินค้า</p>
        ) : (
          <ActionForm action={createProduct} resetOnOk>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="p-cust">ลูกค้า</label>
                <select id="p-cust" name="customerId" defaultValue={customerId ?? custs[0].id}>
                  {custs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="p-sku">SKU</label><input id="p-sku" name="sku" required placeholder="เช่น MLI-SUN50" /></div>
              <div className="field"><label htmlFor="p-name">ชื่อสินค้า</label><input id="p-name" name="name" required /></div>
              <div className="field">
                <label htmlFor="p-unit">หน่วย</label>
                <select id="p-unit" name="unit">{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
              </div>
              <SubmitButton>เพิ่มสินค้า</SubmitButton>
            </div>
          </ActionForm>
        )}
      </div>

      <div className="filters">
        <Link href="/products" aria-current={!customerId ? "page" : undefined}>ทุกลูกค้า</Link>
        {custs.map((c) => (
          <Link key={c.id} href={`/products?customer=${c.id}`} aria-current={customerId === c.id ? "page" : undefined}>{c.name}</Link>
        ))}
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>SKU</th><th>ชื่อสินค้า</th><th>ลูกค้า</th><th className="num">คงเหลือ</th><th className="num">ตำแหน่ง</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="empty-row">ยังไม่มีสินค้า</td></tr>}
            {list.map((p) => (
              <tr key={p.id}>
                <td className="mono"><Link href={`/products/${p.id}`}>{p.sku}</Link></td>
                <td>{p.name}</td>
                <td>{p.customer}</td>
                <td className="num">{p.qty.toLocaleString()} {p.unit}</td>
                <td className="num">{p.positions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
