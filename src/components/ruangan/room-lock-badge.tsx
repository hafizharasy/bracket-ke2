import { LockIcon } from "lucide-react";

import { getBracket } from "@/lib/get-bracket";
import { getPengawasSession } from "@/lib/pengawas-session";

/** Penanda di header: akun ini terkunci ke satu ruangan. */
export async function RoomLockBadge() {
  const session = await getPengawasSession();
  const room = (await getBracket()).rooms.find((r) => r.id === session.roomId);
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
      title="Akun pengawas terkunci ke ruangan ini"
    >
      <LockIcon className="size-3" aria-hidden />
      {room?.name ?? session.roomId}
    </span>
  );
}
