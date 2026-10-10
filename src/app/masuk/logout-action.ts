"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { STUB_ADMIN_COOKIE, STUB_ROLE_COOKIE } from "@/lib/admin-session";
import { STUB_USER_COOKIE } from "@/lib/pengawas-session";

/** Keluar dari akun pengawas: hapus sesi lalu kembali ke halaman masuk. */
export async function logoutPengawas() {
  const store = await cookies();
  store.delete(STUB_USER_COOKIE);
  store.delete(STUB_ROLE_COOKIE);
  redirect("/masuk?keluar=1");
}

/** Keluar dari akun admin utama: hapus sesi lalu kembali ke halaman masuk admin. */
export async function logoutAdmin() {
  const store = await cookies();
  store.delete(STUB_ADMIN_COOKIE);
  store.delete(STUB_ROLE_COOKIE);
  redirect("/masuk/admin?keluar=1");
}
