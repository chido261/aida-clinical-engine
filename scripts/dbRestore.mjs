import fs from "node:fs";
import path from "node:path";

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('❌ Uso: node scripts/dbRestore.mjs "backups/dev-YYYY.db"');
  process.exit(1);
}

const src = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
const DB_PATH = path.join(process.cwd(), "prisma", "dev.db");

if (!fs.existsSync(src)) {
  console.error("❌ No existe backup:", src);
  process.exit(1);
}

fs.copyFileSync(src, DB_PATH);
console.log("✅ Restore listo. DB restaurada a prisma/dev.db");