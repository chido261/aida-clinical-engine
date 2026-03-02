// app/lib/runtimeConfig.ts
export type AppMode = "local" | "cloud";

// Cambia SOLO esto cuando quieras switchear
export const APP_MODE: AppMode =
  (process.env.APP_MODE as AppMode) || "local";

export const isLocal = APP_MODE === "local";
export const isCloud = APP_MODE === "cloud";

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing");

  // Regla anti-bug: Vercel/Cloud jamás debe usar sqlite file:
  if (isCloud && url.startsWith("file:")) {
    throw new Error("APP_MODE=cloud but DATABASE_URL is sqlite (file:). Fix env.");
  }

  return url;
}