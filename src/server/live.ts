import { EventEmitter } from "node:events";

import { eq, sql } from "drizzle-orm";

import { db, type Db } from "@/db";
import { bracketState } from "@/db/schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type BracketVersion = { version: number; updatedAt: string };

export const bracketSource = () =>
  process.env.BRACKET_DATA_SOURCE === "mock" ? ("mock" as const) : ("db" as const);

/** Naikkan versi bagan. Panggil di dalam transaksi yang mengubah data bagan. */
export function bumpBracketVersion(tx: Tx) {
  tx.update(bracketState)
    .set({ version: sql`${bracketState.version} + 1`, updatedAt: new Date() })
    .where(eq(bracketState.id, 1))
    .run();
}

/** Versi bagan saat ini (dari database, atau dari simulator saat mode mock). */
export async function getBracketVersion(): Promise<BracketVersion> {
  if (bracketSource() === "mock") {
    const { getLiveMockVersion } = await import("@/lib/mock/live-simulator");
    return getLiveMockVersion();
  }
  const row = db.select().from(bracketState).where(eq(bracketState.id, 1)).get();
  return {
    version: row?.version ?? 0,
    updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
  };
}

// Pemberitahuan dalam proses: endpoint tulis memanggil notifyBracketChanged()
// setelah transaksi berhasil, sehingga stream SSE bisa langsung mendorong versi baru
// tanpa menunggu pengecekan berkala.
const globalForLive = globalThis as unknown as { bracketEvents?: EventEmitter };
const events = (globalForLive.bracketEvents ??= new EventEmitter().setMaxListeners(0));

export function notifyBracketChanged() {
  events.emit("change");
}

export function onBracketChanged(listener: () => void) {
  events.on("change", listener);
  return () => void events.off("change", listener);
}
