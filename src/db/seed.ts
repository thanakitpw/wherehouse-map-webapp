// ข้อมูลเริ่มต้นของฐานข้อมูลจำลอง: ตำแหน่ง 1,080 ช่องของ Zone A, ผู้ใช้ admin/staff และข้อมูลตัวอย่าง
import bcrypt from "bcryptjs";
import type { Db } from "./index";
import { customers, locations, movements, products, reservations, stock, users } from "./schema";
import { allLocations } from "../lib/layout";

const SAMPLE = [
  { name: "ร้านมะลิ คอสเมติก", phone: "081-234-1201", prods: [["ครีมกันแดด SPF50", "MLI-SUN50"], ["เซรั่มวิตามินซี", "MLI-VC30"], ["สบู่สมุนไพร", "MLI-SOAP"]] },
  { name: "บจก. ทองดี ซัพพลาย", phone: "02-123-4410", prods: [["น็อตสแตนเลส M8", "TD-NUT-M8"], ["ท่อ PVC 1 นิ้ว", "TD-PVC-1"], ["กาวยาแนว", "TD-GROUT"]] },
  { name: "ShopKit Online", phone: "092-345-7788", prods: [["กล่องพัสดุ เบอร์ D", "SK-BOX-D"], ["เทปใส OPP", "SK-TAPE"], ["บับเบิ้ลกันกระแทก", "SK-BUBBLE"]] },
  { name: "คุณสมพร ของแต่งบ้าน", phone: "089-456-3345", prods: [["แจกันเซรามิก", "SP-VASE"], ["โคมไฟหวาย", "SP-LAMP"], ["หมอนอิงลินิน", "SP-PILLOW"]] },
  { name: "ฟาร์มสุข อาหารแห้ง", phone: "061-567-9020", prods: [["ข้าวหอมมะลิ 5 กก.", "FS-RICE5"], ["กล้วยอบ", "FS-BANANA"], ["ชาไทยผง", "FS-THAITEA"]] },
  { name: "Bangkok Gadget", phone: "095-678-5561", prods: [["หูฟังไร้สาย", "BG-EARBUD"], ["สายชาร์จ USB-C", "BG-USBC"], ["พาวเวอร์แบงก์", "BG-PB10K"]] },
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

export async function seed(db: Db) {
  const locs = allLocations();
  await inChunks(locs, 500, (c) => db.insert(locations).values(c));

  const [admin] = await db
    .insert(users)
    .values({ username: "admin", name: "แอดมิน", role: "admin", passwordHash: await bcrypt.hash("admin1234", 10) })
    .returning();
  await db
    .insert(users)
    .values({ username: "staff", name: "พนักงานคลัง", role: "staff", passwordHash: await bcrypt.hash("staff1234", 10) });

  const prodIds: number[][] = [];
  const custIds: number[] = [];
  for (const c of SAMPLE) {
    const [row] = await db.insert(customers).values({ name: c.name, phone: c.phone, note: "ข้อมูลตัวอย่าง" }).returning();
    custIds.push(row.id);
    const ps = await db.insert(products).values(c.prods.map(([name, sku]) => ({ customerId: row.id, name, sku, unit: "ลัง" }))).returning();
    prodIds.push(ps.map((p) => p.id));
  }

  const userId = admin.id;
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
}
