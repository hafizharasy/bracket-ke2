import { withAdmin } from "@/server/admin-api";
import { driveRedirectUri, redirectTo, stateCookie } from "@/server/drive-oauth";
import { driveAuthUrl, driveCredentials } from "@/server/google-drive";

/** GET /api/admin/drive/connect — arahkan admin ke halaman persetujuan Google. */
export const GET = withAdmin(async (request) => {
  const creds = driveCredentials();
  if (!creds) return redirectTo("/admin/drive?error=belum-diatur");
  const state = crypto.randomUUID();
  return redirectTo(driveAuthUrl(creds.clientId, driveRedirectUri(request), state), stateCookie(state, request));
});
