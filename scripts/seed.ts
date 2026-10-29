// เตรียมข้อมูลเริ่มต้น: ตำแหน่ง 1,080 ช่องของ Zone A, ผู้ใช้ admin/staff และ (ถ้ายังไม่มีลูกค้า) ข้อมูลตัวอย่าง
// รัน: npm run db:seed   (ต้องรัน npm run db:push ก่อน)
import bcrypt from "bcryptjs";
import { count } from "drizzle-orm";
import { getDb } from "../src/db";
import { categories, customers, locations, movements, products, reservations, stock, units, users } from "../src/db/schema";
import { allLocations } from "../src/lib/layout";

const UNITS = ["ลัง", "ชิ้น", "กล่อง", "กระสอบ", "แพ็ก"];

const SAMPLE = [
  { name: "ร้านมะลิ คอสเมติก", cat: "เครื่องสำอาง", prods: [["ครีมกันแดด SPF50", "MLI-SUN50"], ["เซรั่มวิตามินซี", "MLI-VC30"], ["สบู่สมุนไพร", "MLI-SOAP"]] },
  { name: "บจก. ทองดี ซัพพลาย", cat: "วัสดุก่อสร้าง", prods: [["น็อตสแตนเลส M8", "TD-NUT-M8"], ["ท่อ PVC 1 นิ้ว", "TD-PVC-1"], ["กาวยาแนว", "TD-GROUT"]] },
  { name: "ShopKit Online", cat: "บรรจุภัณฑ์", prods: [["กล่องพัสดุ เบอร์ D", "SK-BOX-D"], ["เทปใส OPP", "SK-TAPE"], ["บับเบิ้ลกันกระแทก", "SK-BUBBLE"]] },
  { name: "คุณสมพร ของแต่งบ้าน", cat: "ของแต่งบ้าน", prods: [["แจกันเซรามิก", "SP-VASE"], ["โคมไฟหวาย", "SP-LAMP"], ["หมอนอิงลินิน", "SP-PILLOW"]] },
  { name: "ฟาร์มสุข อาหารแห้ง", cat: "อาหารแห้ง", prods: [["ข้าวหอมมะลิ 5 กก.", "FS-RICE5"], ["กล้วยอบ", "FS-BANANA"], ["ชาไทยผง", "FS-THAITEA"]] },
  { name: "Bangkok Gadget", cat: "อุปกรณ์อิเล็กทรอนิกส์", prods: [["หูฟังไร้สาย", "BG-EARBUD"], ["สายชาร์จ USB-C", "BG-USBC"], ["พาวเวอร์แบงก์", "BG-PB10K"]] },
];

function hash(s: string) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995); x ^= x >>> 15;
  return x >>> 0;
}

async function inChunks<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function main() {
  const db = getDb();

  const locs = allLocations();
  await inChunks(locs, 500, (c) => db.insert(locations).values(c).onConflictDoNothing());
  console.log(`locations: ${locs.length}`);

  const [admin] = await db
    .insert(users)
    .values({ username: "admin", name: "แอดมิน", role: "admin", passwordHash: await bcrypt.hash("admin1234", 10) })
    .onConflictDoNothing()
    .returning();
  await db
    .insert(users)
    .values({ username: "staff", name: "พนักงานคลัง", role: "staff", passwordHash: await bcrypt.hash("staff1234", 10) })
    .onConflictDoNothing();
  console.log("users: admin / admin1234, staff / staff1234");

  await db.insert(units).values(UNITS.map((name) => ({ name }))).onConflictDoNothing();

  const [{ n }] = await db.select({ n: count() }).from(customers);
  if (n > 0) {
    console.log("customers already exist, skip sample stock");
    return;
  }

  const prodIds: number[][] = [];
  const custIds: number[] = [];
  const cats = await db.insert(categories).values(SAMPLE.map((c) => ({ name: c.cat }))).onConflictDoNothing().returning();
  for (const c of SAMPLE) {
    const [row] = await db.insert(customers).values({ name: c.name, note: "ข้อมูลตัวอย่าง" }).returning();
    custIds.push(row.id);
    const categoryId = cats.find((x) => x.name === c.cat)?.id ?? null;
    const ps = await db
      .insert(products)
      .values(c.prods.map(([name, sku]) => ({ customerId: row.id, categoryId, name, sku, unit: "ลัง", minQty: 1500 })))
      .returning();
    prodIds.push(ps.map((p) => p.id));
  }

  const userId = admin?.id ?? null;
  const stockRows: (typeof stock.$inferInsert)[] = [];
  const resRows: (typeof reservations.$inferInsert)[] = [];
  const moveRows: (typeof movements.$inferInsert)[] = [];
  for (const l of locs) {
    const h = hash(l.code);
    const r = (h % 1000) / 1000;
    const ci = (h >>> 10) % SAMPLE.length;
    if (r < 0.58) {
      const day = 1 + ((h >>> 6) % 28);
      const receivedAt = new Date(Date.UTC(2026, 8 + ((h >>> 4) % 2), day, 2 + ((h >>> 9) % 8)));
      const i0 = (h >>> 14) % 3;
      const many = 1 + ((h >>> 17) % 2);
      for (let k = 0; k < many; k++) {
        const productId = prodIds[ci][(i0 + k) % 3];
        const qty = 4 + ((h >>> (19 + k * 3)) % 57);
        stockRows.push({ locationCode: l.code, productId, qty, receivedAt, receivedBy: userId });
        moveRows.push({ type: "IN", locationCode: l.code, customerId: custIds[ci], productId, qty, userId, createdAt: receivedAt });
      }
    } else if (r < 0.66) {
      const eta = `2026-10-${20 + ((h >>> 7) % 10)}`;
      resRows.push({ locationCode: l.code, customerId: custIds[ci], eta, createdBy: userId });
      moveRows.push({ type: "RESERVE", locationCode: l.code, customerId: custIds[ci], userId, note: "ข้อมูลตัวอย่าง" });
    }
  }
  await inChunks(stockRows, 300, (c) => db.insert(stock).values(c));
  await inChunks(resRows, 300, (c) => db.insert(reservations).values(c));
  await inChunks(moveRows, 300, (c) => db.insert(movements).values(c));
  console.log(`sample: ${SAMPLE.length} customers, ${stockRows.length} stock rows, ${resRows.length} reservations`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
