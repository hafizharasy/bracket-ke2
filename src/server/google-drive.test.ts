import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { appSettings, driveUploads, matches, matchResultHistory, matchResults, users, participants, rooms, sessionRooms, sessions } from "@/db/schema";
import { mockBracket } from "@/lib/mock/bracket-data";
import { generateBracketStructure } from "@/server/bracket-structure";
import { clearUsers } from "@/test/db";
import { drivePlacement, formatWib, driveQueueStatus, MAX_ATTEMPTS, processDriveQueue, queueProofForDrive, resyncAllToDrive, retryFailedUploads } from "@/server/drive-sync";
import { connectDrive, disconnectDrive, driveAuthUrl, driveConnection, ensureFolderPath } from "@/server/google-drive";

vi.mock("@/server/storage", () => ({
  readProofPhoto: async (name: string) => (name.includes("hilang") ? null : { bytes: Buffer.from("foto"), type: "image/jpeg" }),
}));

/** Google palsu: mencatat panggilan dan menjawab sesuai URL. */
function fakeGoogle(opts: { refreshStatus?: number; uploadStatus?: number; existingFolders?: string[] } = {}) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  let folderSeq = 0;
  let fileSeq = 0;
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method ?? "GET", body: init.body });
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      const grant = new URLSearchParams(String(init.body)).get("grant_type");
      if (grant === "authorization_code") return json({ access_token: "akses-1", refresh_token: "segar-1", expires_in: 3600 });
      if (opts.refreshStatus && opts.refreshStatus !== 200) return json({ error: "invalid_grant" }, opts.refreshStatus);
      return json({ access_token: "akses-2", expires_in: 3600 });
    }
    if (url.includes("/drive/v3/about")) return json({ user: { emailAddress: "admin@gmail.com" } });
    if (url.includes("/upload/drive/v3/files")) {
      if (opts.uploadStatus && opts.uploadStatus !== 200) return json({ error: { message: "kuota penuh" } }, opts.uploadStatus);
      fileSeq++;
      return json({ id: `file-${fileSeq}`, webViewLink: `https://drive.google.com/file/d/file-${fileSeq}/view` });
    }
    if (url.includes("/drive/v3/files?q=")) {
      const q = decodeURIComponent(url.split("q=")[1].split("&")[0]);
      const hit = opts.existingFolders?.find((name) => q.includes(`name = '${name}'`));
      return json({ files: hit ? [{ id: `ada-${hit}` }] : [] });
    }
    if (url.includes("/drive/v3/files")) {
      folderSeq++;
      return json({ id: `folder-${folderSeq}`, webViewLink: `https://drive.google.com/drive/folders/folder-${folderSeq}` });
    }
    return json({ error: "tak dikenal" }, 404);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const roundOne = () => db.select().from(matches).where(eq(matches.round, 1)).all()[0];
const fileFor = (matchId: string) => `${matchId}-0f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b.jpg`;

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
  process.env.GOOGLE_DRIVE_CLIENT_ID = "klien-uji";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "rahasia-uji";
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});

afterAll(() => {
  delete process.env.GOOGLE_DRIVE_CLIENT_ID;
  delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  vi.useRealTimers();
});

