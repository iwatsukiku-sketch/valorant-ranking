import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * /input と /admin はスタッフ専用。
 * cookie "staff" が STAFF_TOKEN と一致しなければ /login に飛ばす。
 * /ranking は会場モニター用なので認証なしで見られる。
 */
export function middleware(req: NextRequest) {
  const token = process.env.STAFF_TOKEN;
  const cookie = req.cookies.get("staff")?.value;

  if (!token || cookie !== token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/input", "/admin"],
};
