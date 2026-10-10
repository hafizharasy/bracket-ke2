import { redirect } from "next/navigation";

export type AdminSession = { userId: string; name: string };

/** Sesi admin utama yang sedang login (Better Auth), atau null. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const { getActingUser } = await import("@/server/auth");
  const user = await getActingUser();
  return user?.role === "admin" ? { userId: user.id, name: user.name } : null;
}

export type AdminAccount = { id: string; name: string; email: string };

/** Akun admin utama yang aktif: dari tabel users (role admin), atau akun contoh saat mode mock. */
export async function getAdminAccounts(): Promise<AdminAccount[]> {
  const { bracketSource } = await import("@/server/live");
  if (bracketSource() === "db") {
    const [{ db }, { users }, { and, eq }] = await Promise.all([import("@/db"), import("@/db/schema"), import("drizzle-orm")]);
    return db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true)))
      .all();
  }
  return [{ id: "u-admin", name: "Admin Utama", email: "admin@lrp.local" }];
}

/** Halaman/aksi khusus admin utama: arahkan ke halaman masuk admin bila bukan admin. */
export async function requireAdmin(next = "/admin"): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    // Cookie sesi ada tapi tidak sah lagi (atau bukan admin) → sesi berakhir.
    const { hasSessionCookie } = await import("@/lib/pengawas-session");
    const hadCookie = await hasSessionCookie();
    redirect(`/masuk/admin?next=${encodeURIComponent(next)}${hadCookie ? "&alasan=sesi" : ""}`);
  }
  return session;
}

/** Untuk Server Actions: hasil gagal (bukan redirect) bila bukan admin. */
export async function assertAdminAction() {
  const session = await getAdminSession();
  return session ? null : ({ ok: false, error: "Hanya admin utama yang boleh melakukan ini." } as const);
}
