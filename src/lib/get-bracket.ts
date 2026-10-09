import { connection } from "next/server";

import type { BracketData } from "@/lib/types";

/**
 * Sumber data bracket. Sementara memakai data tiruan yang disimulasikan
 * berjalan live; nanti diganti dengan GET /bracket ke backend dengan bentuk
 * data yang sama.
 */
export async function getBracket(): Promise<BracketData> {
  // Data live → selalu dibaca saat request, bukan saat prerender.
  await connection();
  const { getLiveMockBracket } = await import("@/lib/mock/live-simulator");
  return getLiveMockBracket();
}
