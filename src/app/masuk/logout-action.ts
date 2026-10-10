"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/better-auth";

async function signOut() {
  // Sesi yang sudah kedaluwarsa tetap dianggap berhasil keluar.
  await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
}

/** Keluar dari akun pengawas: hapus sesi lalu kembali ke halaman masuk. */
export async function logoutPengawas() {
  await signOut();
  redirect("/masuk?keluar=1");
}

/** Keluar dari akun admin utama: hapus sesi lalu kembali ke halaman masuk admin. */
export async function logoutAdmin() {
  await signOut();
  redirect("/masuk/admin?keluar=1");
}
