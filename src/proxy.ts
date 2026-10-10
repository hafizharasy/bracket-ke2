import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Pemeriksaan optimistis sebelum halaman dirender: area pengawas / admin
 * tanpa cookie sesi Better Auth langsung diarahkan ke halaman masuknya
 * dengan `next` = halaman yang diminta (path lengkap, termasuk query).
 * Pemeriksaan sesungguhnya (sesi sah, peran, ruangan) tetap di server
 * — requirePengawas / requireAdmin — karena cookie ada belum tentu sah.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const loginPath = pathname.startsWith("/admin") ? "/masuk/admin" : "/masuk";
  const login = new URL(loginPath, request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/ruangan", "/ruangan/:path*", "/admin", "/admin/:path*"],
};
