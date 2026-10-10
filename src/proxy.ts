import { type NextRequest, NextResponse } from "next/server";

/**
 * Pemeriksaan optimistis sebelum halaman dirender: area pengawas / admin
 * tanpa cookie sesi yang sesuai langsung diarahkan ke halaman masuknya
 * dengan `next` = halaman yang diminta (path lengkap, termasuk query).
 * Pemeriksaan sesungguhnya tetap di server (requirePengawas / requireAdmin)
 * — cookie ada belum tentu sesinya sah.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/ruangan") && !request.cookies.has(SESSION_COOKIE)) {
    return toLogin(request, "/masuk", pathname + search);
  }
  if (pathname.startsWith("/admin") && request.cookies.get(ROLE_COOKIE)?.value !== "admin") {
    return toLogin(request, "/masuk/admin", pathname + search);
  }
  return NextResponse.next();
}

function toLogin(request: NextRequest, loginPath: string, next: string) {
  const login = new URL(loginPath, request.url);
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

// Cookie sesi stub. Diganti cookie sesi Better Auth saat login asli dibuat.
const SESSION_COOKIE = "lrp_stub_user";
const ROLE_COOKIE = "lrp_stub_role";

export const config = {
  matcher: ["/ruangan", "/ruangan/:path*", "/admin", "/admin/:path*"],
};
