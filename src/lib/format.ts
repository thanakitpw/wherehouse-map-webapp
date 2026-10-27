const dateFmt = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
const dateTimeFmt = new Intl.DateTimeFormat("th-TH", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok",
});

export const thDate = (d: Date | string) => dateFmt.format(typeof d === "string" ? new Date(d) : d);
export const thDateTime = (d: Date | string) => dateTimeFmt.format(typeof d === "string" ? new Date(d) : d);

export const MOVEMENT_LABEL: Record<string, string> = {
  IN: "รับเข้า",
  OUT: "เบิกออก",
  MOVE: "ย้ายตำแหน่ง",
  RESERVE: "จองตำแหน่ง",
  CANCEL: "ยกเลิกจอง",
};

// เลขที่ใบเบิก เช่น WD-00012
export const docNo = (id: number) => `WD-${String(id).padStart(5, "0")}`;
