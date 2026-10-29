import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { thDate } from "@/lib/format";
import { pad, RACKS } from "@/lib/layout";
import { STATUS_TEXT } from "@/lib/search";
import { getCurrentUser } from "@/lib/session";
import { getSlots } from "@/lib/warehouse";

// ดาวน์โหลดผังคลังเป็นไฟล์ Excel: 1 แถวต่อสินค้า 1 รายการบนตำแหน่ง (ตำแหน่งว่าง/จอง = 1 แถว)
// ?rack=AA เอาเฉพาะแร็คนั้น
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const rack = req.nextUrl.searchParams.get("rack");
  const onlyRack = RACKS.find((r) => r === rack);
  const slots = (await getSlots()).filter((s) => !onlyRack || s.rack === onlyRack);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(onlyRack ? `แร็ค ${onlyRack}` : "ผังคลัง", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "ตำแหน่ง", key: "code", width: 14 },
    { header: "แร็ค", key: "rack", width: 7 },
    { header: "Bay", key: "bay", width: 6 },
    { header: "พาเลท", key: "pallet", width: 7 },
    { header: "ชั้น", key: "level", width: 6 },
    { header: "สถานะ", key: "status", width: 10 },
    { header: "ลูกค้า", key: "customer", width: 24 },
    { header: "SKU", key: "sku", width: 14 },
    { header: "สินค้า", key: "name", width: 26 },
    { header: "จำนวน", key: "qty", width: 9 },
    { header: "หน่วย", key: "unit", width: 8 },
    { header: "เลขที่ใบขน", key: "customsNo", width: 18 },
    { header: "หมายเลขตู้คอนเทนเนอร์", key: "containerNo", width: 20 },
    { header: "รับเข้าล่าสุด", key: "receivedAt", width: 14 },
    { header: "คาดว่าสินค้าเข้า", key: "eta", width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: "A1", to: "O1" };

  for (const s of slots) {
    const base = {
      code: s.code, rack: s.rack, bay: pad(s.bay), pallet: pad(s.pallet), level: pad(s.level),
      status: STATUS_TEXT[s.status], customer: s.customer?.name ?? "",
      receivedAt: s.receivedAt ? thDate(s.receivedAt) : "", eta: s.eta ? thDate(s.eta) : "",
    };
    if (!s.items.length) ws.addRow(base);
    for (const it of s.items) {
      ws.addRow({ ...base, sku: it.sku, name: it.name, qty: it.qty, unit: it.unit, customsNo: it.customsNo, containerNo: it.containerNo });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
  const name = `warehouse-${onlyRack ?? "all"}-${day}.xlsx`;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
