"use server";

import { assertAdminAction, getAdminSession } from "@/lib/admin-session";
import { recordAudit } from "@/server/audit";
import { kickDriveQueue, queueExistingProofs, retryFailedUploads } from "@/server/drive-sync";
import { disconnectDrive, driveConnection } from "@/server/google-drive";

export type DriveActionResult = { ok: true; message: string } | { ok: false; error: string };

async function guard(): Promise<DriveActionResult | null> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  if (!driveConnection().connected) return { ok: false, error: "Google Drive belum terhubung." };
  return null;
}

/** Kirim ulang foto yang gagal. */
export async function retryDriveAction(): Promise<DriveActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const n = retryFailedUploads();
  return { ok: true, message: n ? `${n} foto dikirim ulang di latar belakang.` : "Tidak ada foto yang gagal." };
}

/** Antrekan foto bukti yang sudah ada tetapi belum pernah dikirim. */
export async function syncExistingDriveAction(): Promise<DriveActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const n = queueExistingProofs();
  kickDriveQueue();
  return { ok: true, message: n ? `${n} foto ditambahkan ke antrean.` : "Semua foto sudah masuk antrean / terkirim." };
}

/** Putuskan koneksi (foto yang sudah di Drive tetap ada di sana). */
export async function disconnectDriveAction(): Promise<DriveActionResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  disconnectDrive();
  const admin = await getAdminSession();
  recordAudit({ actorId: admin?.userId ?? null, action: "drive.disconnect", entity: "drive", entityId: null, summary: "Koneksi Google Drive diputuskan." });
  return { ok: true, message: "Koneksi Google Drive diputuskan." };
}
