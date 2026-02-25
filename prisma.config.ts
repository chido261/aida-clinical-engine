import { config } from "dotenv";
import { defineConfig } from "prisma/config";

const isProd = process.env.PRISMA_ENV === "production";

const envFile = isProd ? ".env.production" : ".env.local";
const schemaFile = isProd ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma";
const migrationsPath = isProd ? "prisma/migrations_pg" : "prisma/migrations";

config({ path: envFile });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(`DATABASE_URL no definida en ${envFile}`);
}

export default defineConfig({
  schema: schemaFile,
  migrations: { path: migrationsPath },
  datasource: { url: databaseUrl },
});