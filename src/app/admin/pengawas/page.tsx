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

export default function PengawasPage({ searchParams }: PageProps<"/admin/pengawas">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Accounts searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Accounts({ searchParams }: Pick<PageProps<"/admin/pengawas">, "searchParams">) {
  const [all, { rooms }, params] = await Promise.all([getPengawasAccounts(), getBracket(), searchParams]);
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const accounts = q ? all.filter((a) => a.name.toLowerCase().includes(q) || a.email.includes(q)) : all;
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const uncovered = rooms.filter((r) => !all.some((a) => a.active && a.roomId === r.id));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Akun Pengawas</h1>
          <p className="text-sm text-muted-foreground">
            {all.length} akun · {all.filter((a) => a.active).length} aktif · tiap akun terkunci ke satu ruangan.
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

      <section aria-label="Pengawas per ruangan" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {rooms.map((r) => {
          const owners = all.filter((a) => a.active && a.roomId === r.id);
          return (
            <div key={r.id} className={owners.length ? "rounded-xl border bg-card p-2.5" : "rounded-xl border border-amber-500/60 bg-amber-500/5 p-2.5"}>
              <div className="text-sm font-medium">{r.name}</div>
              {owners.length ? (
                <div className="truncate text-xs text-muted-foreground">{owners.map((a) => a.name).join(", ")}</div>
              ) : (
                <div className="mt-1">
                  <AddAccountButton rooms={rooms} roomId={r.id} label="Buat akun" variant="outline" />
                </div>
              )}
            </div>
          );
        })}
      </section>

      <form action="/admin/pengawas" role="search" className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Cari nama atau email pengawas…"
          aria-label="Cari akun pengawas"
          className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button type="submit" className="h-10 rounded-lg border px-4 text-sm font-medium hover:bg-muted">Cari</button>
      </form>
      {q && <p className="-mt-3 text-sm text-muted-foreground">{accounts.length} akun cocok dengan &ldquo;{q}&rdquo;.</p>}

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
