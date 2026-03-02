import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "prisma", "dev.db");
const OUT_DIR = path.join(process.cwd(), "backups");

if (!fs.existsSync(DB_PATH)) {
  console.error("❌ No existe prisma/dev.db");
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(OUT_DIR, `dev-${ts}.db`);

fs.copyFileSync(DB_PATH, outFile);
console.log("✅ Backup creado:", outFile);