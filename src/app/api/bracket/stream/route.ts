import { connection } from "next/server";

import { getBracketVersion, onBracketChanged } from "@/server/live";

/** Cek berkala ke database: menangkap perubahan dari proses/skrip lain. */
const CHECK_MS = 2_000;
/** Komentar SSE agar koneksi tidak diputus proxy saat tidak ada perubahan. */
const HEARTBEAT_MS = 25_000;

/**
 * GET /api/bracket/stream — Server-Sent Events untuk pembaruan live.
 *
 * Mengirim `event: version` berisi { version, updatedAt } saat terhubung dan
 * setiap kali versi bagan berubah. Klien cukup me-refresh data saat versi
 * berbeda. Perubahan di proses ini didorong seketika (notifyBracketChanged);
 * perubahan dari luar terdeteksi lewat cek berkala.
 */
export async function GET(request: Request) {
  await connection(); // stream selalu per request, jangan diprerender
  const encoder = new TextEncoder();
  let lastVersion = -1;
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const push = async () => {
        const current = await getBracketVersion();
        if (current.version === lastVersion) return;
        lastVersion = current.version;
        send(`event: version\nid: ${current.version}\ndata: ${JSON.stringify(current)}\n\n`);
      };

      send("retry: 5000\n\n");
      await push();

      const unsubscribe = onBracketChanged(() => void push());
      const check = setInterval(() => void push(), CHECK_MS);
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      cleanup = () => {
        unsubscribe();
        clearInterval(check);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {}
      };
      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
