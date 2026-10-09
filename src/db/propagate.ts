// Hitung ulang propagasi pemenang ke babak berikutnya: npm run db:propagate
import { DATABASE_PATH, db } from "@/db";
import { bumpBracketVersion } from "@/server/live";
import { repropagateAll } from "@/server/propagation";

const report = db.transaction((tx) => {
  const result = repropagateAll(tx);
  if (result.filled > 0) bumpBracketVersion(tx);
  return result;
});
console.log(
  `✓ Propagasi ${DATABASE_PATH}: ${report.filled} slot diisi, ${report.unchanged} sudah benar, ` +
    `${report.conflicts.length} konflik`,
);
for (const conflict of report.conflicts) console.log(`  ! ${conflict}`);
if (report.conflicts.length > 0) process.exitCode = 1;
