// ข้อมูลที่ส่งจาก server ไปให้หน้าผังคลัง (ต้องเป็น JSON ธรรมดา)
export type SlotStatus = "occ" | "res" | "empty";

export type SlotItem = { stockId: number; productId: number; name: string; sku: string; qty: number; unit: string };

export type Slot = {
  code: string;
  rack: string;
  bay: number;
  pallet: number;
  level: number;
  status: SlotStatus;
  customer: { id: number; name: string; phone: string } | null;
  items: SlotItem[];
  receivedAt: string | null;
  receivedBy: string | null;
  eta: string | null;
};

export type CustomerOption = {
  id: number;
  name: string;
  products: { id: number; name: string; sku: string; unit: string }[];
};

export type HistoryRow = { id: number; title: string; detail: string };

export type ActionResult = { error?: string; ok?: string };
