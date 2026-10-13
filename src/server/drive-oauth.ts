import { publicBaseUrl } from "@/server/better-auth";

export const DRIVE_STATE_COOKIE = "drive_oauth_state";

/** Alamat kembali dari Google; harus sama persis dengan "Authorized redirect URI" di Google Cloud. */
export function driveRedirectUri(request: Request) {
  return `${publicBaseUrl() ?? new URL(request.url).origin}/api/admin/drive/callback`;
}

export function redirectTo(location: string, cookie?: string) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export function readCookie(request: Request, name: string) {
  const match = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function stateCookie(value: string, request: Request) {
  const secure = new URL(driveRedirectUri(request)).protocol === "https:" ? "; Secure" : "";
  return `${DRIVE_STATE_COOKIE}=${value}; Path=/api/admin/drive; HttpOnly; SameSite=Lax; Max-Age=${value ? 600 : 0}${secure}`;
}
