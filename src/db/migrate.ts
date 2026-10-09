// Jalankan migrasi: npm run db:migrate
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { DATABASE_PATH, db } from "@/db";

migrate(db, { migrationsFolder: "drizzle" });
console.log(`✓ Migrasi diterapkan ke ${DATABASE_PATH}`);
