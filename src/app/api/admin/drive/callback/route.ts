import { withAdmin } from "@/server/admin-api";
import { recordAudit } from "@/server/audit";
import { DRIVE_STATE_COOKIE, driveRedirectUri, readCookie, redirectTo, stateCookie } from "@/server/drive-oauth";
import { queueExistingProofs } from "@/server/drive-sync";
import { connectDrive } from "@/server/google-drive";

/**
 * GET /api/admin/drive/callback — Google mengembalikan admin ke sini setelah
 * memberi izin. Simpan koneksi, buat folder utama, lalu kirim foto yang sudah ada.
 */
export const GET = withAdmin(async (request, _params, admin) => {
  const url = new URL(request.url);
  const clear = stateCookie("", request);
  const fail = (message: string) => redirectTo(`/admin/drive?error=${encodeURIComponent(message)}`, clear);

  if (url.searchParams.get("error")) return fail("Izin Google dibatalkan.");
  const state = url.searchParams.get("state");
  if (!state || state !== readCookie(request, DRIVE_STATE_COOKIE)) return fail("Sesi penghubungan kedaluwarsa. Coba lagi.");
  const code = url.searchParams.get("code");
  if (!code) return fail("Kode persetujuan tidak ada.");

  try {
    await connectDrive(code, driveRedirectUri(request));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Gagal menghubungkan Google Drive.");
  }
  recordAudit({ actorId: admin.id, action: "drive.connect", entity: "drive", entityId: null, summary: "Google Drive dihubungkan untuk salinan foto bukti." });
  queueExistingProofs();
  return redirectTo("/admin/drive?ok=1", clear);
});
