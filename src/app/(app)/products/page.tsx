import { and, asc, countDistinct, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { createProduct } from "@/app/actions/products";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { getDb } from "@/db";
import { categories, customers, products, stock } from "@/db/schema";
import { getProductOptions } from "@/lib/catalog";

export const metadata: Metadata = { title: "สินค้า" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { customer, category } = await searchParams;
  const customerId = Number(customer) || undefined;
  const categoryId = Number(category) || undefined;
  const db = getDb();
  const [custs, opts, list] = await Promise.all([
    db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(asc(customers.name)),
    getProductOptions(),
    db
      .select({
        id: products.id, sku: products.sku, name: products.name, unit: products.unit, minQty: products.minQty,
        customsNo: products.customsNo, containerNo: products.containerNo,
        customerId: customers.id, customer: customers.name, category: categories.name,
        qty: sql<number>`coalesce(sum(${stock.qty}), 0)::int`,
        positions: countDistinct(stock.locationCode),
      })
      .from(products)
      .innerJoin(customers, eq(products.customerId, customers.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(stock, eq(stock.productId, products.id))
      .where(and(
        customerId ? eq(products.customerId, customerId) : undefined,
        categoryId ? eq(products.categoryId, categoryId) : undefined,
      ))
      .groupBy(products.id, customers.id, categories.id)
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
                <label htmlFor="p-cat">หมวดหมู่</label>
                <select id="p-cat" name="categoryId" defaultValue="">
                  <option value="">ไม่ระบุ</option>
                  {opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-unit">หน่วย</label>
                <select id="p-unit" name="unit">{opts.units.map((u) => <option key={u}>{u}</option>)}</select>
              </div>
              <div className="field"><label htmlFor="p-min">ขั้นต่ำ (0 = ไม่เตือน)</label><input id="p-min" name="minQty" type="number" min={0} defaultValue={0} /></div>
              <div className="field"><label htmlFor="p-customs">เลขที่ใบขน</label><input id="p-customs" name="customsNo" className="mono" placeholder="เช่น A0301630710001" /></div>
              <div className="field"><label htmlFor="p-container">หมายเลขตู้คอนเทนเนอร์</label><input id="p-container" name="containerNo" className="mono" placeholder="เช่น LEOU1234567" /></div>
              <SubmitButton>เพิ่มสินค้า</SubmitButton>
            </div>
          </ActionForm>
        )}
      </div>

      {categoryId && (
        <p className="meta" style={{ margin: 0 }}>
          หมวดหมู่ {opts.categories.find((c) => c.id === categoryId)?.name ?? "–"} · <Link href="/products">ดูทุกหมวดหมู่</Link>
        </p>
      )}

      <div className="filters">
        <Link href="/products" aria-current={!customerId ? "page" : undefined}>ทุกลูกค้า</Link>
        {custs.map((c) => (
          <Link key={c.id} href={`/products?customer=${c.id}`} aria-current={customerId === c.id ? "page" : undefined}>{c.name}</Link>
        ))}
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>SKU</th><th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>ลูกค้า</th><th>เลขที่ใบขน</th><th>เลขตู้</th><th className="num">คงเหลือ</th><th className="num">ตำแหน่ง</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={8} className="empty-row">ยังไม่มีสินค้า</td></tr>}
            {list.map((p) => (
              <tr key={p.id}>
                <td className="mono"><Link href={`/products/${p.id}`}>{p.sku}</Link></td>
                <td>{p.name}</td>
                <td>{p.category ?? "–"}</td>
                <td>{p.customer}</td>
                <td className="mono">{p.customsNo || "–"}</td>
                <td className="mono">{p.containerNo || "–"}</td>
                <td className="num">
                  {p.minQty > 0 && p.qty < p.minQty && <span className="tag low" style={{ marginRight: 8 }}>ต่ำกว่าขั้นต่ำ</span>}
                  {p.qty.toLocaleString()} {p.unit}
                </td>
                <td className="num">{p.positions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
