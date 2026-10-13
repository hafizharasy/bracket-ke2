// Antrean salinan foto bukti ke Google Drive. Foto selalu disimpan dulu di
// server (UPLOAD_DIR); salinan ke Drive berjalan di latar belakang sehingga
// input hasil pengawas tidak pernah menunggu atau gagal karena Drive.

import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { driveUploads, matches, matchResultHistory, matchResults, participants, rooms, sessions } from "@/db/schema";
import { FINAL_ROUND, roundLabel, SEMIFINAL_ROUND, WIN_TYPES, type WinType } from "@/lib/bracket";
import { formatPoints } from "@/lib/final-standings";
import { DriveError, driveConnection, ensureFolderPath, setDriveError, uploadToDrive } from "@/server/google-drive";
import { readProofPhoto } from "@/server/storage";

/** Percobaan maksimal per foto sebelum menunggu "Kirim ulang" dari admin. */
export const MAX_ATTEMPTS = 5;

const fileNameOf = (proofUrl: string) => proofUrl.slice(proofUrl.lastIndexOf("/") + 1);
// Waktu WIB yang urut bila diurutkan per nama, mis. "2026-10-13 14.05.32 WIB".
const wibTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
export const formatWib = (date: Date) => `${wibTime.format(date).replace(/:/g, ".")} WIB`;

const safe = (text: string) => text.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();

/**
 * Masukkan foto bukti laga ke antrean lalu jalankan pengiriman di latar
 * belakang. Tidak melakukan apa pun bila Drive belum terhubung.
 */
export function queueProofForDrive(matchId: string, proofUrl: string) {
  try {
    if (!driveConnection().connected) return;
    db.insert(driveUploads).values({ fileName: fileNameOf(proofUrl), matchId }).onConflictDoNothing().run();
    kickDriveQueue();
  } catch (error) {
    console.error("[drive] gagal mengantrekan foto:", error);
  }
}

/** Antrekan semua foto bukti yang sudah ada tetapi belum pernah dikirim. */
export function queueExistingProofs() {
  const rows = db.select({ matchId: matchResults.matchId, url: matchResults.proofPhotoUrl }).from(matchResults).all();
  let added = 0;
  for (const r of rows) {
    added += db.insert(driveUploads).values({ fileName: fileNameOf(r.url), matchId: r.matchId }).onConflictDoNothing().run().changes;
  }
  kickDriveQueue();
  return added;
}

/** Kembalikan foto yang gagal ke antrean (percobaan diulang dari nol). */
export function retryFailedUploads() {
  const n = db
    .update(driveUploads)
    .set({ status: "pending", attempts: 0, error: null, updatedAt: new Date() })
    .where(eq(driveUploads.status, "failed"))
    .run().changes;
  setDriveError(null);
  kickDriveQueue();
  return n;
}

export function driveQueueStatus() {
  const counts = db
    .select({ status: driveUploads.status, n: sql<number>`count(*)` })
    .from(driveUploads)
    .groupBy(driveUploads.status)
    .all();
  const by = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const failures = db
    .select({ fileName: driveUploads.fileName, matchId: driveUploads.matchId, error: driveUploads.error, attempts: driveUploads.attempts })
    .from(driveUploads)
    .where(eq(driveUploads.status, "failed"))
    .orderBy(asc(driveUploads.updatedAt))
    .limit(20)
    .all();
  const notQueued = db
    .select({ n: sql<number>`count(*)` })
    .from(matchResults)
    .where(sql`not exists (select 1 from drive_uploads d where d.match_id = ${matchResults.matchId} and d.file_name = substr(${matchResults.proofPhotoUrl}, 12))`)
    .get()!.n;
  return { done: by("done"), pending: by("pending"), failed: by("failed"), notQueued, failures };
}

/** Tautan Drive foto bukti terbaru sebuah laga (null bila belum tersalin). */
export function driveLinkForMatch(matchId: string) {
  return (
    db
      .select({ link: driveUploads.webViewLink })
      .from(driveUploads)
      .where(and(eq(driveUploads.matchId, matchId), eq(driveUploads.status, "done")))
      .orderBy(sql`${driveUploads.updatedAt} desc`)
      .get()?.link ?? null
  );
}

