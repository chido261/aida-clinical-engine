// app/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { APP_MODE, getDatabaseUrl } from "@/app/lib/runtimeConfig";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function assertEnv(url: string) {
  // Fail-fast en cloud
  if (APP_MODE === "cloud") {
    if (!url) throw new Error("DATABASE_URL missing (cloud)");
    if (url.startsWith("file:")) {
      throw new Error("DATABASE_URL cannot be sqlite in cloud");
    }
  }

  // Fail-fast local
  if (APP_MODE === "local") {
    if (!url) throw new Error("DATABASE_URL missing (local)");
    if (!url.startsWith("file:")) {
      throw new Error("DATABASE_URL must be sqlite file: in local");
    }
  }
}

function makePrismaClient() {
  const url = getDatabaseUrl();
  assertEnv(url);

  // Local sqlite
  if (url.startsWith("file:")) {
    const adapter = new PrismaBetterSqlite3({ url });
    return new PrismaClient({ adapter });
  }

  // Cloud postgres
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}