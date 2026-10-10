import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AdminSession = { userId: string; name: string };

/** Cookie pengembangan untuk menyimulasikan peran sesi stub: "admin" | "pengawas" | "none". */
export const STUB_ROLE_COOKIE = "lrp_stub_role";

/**
 * Sesi admin utama yang sedang login, atau null.
 *
 * SEMENTARA (stub frontend), sampai Login Admin Utama dibuat: di luar
 * production dianggap login sebagai admin contoh, kecuali cookie
 * lrp_stub_role berisi "pengawas"/"none" (untuk menguji pembatas akses).
 * Di production selalu null → area admin tertutup.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  if (process.env.NODE_ENV === "production") return null;
  const role = store.get(STUB_ROLE_COOKIE)?.value ?? "admin";
  return role === "admin" ? { userId: "u-admin", name: "Admin Utama" } : null;
}

/** Halaman/aksi khusus admin utama: arahkan ke halaman masuk admin bila bukan admin. */
export async function requireAdmin(next = "/admin"): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect(`/masuk/admin?next=${encodeURIComponent(next)}`);
  return session;
}

/** Untuk Server Actions: hasil gagal (bukan redirect) bila bukan admin. */
export async function assertAdminAction() {
  const session = await getAdminSession();
  return session ? null : ({ ok: false, error: "Hanya admin utama yang boleh melakukan ini." } as const);
}