/** Folder & nama berkas Drive yang mudah dibaca untuk satu laga. */
export function drivePlacement(matchId: string, fileName: string) {
  const m = db.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!m) return null;
  const session = db.select({ name: sessions.name }).from(sessions).where(eq(sessions.id, m.sessionId)).get()?.name ?? m.sessionId;
  const room = db.select({ name: rooms.name }).from(rooms).where(eq(rooms.id, m.roomId)).get()?.name ?? m.roomId;
  const ids = [m.participantAId, m.participantBId].filter((x): x is string => !!x);
  const names = new Map(
    ids.length ? db.select({ id: participants.id, name: participants.name }).from(participants).where(inArray(participants.id, ids)).all().map((p) => [p.id, p.name]) : [],
  );
  const a = (m.participantAId && names.get(m.participantAId)) || "?";
  const b = (m.participantBId && names.get(m.participantBId)) || "?";
  const folders =
    m.round === SEMIFINAL_ROUND ? ["Semifinal"] : m.round === FINAL_ROUND ? ["Final"] : [safe(session), safe(room)];
  const result =
    m.round === FINAL_ROUND && m.winnerId && m.winType
      ? `menang ${names.get(m.winnerId) ?? "?"} +${formatPoints(WIN_TYPES[m.winType as WinType]?.points ?? 0)}`
      : m.scoreA !== null && m.scoreB !== null
        ? `${m.scoreA}-${m.scoreB}`
        : "";
  const ext = fileName.split(".").pop() ?? "jpg";
  // Waktu foto dikirim pengawas (hasil pertama yang memakai foto ini); tiap koreksi beda waktu.
  const sentAt =
    db
      .select({ at: matchResultHistory.recordedAt })
      .from(matchResultHistory)
      .where(and(eq(matchResultHistory.matchId, matchId), eq(matchResultHistory.proofPhotoUrl, `/api/bukti/${fileName}`)))
      .orderBy(asc(matchResultHistory.recordedAt))
      .get()?.at ??
    db.select({ at: matchResults.recordedAt }).from(matchResults).where(eq(matchResults.matchId, matchId)).get()?.at ??
    new Date();
  const name = safe(
    `Laga ${String(m.matchNumber).padStart(2, "0")} - ${roundLabel(m.round)} - ${a} vs ${b}${result ? ` (${result})` : ""} - ${formatWib(sentAt)}`,
  );
  return { folders, name: `${name}.${ext}` };
}

let running: Promise<void> | null = null;

/** Jalankan pengiriman antrean di latar belakang (satu proses sekaligus). */
export function kickDriveQueue() {
  if (running) return running;
  running = processDriveQueue()
    .catch((error) => console.error("[drive] antrean berhenti:", error))
    .finally(() => {
      running = null;
    });
  return running;
}

/** Kirim foto yang menunggu, satu per satu. Berhenti bila koneksi Drive tidak sah. */
export async function processDriveQueue(fetchImpl: typeof fetch = fetch) {
  if (!driveConnection().connected) return;
  for (;;) {
    const next = db
      .select()
      .from(driveUploads)
      .where(or(eq(driveUploads.status, "pending"), and(eq(driveUploads.status, "failed"), lt(driveUploads.attempts, MAX_ATTEMPTS))))
      .orderBy(asc(driveUploads.createdAt))
      .limit(1)
      .get();
    if (!next) return;
    try {
      const placement = drivePlacement(next.matchId, next.fileName);
      const photo = await readProofPhoto(next.fileName);
      if (!placement || !photo) throw new Error("Berkas foto tidak ditemukan di server.");
      const folderId = await ensureFolderPath(placement.folders, fetchImpl);
      const file = await uploadToDrive(folderId, placement.name, new Uint8Array(photo.bytes), photo.type, fetchImpl);
      db.update(driveUploads)
        .set({ status: "done", driveFileId: file.id, webViewLink: file.webViewLink ?? null, error: null, updatedAt: new Date() })
        .where(eq(driveUploads.fileName, next.fileName))
        .run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const authProblem = error instanceof DriveError && error.auth;
      db.update(driveUploads)
        .set({
          status: "failed",
          // Masalah izin bukan salah fotonya: jangan habiskan jatah percobaan.
          attempts: authProblem ? next.attempts : next.attempts + 1,
          error: message.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(driveUploads.fileName, next.fileName))
        .run();
      if (authProblem) {
        setDriveError(message);
        return;
      }
      // Jeda singkat sebelum percobaan berikutnya (mis. jaringan putus sesaat).
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
