// ทุกตารางเปิด RLS ไว้ (ไม่มี policy) เพื่อปิดการเข้าถึงผ่าน Supabase Data API แอปต่อด้วย role postgres ซึ่งข้าม RLS
import { date, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// คนที่ล็อกอินเข้าระบบ: admin จัดการผู้ใช้ได้, staff ใช้งานคลังได้อย่างเดียว
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "staff"] }).notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// ลูกค้าที่ฝากของในคลัง (phone ไม่แสดงในแอปแล้ว เก็บคอลัมน์ไว้เพื่อไม่ให้ข้อมูลเก่าหาย)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// หมวดหมู่สินค้า แอดมินตั้งเองได้ที่หน้าตั้งค่า
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// หน่วยนับที่เลือกได้ตอนเพิ่มสินค้า (สินค้าเก็บเป็นชื่อหน่วย)
export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
}).enableRLS();

// สินค้าของลูกค้าแต่ละราย (SKU ห้ามซ้ำทั้งระบบ)
// minQty = จำนวนขั้นต่ำ ถ้าคงเหลือรวมต่ำกว่านี้จะขึ้นเตือนที่แดชบอร์ด (0 = ไม่เตือน)
// customsNo = เลขที่ใบขนสินค้า, containerNo = หมายเลขตู้คอนเทนเนอร์ (ไม่บังคับกรอก)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  categoryId: integer("category_id").references(() => categories.id),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("ลัง"),
  minQty: integer("min_qty").notNull().default(0),
  customsNo: text("customs_no").notNull().default(""),
  containerNo: text("container_no").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("products_category_id_idx").on(t.categoryId)]).enableRLS();

// ตำแหน่งพาเลทในคลัง เช่น AA-01-0106 = แร็ค AA · Bay 01 · พาเลท 01 · ชั้น 06
export const locations = pgTable("locations", {
  code: text("code").primaryKey(),
  zone: text("zone").notNull(),
  rack: text("rack").notNull(),
  bay: integer("bay").notNull(),
  pallet: integer("pallet").notNull(),
  level: integer("level").notNull(),
}).enableRLS();

// ของที่วางอยู่บนตำแหน่ง (1 ตำแหน่งมีได้หลายสินค้า แต่ต้องเป็นลูกค้าคนเดียวกัน)
export const stock = pgTable(
  "stock",
  {
    id: serial("id").primaryKey(),
    locationCode: text("location_code").notNull().references(() => locations.code),
    productId: integer("product_id").notNull().references(() => products.id),
    qty: integer("qty").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    receivedBy: integer("received_by").references(() => users.id),
  },
  (t) => [uniqueIndex("stock_location_product").on(t.locationCode, t.productId)],
).enableRLS();

// การจองตำแหน่งว่างไว้ให้ลูกค้า (1 ตำแหน่งจองได้ครั้งละ 1 ราย)
export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  locationCode: text("location_code").notNull().unique().references(() => locations.code),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  eta: date("eta"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// ใบเบิก: การเบิกหนึ่งครั้ง (หลายตำแหน่งได้) ของลูกค้าหนึ่งราย
export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  note: text("note").notNull().default(""),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// ประวัติทุกการเคลื่อนไหว ใช้ทำหน้า รับเข้า/เบิกออก และประวัติตำแหน่ง
export const movements = pgTable("movements", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: ["IN", "OUT", "MOVE", "RESERVE", "CANCEL"] }).notNull(),
  locationCode: text("location_code").notNull(),
  toLocationCode: text("to_location_code"),
  customerId: integer("customer_id").references(() => customers.id),
  productId: integer("product_id").references(() => products.id),
  qty: integer("qty"),
  note: text("note").notNull().default(""),
  withdrawalId: integer("withdrawal_id").references(() => withdrawals.id),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export type Role = (typeof users.$inferSelect)["role"];
export type MovementType = (typeof movements.$inferSelect)["type"];
