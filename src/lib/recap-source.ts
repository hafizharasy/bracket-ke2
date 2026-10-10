import { connection } from "next/server";

import type { RecapData, RecapFilters } from "@/lib/recap";

/** Ambil filter rekap dari searchParams halaman. */
export function recapFilters(params: Record<string, string | string[] | undefined>): RecapFilters {
  const pick = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  return { sesi: pick(params.sesi), ruangan: pick(params.ruangan) };
}

/**
 * Data Rekap & Ekspor untuk halaman admin.
 * SEMENTARA (tahap frontend): data tiruan; diganti data database di backend.
 */
export async function getRecap(filters: RecapFilters): Promise<RecapData> {
  await connection();
  const { getMockRecap } = await import("@/lib/mock/recap-data");
  return getMockRecap(filters);
}
