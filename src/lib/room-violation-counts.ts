import { connection } from "next/server";
import { getBracket } from "@/lib/get-bracket";
import { getRoomViolations } from "@/lib/room-violations";

/** Jumlah pelanggaran per ruangan. */
export async function getViolationCountsByRoom(): Promise<Map<string, number>> {
  // Data live dari database: selalu dibaca saat request, bukan saat build.
  await connection();
  const { rooms } = await getBracket();
  const counts = await Promise.all(rooms.map(async (r) => [r.id, (await getRoomViolations(r.id)).length] as const));
  return new Map(counts);
}
