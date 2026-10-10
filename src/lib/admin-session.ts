import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AdminSession = { userId: string; name: string };

/** Cookie pengembangan untuk menyimulasikan peran sesi stub: "admin" | "pengawas" | "none". */
export const STUB_ROLE_COOKIE = "lrp_stub_role";
/** Cookie pengembangan berisi ID akun admin yang login lewat login stub. */
export const STUB_ADMIN_COOKIE = "lrp_stub_admin";

/**
 * Sesi admin utama yang sedang login, atau null.
 *
 * SEMENTARA (stub frontend): sesi dari login stub admin (cookie
 * lrp_stub_role = "admin" + lrp_stub_admin = ID akun). Di production selalu
 * null sampai login Better Auth dibuat, dengan bentuk data yang sama.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  if (process.env.NODE_ENV === "production") return null;
  if (store.get(STUB_ROLE_COOKIE)?.value !== "admin") return null;
  const userId = store.get(STUB_ADMIN_COOKIE)?.value;
  const admin = userId ? (await getAdminAccounts()).find((a) => a.id === userId) : undefined;
  return admin ? { userId: admin.id, name: admin.name } : null;
}

export type AdminAccount = { id: string; name: string; email: string };

/** Akun admin utama: dari tabel users (role admin), atau akun contoh saat mode mock. */
export async function getAdminAccounts(): Promise<AdminAccount[]> {
  const { bracketSource } = await import("@/server/live");
  if (bracketSource() === "db") {
    const [{ db }, { users }, { eq }] = await Promise.all([import("@/db"), import("@/db/schema"), import("drizzle-orm")]);
    return db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.role, "admin")).all();
  }
  return [{ id: "u-admin", name: "Admin Utama", email: "admin@lrp.local" }];
}

/** Halaman/aksi khusus admin utama: arahkan ke halaman masuk admin bila bukan admin. */
export async function requireAdmin(next = "/admin"): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    // Cookie admin ada tapi tidak sah lagi → sesi berakhir.
    const hadCookie = (await cookies()).has(STUB_ADMIN_COOKIE);
    redirect(`/masuk/admin?next=${encodeURIComponent(next)}${hadCookie ? "&alasan=sesi" : ""}`);
  }
  return session;
}

/** Untuk Server Actions: hasil gagal (bukan redirect) bila bukan admin. */
export async function assertAdminAction() {
  const session = await getAdminSession();
  return session ? null : ({ ok: false, error: "Hanya admin utama yang boleh melakukan ini." } as const);
}
