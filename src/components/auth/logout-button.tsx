"use client";

import { LogOutIcon } from "lucide-react";
import { useTransition } from "react";

import { logoutPengawas } from "@/app/masuk/logout-action";
import { cn } from "@/lib/utils";

/** Tombol keluar akun pengawas (dengan konfirmasi). */
export function LogoutButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Keluar dari akun pengawas?")) start(() => logoutPengawas());
      }}
      className={cn("flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50", className)}
    >
      <LogOutIcon className="size-3.5" />
      {pending ? "Keluar…" : "Keluar"}
    </button>
  );
}
