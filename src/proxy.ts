import { NextResponse, type NextRequest } from "next/server";

// เช็คแบบเร็ว: ไม่มี cookie ก็พาไปหน้า login ก่อน (ตรวจ token จริงอีกครั้งใน layout)
export function proxy(req: NextRequest) {
  if (!req.cookies.get("session")?.value) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|prototype|_next/static|_next/image|favicon.ico).*)"],
};
