"use client";

import { LogOutIcon } from "lucide-react";
import { useTransition } from "react";

import { logoutAdmin, logoutPengawas } from "@/app/masuk/logout-action";
import { cn } from "@/lib/utils";

const ROLES = {
  pengawas: { action: logoutPengawas, confirm: "Keluar dari akun pengawas?" },
  admin: { action: logoutAdmin, confirm: "Keluar dari akun admin utama?" },
} as const;

/** Tombol keluar akun (dengan konfirmasi) untuk pengawas atau admin utama. */
export function LogoutButton({ role = "pengawas", className }: { role?: keyof typeof ROLES; className?: string }) {
  const [pending, start] = useTransition();
  const { action, confirm: question } = ROLES[role];
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(question)) start(() => action());
      }}
      className={cn("flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50", className)}
    >
      <LogOutIcon className="size-3.5" />
      {pending ? "Keluar…" : "Keluar"}
    </button>
  );
}
