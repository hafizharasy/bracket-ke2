"use client";

import { KeyRoundIcon, PencilIcon, PowerIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccountDialog } from "@/components/admin/account-dialog";
import { Button } from "@/components/ui/button";
import { generatePassword, updateAccountStatus } from "@/lib/admin-client";
import type { PengawasAccount } from "@/lib/pengawas-accounts";
import type { Room } from "@/lib/types";

/** Aksi per akun: ubah, atur ulang sandi, aktif/nonaktifkan. */
export function AccountRowActions({ account, rooms }: { account: PengawasAccount; rooms: Room[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function resetPassword() {
    if (!confirm(`Atur ulang sandi ${account.name}?`)) return;
    const password = generatePassword();
    setBusy(true);
    const result = await updateAccountStatus(account.id, { resetPassword: password });
    setBusy(false);
    setNotice(result.ok ? `Sandi baru: ${password}${result.simulated ? " (simulasi)" : ""}` : result.error);
  }

  async function toggleActive() {
    const verb = account.active ? "Nonaktifkan" : "Aktifkan";
    if (!confirm(`${verb} akun ${account.name}?`)) return;
    setBusy(true);
    const result = await updateAccountStatus(account.id, { active: !account.active });
    setBusy(false);
    setNotice(result.ok ? `${verb} berhasil${result.simulated ? " (simulasi)" : ""}.` : result.error);
    if (result.ok) router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={busy} aria-label={`Ubah ${account.name}`}>
          <PencilIcon /> Ubah
        </Button>
        <Button variant="ghost" size="sm" onClick={resetPassword} disabled={busy} aria-label={`Atur ulang sandi ${account.name}`}>
          <KeyRoundIcon /> Sandi
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleActive} disabled={busy} aria-label={`${account.active ? "Nonaktifkan" : "Aktifkan"} ${account.name}`}>
          <PowerIcon /> {account.active ? "Nonaktifkan" : "Aktifkan"}
        </Button>
      </div>
      {notice && <span aria-live="polite" className="font-mono text-xs text-muted-foreground">{notice}</span>}
      {editing && <AccountDialog account={account} rooms={rooms} open={editing} onOpenChange={setEditing} />}
    </div>
  );
}
