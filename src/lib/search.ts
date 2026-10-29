import type { Slot, SlotItem } from "./types";

export const STATUS_TEXT = { occ: "มีสินค้า", res: "จองแล้ว", empty: "ว่าง" } as const;

// คำค้นที่ขึ้นต้นด้วยรหัสแร็ค (aa–af) ถือว่าเป็นการค้นหาตำแหน่ง เช่น "AC-05" หรือ "ac05"
const CODE_Q = /^a[a-f](?:-|\d|$)/;

const itemMatches = (it: SlotItem, q: string) =>
  [it.name, it.sku, it.customsNo, it.containerNo].some((v) => v.toLowerCase().includes(q));

export function isHit(s: Slot, q: string) {
  if (!q) return false;
  if (CODE_Q.test(q)) return s.code.toLowerCase().replace(/-/g, "").startsWith(q.replace(/-/g, ""));
  if (s.status === "empty") return false;
  if (s.customer?.name.toLowerCase().includes(q)) return true;
  return s.items.some((it) => itemMatches(it, q));
}

export function matchedItem(s: Slot, q: string) {
  return s.items.find((it) => itemMatches(it, q)) ?? s.items[0];
}
