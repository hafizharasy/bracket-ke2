"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { logout } from "@/server/login";

async function signOut() {
  await logout(await headers());
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
