"use client";

import { DicesIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CopyCredentials } from "@/components/admin/copy-credentials";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type AccountFormValues, generatePassword, saveAccount, validateAccount } from "@/lib/admin-client";
import type { PengawasAccount } from "@/lib/pengawas-accounts";
import type { Room } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Dialog tambah/ubah akun pengawas. */
export function AccountDialog({
  account,
  rooms,
  open,
  onOpenChange,
  defaultRoomId,
}: {
  account?: PengawasAccount;
  rooms: Room[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ruangan terpilih awal untuk akun baru. */
  defaultRoomId?: string;
}) {
  const router = useRouter();
  const isNew = !account;
  const [values, setValues] = useState<AccountFormValues>({
    name: account?.name ?? "",
    email: account?.email ?? "",
    roomId: account?.roomId ?? defaultRoomId ?? "",
    password: "",
  });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  // Data halaman dimuat ulang saat dialog ditutup (bukan langsung setelah simpan),
  // supaya kredensial tetap terlihat walau tombol pemicunya hilang setelah refresh.
  const [saved, setSaved] = useState(false);
  const close = (next: boolean) => {
    if (!next && saved) router.refresh();
    onOpenChange(next);
  };
  const errors = validateAccount(values, isNew);
  const hasErrors = Object.keys(errors).length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    const result = await saveAccount(account?.id ?? null, { ...values, name: values.name.trim(), email: values.email.trim().toLowerCase() });
    setSaving(false);
    if (!result.ok) return setMessage({ ok: false, text: result.error });
    setMessage({
      ok: true,
      text: `Akun tersimpan${result.simulated ? " (mode simulasi)" : ""}.${values.password ? " Berikan kredensial ini ke pengawas:" : ""}`,
    });
    setCredentials(values.password ? { email: values.email.trim().toLowerCase(), password: values.password } : null);
    setSaved(true);
  }

  const set = (key: keyof AccountFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setMessage(null);
  };
  const input = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive";
  const err = (key: keyof AccountFormValues) =>
    touched && errors[key] ? <span className="text-xs text-destructive">{errors[key]}</span> : null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isNew ? "Tambah akun pengawas" : "Ubah akun pengawas"}</DialogTitle>
            <DialogDescription>Akun pengawas hanya bisa mengakses satu ruangan.</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Nama</span>
            <input value={values.name} onChange={set("name")} aria-invalid={touched && !!errors.name} className={input} autoFocus />
            {err("name")}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email (untuk login)</span>
            <input type="email" value={values.email} onChange={set("email")} aria-invalid={touched && !!errors.email} className={input} autoComplete="off" />
            {err("email")}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Ruangan</span>
            <select value={values.roomId} onChange={set("roomId")} aria-invalid={touched && !!errors.roomId} className={input}>
              <option value="">— Pilih ruangan —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {err("roomId")}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {isNew ? "Sandi awal" : "Sandi baru"}{" "}
              {!isNew && <span className="font-normal text-muted-foreground">(kosongkan bila tidak diubah)</span>}
            </span>
            <span className="flex gap-2">
              <input
                value={values.password}
                onChange={set("password")}
                aria-invalid={touched && !!errors.password}
                className={cn(input, "font-mono")}
                autoComplete="new-password"
              />
              <Button type="button" variant="outline" onClick={() => setValues((v) => ({ ...v, password: generatePassword() }))} aria-label="Buat sandi acak">
                <DicesIcon />
              </Button>
            </span>
            {err("password")}
          </label>
          {message && (
            <p aria-live="polite" className={cn("text-sm", message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
              {message.text}
            </p>
          )}
          {credentials && <CopyCredentials email={credentials.email} password={credentials.password} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>Tutup</Button>
            <Button type="submit" disabled={saving || (touched && hasErrors)}>
              {saving && <Loader2Icon className="animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Tombol "Tambah akun" + dialognya (opsional ruangan terpilih). */
export function AddAccountButton({
  rooms,
  roomId,
  label = "Tambah akun",
  variant = "default",
}: {
  rooms: Room[];
  roomId?: string;
  label?: string;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={variant === "outline" ? "sm" : "default"} onClick={() => setOpen(true)}>
        <PlusIcon /> {label}
      </Button>
      {open && <AccountDialog rooms={rooms} open={open} onOpenChange={setOpen} defaultRoomId={roomId} />}
    </>
  );
}
