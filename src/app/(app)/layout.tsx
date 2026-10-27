import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { BrandMark } from "@/components/Brand";
import { NavLinks } from "@/components/NavLinks";
import { requireUser } from "@/lib/session";

// ทุกหน้าหลังล็อกอินอ่านข้อมูลสดจากฐานข้อมูล ไม่ต้อง prerender
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links = [
    { href: "/dashboard", label: "แดชบอร์ด" },
    { href: "/map", label: "ผังคลัง" },
    { href: "/withdraw", label: "เบิกสินค้า" },
    { href: "/movements", label: "ประวัติเคลื่อนไหว" },
    { href: "/customers", label: "ลูกค้า" },
    { href: "/products", label: "สินค้า" },
    { href: "/reports", label: "รายงาน" },
    ...(user.role === "admin"
      ? [{ href: "/settings", label: "ตั้งค่า" }, { href: "/users", label: "ผู้ใช้" }]
      : []),
  ];
  return (
    <>
      <header className="topnav">
        <Link href="/dashboard" className="brand" style={{ color: "inherit", textDecoration: "none" }}>
          <BrandMark />
          Warehouse Map
        </Link>
        <NavLinks links={links} />
        <div className="me">
          <Link href="/m" style={{ fontSize: 14 }}>มุมมองมือถือ</Link>
          <div className="avatar">{user.name.slice(0, 2)}</div>
          {user.name}
          <form action={logout}>
            <button type="submit" className="logout">ออกจากระบบ</button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
