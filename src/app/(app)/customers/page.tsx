import { asc, countDistinct, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { createCustomer } from "@/app/actions/customers";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { getDb } from "@/db";
import { customers, products, reservations, stock } from "@/db/schema";

export const metadata: Metadata = { title: "ลูกค้า" };

export default async function CustomersPage() {
  const db = getDb();
  const [list, used, reserved] = await Promise.all([
    db
      .select({ id: customers.id, name: customers.name, phone: customers.phone, products: countDistinct(products.id) })
      .from(customers)
      .leftJoin(products, eq(products.customerId, customers.id))
      .groupBy(customers.id)
      .orderBy(asc(customers.name)),
    db
      .select({ customerId: products.customerId, pallets: countDistinct(stock.locationCode) })
      .from(stock)
      .innerJoin(products, eq(stock.productId, products.id))
      .groupBy(products.customerId),
    db.select({ customerId: reservations.customerId, n: sql<number>`count(*)::int` }).from(reservations).groupBy(reservations.customerId),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>ลูกค้า</h1><p>ลูกค้าที่ฝากสินค้าในคลัง {list.length} ราย</p></div>
      </div>

      <div className="card panel">
        <h2>เพิ่มลูกค้า</h2>
        <ActionForm action={createCustomer} resetOnOk>
          <div className="form-grid">
            <div className="field"><label htmlFor="c-name">ชื่อลูกค้า / บริษัท</label><input id="c-name" name="name" required /></div>
            <div className="field"><label htmlFor="c-phone">เบอร์โทร</label><input id="c-phone" name="phone" /></div>
            <div className="field"><label htmlFor="c-note">หมายเหตุ</label><input id="c-note" name="note" /></div>
            <SubmitButton>เพิ่มลูกค้า</SubmitButton>
          </div>
        </ActionForm>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>ชื่อลูกค้า</th><th>เบอร์โทร</th><th className="num">สินค้า (SKU)</th><th className="num">พาเลทที่ใช้</th><th className="num">ที่จองไว้</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="empty-row">ยังไม่มีลูกค้า</td></tr>}
            {list.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/customers/${c.id}`}>{c.name}</Link></td>
                <td>{c.phone || "–"}</td>
                <td className="num">{c.products}</td>
                <td className="num">{used.find((u) => u.customerId === c.id)?.pallets ?? 0}</td>
                <td className="num">{reserved.find((r) => r.customerId === c.id)?.n ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