beforeEach(() => {
  disconnectDrive();
  for (const table of [driveUploads, appSettings, matchResultHistory, matchResults, matches]) db.delete(table).run();
  clearUsers();
  for (const table of [participants, sessionRooms, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values(mockBracket.sessions.map((s) => ({ ...s, startTime: new Date(s.startTime!) }))).run();
  db.insert(rooms).values(mockBracket.rooms).run();
  db.insert(sessionRooms).values(mockBracket.sessionRooms).run();
  for (let i = 0; i < mockBracket.participants.length; i += 100) {
    db.insert(participants).values(mockBracket.participants.slice(i, i + 100)).run();
  }
  generateBracketStructure({}, null);
});

describe("koneksi Google Drive", () => {
  it("URL persetujuan meminta akses offline dengan izin drive.file saja", () => {
    const url = new URL(driveAuthUrl("klien", "https://contoh.app/api/admin/drive/callback", "acak"));
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("acak");
  });

  it("menghubungkan: menyimpan akun & membuat folder utama; memutus menghapus semuanya", async () => {
    expect(driveConnection()).toMatchObject({ configured: true, connected: false });
    const { fetchImpl } = fakeGoogle();
    await connectDrive("kode", "https://contoh.app/cb", fetchImpl);
    expect(driveConnection()).toMatchObject({
      connected: true,
      account: "admin@gmail.com",
      rootFolderLink: "https://drive.google.com/drive/folders/folder-1",
      lastError: null,
    });
    disconnectDrive();
    expect(driveConnection().connected).toBe(false);
    expect(db.select().from(appSettings).all()).toHaveLength(0);
  });

  it("memakai folder yang sudah ada dan menyimpan cache folder", async () => {
    const google = fakeGoogle({ existingFolders: ["Sesi 1"] });
    await connectDrive("kode", "https://contoh.app/cb", google.fetchImpl);
    const id = await ensureFolderPath(["Sesi 1", "Ruangan 1"], google.fetchImpl);
    expect(id).toBe("folder-2"); // "Sesi 1" ditemukan, "Ruangan 1" dibuat
    const before = google.calls.length;
    expect(await ensureFolderPath(["Sesi 1", "Ruangan 1"], google.fetchImpl)).toBe("folder-2");
    expect(google.calls.length).toBe(before);
  });
});

describe("formatWib", () => {
  it("menulis waktu WIB yang urut & aman untuk nama berkas", () => {
    expect(formatWib(new Date("2026-10-13T07:05:32Z"))).toBe("2026-10-13 14.05.32 WIB");
  });
});

describe("antrean foto bukti", () => {
  it("tidak mengantrekan apa pun bila Drive belum terhubung", () => {
    queueProofForDrive(roundOne().id, `/api/bukti/${fileFor(roundOne().id)}`);
    expect(db.select().from(driveUploads).all()).toHaveLength(0);
  });

  it("nama berkas & folder mudah dibaca", () => {
    const m = roundOne();
    const placement = drivePlacement(m.id, fileFor(m.id))!;
    expect(placement.folders).toHaveLength(2);
    expect(placement.name).toMatch(/^Laga 01 - .+ - .+ vs .+ - \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2} WIB\.jpg$/);
    expect(placement.name).not.toMatch(/[\\/:*?"<>|]/);
  });

  it("waktu di nama berkas = saat pengawas mengirim foto itu (WIB)", () => {
    const m = roundOne();
    db.insert(users).values({ id: "u-p", name: "Pengawas", email: "p@x", role: "pengawas", roomId: m.roomId }).run();
    db.insert(matchResultHistory)
      .values({
        id: "h1",
        matchId: m.id,
        roomId: m.roomId,
        action: "create",
        scoreA: 4,
        scoreB: 2,
        winnerId: m.participantAId!,
        proofPhotoUrl: `/api/bukti/${fileFor(m.id)}`,
        recordedBy: "u-p",
        recordedAt: new Date("2026-10-13T07:05:32Z"),
      })
      .run();
    expect(drivePlacement(m.id, fileFor(m.id))!.name).toMatch(/ - 2026-10-13 14\.05\.32 WIB\.jpg$/);
  });

  it("mengirim foto ke folder sesi/ruangan lalu menandai selesai", async () => {
    const google = fakeGoogle();
    await connectDrive("kode", "https://contoh.app/cb", google.fetchImpl);
    const m = roundOne();
    db.insert(driveUploads).values({ fileName: fileFor(m.id), matchId: m.id }).run();
    await processDriveQueue(google.fetchImpl);
    const row = db.select().from(driveUploads).get()!;
    expect(row).toMatchObject({ status: "done", driveFileId: "file-1", error: null });
    const upload = google.calls.find((c) => c.url.includes("/upload/"))!;
    const text = await new Response(upload.body as Blob).text();
    expect(text).toContain('"parents":["folder-3"]'); // root=1, sesi=2, ruangan=3
    expect(driveQueueStatus()).toMatchObject({ done: 1, pending: 0, failed: 0 });
  });

  it("foto hilang dicoba ulang sampai batas lalu berhenti; kirim ulang mereset percobaan", async () => {
    const google = fakeGoogle();
    await connectDrive("kode", "https://contoh.app/cb", google.fetchImpl);
    const m = roundOne();
    db.insert(driveUploads).values({ fileName: `${m.id}-hilang.jpg`, matchId: m.id }).run();
    const run = processDriveQueue(google.fetchImpl);
    await vi.runAllTimersAsync();
    await run;
    expect(db.select().from(driveUploads).get()).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
    expect(driveQueueStatus().failed).toBe(1);

    expect(retryFailedUploads()).toBe(1);
    expect(db.select().from(driveUploads).get()).toMatchObject({ attempts: 0 });
  });

  it("hubungkan ulang: catatan kiriman lama dilupakan, semua foto bukti diantrekan ulang", () => {
    const m = roundOne();
    db.insert(users).values({ id: "u-p", name: "Pengawas", email: "p@x", role: "pengawas", roomId: m.roomId }).run();
    db.insert(matchResults).values({ id: "r1", matchId: m.id, proofPhotoUrl: `/api/bukti/${fileFor(m.id)}`, recordedBy: "u-p" }).run();
    db.insert(driveUploads).values([
      { fileName: fileFor(m.id), matchId: m.id, status: "done", driveFileId: "lama" },
      { fileName: `${m.id}-sisa-simulasi.jpg`, matchId: m.id, status: "done", driveFileId: "lama-2" },
    ]).run();
    expect(resyncAllToDrive()).toBe(1);
    expect(db.select().from(driveUploads).all()).toEqual([expect.objectContaining({ fileName: fileFor(m.id), status: "pending", driveFileId: null })]);
  });

  it("izin dicabut: antrean berhenti tanpa menghabiskan percobaan dan admin diberi tahu", async () => {
    await connectDrive("kode", "https://contoh.app/cb", fakeGoogle().fetchImpl);
    disconnectDriveTokenOnly();
    const m = roundOne();
    db.insert(driveUploads).values({ fileName: fileFor(m.id), matchId: m.id }).run();
    await processDriveQueue(fakeGoogle({ refreshStatus: 400 }).fetchImpl);
    expect(db.select().from(driveUploads).get()).toMatchObject({ status: "failed", attempts: 0 });
    expect(driveConnection().lastError).toMatch(/invalid_grant/);
  });
});

/** Paksa token akses kedaluwarsa tanpa menghapus koneksi tersimpan. */
function disconnectDriveTokenOnly() {
  const saved = db.select().from(appSettings).all();
  disconnectDrive();
  db.insert(appSettings).values(saved).run();
}
