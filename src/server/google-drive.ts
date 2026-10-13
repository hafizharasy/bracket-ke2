// Klien Google Drive minimal (REST + fetch, tanpa SDK) untuk menyalin foto
// bukti ke Drive akun Google pribadi admin. Izin yang diminta hanya
// `drive.file`: aplikasi hanya bisa melihat/mengubah berkas & folder yang
// dibuatnya sendiri, bukan isi Drive lainnya.

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { appSettings } from "@/db/schema";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const ROOT_FOLDER_NAME = "Foto Bukti MCR & LRP 2026";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type Fetch = typeof fetch;

/** Kredensial OAuth dari env Railway; null bila belum diatur. */
export function driveCredentials(env: Record<string, string | undefined> = process.env) {
  const clientId = env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** URL persetujuan Google (akses offline supaya mendapat refresh token). */
export function driveAuthUrl(clientId: string, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ---------- Penyimpanan koneksi (tabel app_settings) ----------

const KEYS = {
  refreshToken: "drive.refreshToken",
  rootFolderId: "drive.rootFolderId",
  rootFolderLink: "drive.rootFolderLink",
  account: "drive.account",
  lastError: "drive.lastError",
} as const;

function getSettings() {
  const rows = db.select().from(appSettings).where(inArray(appSettings.key, Object.values(KEYS))).all();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    refreshToken: map.get(KEYS.refreshToken) ?? null,
    rootFolderId: map.get(KEYS.rootFolderId) ?? null,
    rootFolderLink: map.get(KEYS.rootFolderLink) ?? null,
    account: map.get(KEYS.account) ?? null,
    lastError: map.get(KEYS.lastError) ?? null,
  };
}

function setSetting(key: string, value: string | null) {
  if (value === null) {
    db.delete(appSettings).where(eq(appSettings.key, key)).run();
    return;
  }
  db.insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
    .run();
}

/** Status koneksi untuk halaman admin (tanpa token). */
export function driveConnection() {
  const s = getSettings();
  return {
    configured: !!driveCredentials(),
    connected: !!(s.refreshToken && s.rootFolderId),
    account: s.account,
    rootFolderLink: s.rootFolderLink,
    lastError: s.lastError,
  };
}

export function setDriveError(message: string | null) {
  setSetting(KEYS.lastError, message);
}

export function disconnectDrive() {
  for (const key of Object.values(KEYS)) setSetting(key, null);
  tokenCache = null;
  folderCache.clear();
}

// ---------- OAuth & REST ----------

export class DriveError extends Error {
  constructor(
    message: string,
    /** true = koneksi tidak sah lagi (izin dicabut / token kedaluwarsa). */
    readonly auth = false,
  ) {
    super(message);
  }
}

async function readError(res: Response) {
  const body = await res.text().catch(() => "");
  try {
    const json = JSON.parse(body);
    return json.error_description ?? json.error?.message ?? json.error ?? body;
  } catch {
    return body || res.statusText;
  }
}

/** Tukar kode persetujuan menjadi token, simpan refresh token & buat folder utama. */
export async function connectDrive(code: string, redirectUri: string, fetchImpl: Fetch = fetch) {
  const creds = driveCredentials();
  if (!creds) throw new DriveError("GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET belum diatur.");
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new DriveError(`Google menolak kode persetujuan: ${await readError(res)}`);
  const token = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  if (!token.refresh_token) {
    throw new DriveError(
      "Google tidak mengirim refresh token. Cabut akses aplikasi di myaccount.google.com/permissions lalu hubungkan lagi.",
    );
  }
  tokenCache = { token: token.access_token, expiresAt: Date.now() + (token.expires_in - 60) * 1000 };
  setSetting(KEYS.refreshToken, token.refresh_token);

  const about = await driveFetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {}, fetchImpl)
    .then((r) => r.json() as Promise<{ user?: { emailAddress?: string } }>)
    .catch(() => null);
  setSetting(KEYS.account, about?.user?.emailAddress ?? "akun Google");

  const folder = await createFolder(ROOT_FOLDER_NAME, null, fetchImpl);
  setSetting(KEYS.rootFolderId, folder.id);
  setSetting(KEYS.rootFolderLink, folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}`);
  setSetting(KEYS.lastError, null);
  folderCache.clear();
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(fetchImpl: Fetch) {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const creds = driveCredentials();
  const { refreshToken } = getSettings();
  if (!creds || !refreshToken) throw new DriveError("Google Drive belum terhubung.", true);
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const message = await readError(res);
    // invalid_grant = izin dicabut / token kedaluwarsa → admin perlu menghubungkan ulang.
    throw new DriveError(`Gagal memperbarui akses Google Drive: ${message}`, res.status === 400 || res.status === 401);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
  return json.access_token;
}

async function driveFetch(url: string, init: RequestInit, fetchImpl: Fetch) {
  const token = await accessToken(fetchImpl);
  const res = await fetchImpl(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    tokenCache = null;
    throw new DriveError("Akses Google Drive ditolak (401).", true);
  }
  if (!res.ok) throw new DriveError(`Google Drive: ${await readError(res)}`);
  return res;
}

async function createFolder(name: string, parentId: string | null, fetchImpl: Fetch) {
  const res = await driveFetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
    },
    fetchImpl,
  );
  return (await res.json()) as { id: string; webViewLink?: string };
}

const folderCache = new Map<string, string>();
const escapeQuery = (value: string) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Cari (atau buat) subfolder bertingkat di bawah folder utama, mis. ["Sesi 1", "Ruangan 2"]. */
export async function ensureFolderPath(segments: string[], fetchImpl: Fetch = fetch) {
  const { rootFolderId } = getSettings();
  if (!rootFolderId) throw new DriveError("Google Drive belum terhubung.", true);
  let parent = rootFolderId;
  for (const name of segments) {
    const key = `${parent}/${name}`;
    const cached = folderCache.get(key);
    if (cached) {
      parent = cached;
      continue;
    }
    const q = `name = '${escapeQuery(name)}' and '${parent}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
    const found = (await (
      await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, {}, fetchImpl)
    ).json()) as { files: { id: string }[] };
    const id = found.files[0]?.id ?? (await createFolder(name, parent, fetchImpl)).id;
    folderCache.set(key, id);
    parent = id;
  }
  return parent;
}

/** Unggah satu berkas (multipart) ke folder tertentu. */
export async function uploadToDrive(
  folderId: string,
  name: string,
  bytes: Uint8Array,
  mimeType: string,
  fetchImpl: Fetch = fetch,
) {
  const boundary = `bukti-${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name, parents: [folderId] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    bytes as BlobPart,
    `\r\n--${boundary}--`,
  ]);
  const res = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body },
    fetchImpl,
  );
  return (await res.json()) as { id: string; webViewLink?: string };
}
