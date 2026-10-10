import { connection } from "next/server";

import { getBracketFromDb } from "@/db/queries/bracket";
import type { BracketData } from "@/lib/types";
import { bracketSource } from "@/server/live";

/**
 * Sumber data bagan untuk halaman: database (default), atau simulasi live di
 * atas data tiruan bila env BRACKET_DATA_SOURCE=mock (untuk demo tanpa data).
 */
export async function getBracket(): Promise<BracketData> {
  // Data live → selalu dibaca saat request, bukan saat prerender.
  await connection();
  const { applyStructureOverlay } = await import("@/lib/mock/structure-store");
  if (bracketSource() === "mock") {
    const { getLiveMockBracket } = await import("@/lib/mock/live-simulator");
    return applyStructureOverlay(getLiveMockBracket());
  }
  // Perubahan ruangan/sesi dari form admin (state tiruan) sampai endpoint-nya dibuat.
  return applyStructureOverlay(getBracketFromDb());
}
