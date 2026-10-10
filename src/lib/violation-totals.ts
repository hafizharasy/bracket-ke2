import { connection } from "next/server";
import { getBracket } from "@/lib/get-bracket";
import { getRoomViolations } from "@/lib/room-violations";
import { bracketSource } from "@/server/live";

/** Total pelanggaran seluruh turnamen (database, atau data simulasi). */
export async function getTotalViolations(): Promise<number> {
  // Data live dari database: selalu dibaca saat request, bukan saat build.
  await connection();
  if (bracketSource() === "db") {
    const [{ db }, { violations }, { count }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);
    return db.select({ n: count() }).from(violations).get()?.n ?? 0;
  }
  const { rooms } = await getBracket();
  const lists = await Promise.all(rooms.map((r) => getRoomViolations(r.id)));
  return lists.reduce((sum, list) => sum + list.length, 0);
}
