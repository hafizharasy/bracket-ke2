// Buat akun admin utama (atau setel ulang sandinya bila email sudah ada).
//   npm run db:create-admin -- --email admin@contoh.id --name "Admin Utama" --password 'sandi-rahasia'
// Sandi juga bisa lewat env ADMIN_PASSWORD supaya tidak tercatat di riwayat shell.

import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";

import { DATABASE_PATH, db } from "@/db";
import { users } from "@/db/schema";
import { hashUserPassword, revokeSessions, storePasswordHash } from "@/server/credentials";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "string" },
  },
});
const email = values.email?.trim().toLowerCase();
const password = values.password ?? process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error(
    "Pakai: npm run db:create-admin -- --email <email> [--name <nama>] --password <sandi>  (atau env ADMIN_PASSWORD)",
  );
  process.exit(1);
}

async function main(email: string, password: string) {
  const hash = await hashUserPassword(password);
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing && existing.role !== "admin") {
    console.error(`✗ ${email} adalah akun ${existing.role}, bukan admin.`);
    process.exit(1);
  }

  db.transaction((tx) => {
    const id = existing?.id ?? `u-${crypto.randomUUID().slice(0, 8)}`;
    if (existing) {
      tx.update(users)
        .set({
          active: true,
          updatedAt: new Date(),
          ...(values.name ? { name: values.name } : {}),
        })
        .where(eq(users.id, id))
        .run();
      revokeSessions(tx, id);
    } else {
      tx.insert(users)
        .values({
          id,
          name: values.name ?? "Admin Utama",
          email,
          role: "admin",
        })
        .run();
    }
    storePasswordHash(tx, id, hash);
  });
  console.log(`✓ Admin ${email} ${existing ? "diperbarui (sandi disetel ulang)" : "dibuat"} di ${DATABASE_PATH}`);
}

void main(email, password);
