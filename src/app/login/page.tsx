import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/Brand";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/map");
  const { next } = await searchParams;
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="brand"><BrandMark />Warehouse Map</div>
        <h1>เข้าสู่ระบบ</h1>
        <LoginForm next={typeof next === "string" ? next : "/map"} />
      </div>
    </div>
  );
}
