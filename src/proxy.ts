import { type NextRequest, NextResponse } from "next/server";

/**
 * Pemeriksaan optimistis sebelum halaman dirender: area pengawas tanpa
 * cookie sesi langsung diarahkan ke /masuk dengan `next` = halaman yang
 * diminta (path lengkap, termasuk query). Pemeriksaan sesungguhnya tetap
 * di server (requirePengawas) — cookie ada belum tentu sesinya sah.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/ruangan") && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/masuk", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

// Cookie sesi pengawas (stub). Diganti cookie sesi Better Auth saat login asli dibuat.
const SESSION_COOKIE = "lrp_stub_user";

export const config = {
  matcher: ["/ruangan", "/ruangan/:path*"],
};
