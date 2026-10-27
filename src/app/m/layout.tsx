import { requireUser } from "@/lib/session";

// ทุกหน้าหลังล็อกอินอ่านข้อมูลสดจากฐานข้อมูล ไม่ต้อง prerender
export const dynamic = "force-dynamic";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
