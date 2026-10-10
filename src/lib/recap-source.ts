import { connection } from "next/server";

import type { RecapData, RecapFilters } from "@/lib/recap";

/** Ambil filter rekap dari searchParams halaman. */
export function recapFilters(params: Record<string, string | string[] | undefined>): RecapFilters {
  const pick = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  return { sesi: pick(params.sesi), ruangan: pick(params.ruangan) };
}

/**
 * Data Rekap & Ekspor: dari database (default), atau data tiruan saat
 * BRACKET_DATA_SOURCE=mock.
 */
export async function getRecap(filters: RecapFilters): Promise<RecapData> {
  await connection();
  const { bracketSource } = await import("@/server/live");
  if (bracketSource() === "mock") {
    const { getMockRecap } = await import("@/lib/mock/recap-data");
    return getMockRecap(filters);
  }
  const { getDbRecap } = await import("@/server/recap");
  return getDbRecap(filters);
}
