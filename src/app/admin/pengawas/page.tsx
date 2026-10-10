import { TriangleAlertIcon } from "lucide-react";
import { Suspense } from "react";

import { AddAccountButton } from "@/components/admin/account-dialog";
import { AccountRowActions } from "@/components/admin/account-row-actions";
import { Badge } from "@/components/ui/badge";
import { getBracket } from "@/lib/get-bracket";
import { getPengawasAccounts } from "@/lib/pengawas-accounts";

export const metadata = { title: "Akun Pengawas" };

const ago = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
function lastSeen(iso: string | null) {
  if (!iso) return "Belum pernah login";
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  return Math.abs(minutes) < 60 ? ago.format(minutes, "minute") : ago.format(Math.round(minutes / 60), "hour");
}

export default function PengawasPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Accounts />
      </Suspense>
    </main>
  );
}

async function Accounts() {
  const [accounts, { rooms }] = await Promise.all([getPengawasAccounts(), getBracket()]);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const uncovered = rooms.filter((r) => !accounts.some((a) => a.active && a.roomId === r.id));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Akun Pengawas</h1>
          <p className="text-sm text-muted-foreground">
            {accounts.length} akun · {accounts.filter((a) => a.active).length} aktif · tiap akun terkunci ke satu ruangan.
          </p>
        </div>
        <AddAccountButton rooms={rooms} />
      </div>

      {uncovered.length > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
          <TriangleAlertIcon className="size-4 shrink-0 text-amber-600" />
          Belum ada pengawas aktif untuk: {uncovered.map((r) => r.name).join(", ")}.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Pengawas</th>
              <th className="px-3 py-2 font-medium">Ruangan</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Login terakhir</th>
              <th className="px-3 py-2"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-t align-top">
                <td className="px-3 py-2">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.email}</div>
                </td>
                <td className="px-3 py-2">{a.roomId ? roomName.get(a.roomId) : "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={a.active ? "secondary" : "outline"} className={a.active ? "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300" : ""}>
                    {a.active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{lastSeen(a.lastLoginAt)}</td>
                <td className="px-3 py-1.5">
                  <AccountRowActions account={a} rooms={rooms} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
