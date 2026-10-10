import { redirect } from "next/navigation";

export type AdminSession = { userId: string; name: string };

/** Sesi admin utama yang sedang login (Better Auth), atau null. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const { getActingUser } = await import("@/server/auth");
  const user = await getActingUser();
  return user?.role === "admin" ? { userId: user.id, name: user.name } : null;
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
