import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env.local")) {
  console.log("Kept existing .env.local. Move it aside before generating a replacement.");
  process.exit(0);
}
const status = JSON.parse(execFileSync("node_modules/.bin/supabase", ["status", "--output-format", "json"], { encoding: "utf8" }));
const e = status.env;
if (!e?.API_URL || new URL(e.API_URL).hostname !== "127.0.0.1") throw new Error("Only the local stack is supported");
writeFileSync(".env.local", [
  `NEXT_PUBLIC_SUPABASE_URL=${e.API_URL}`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${e.PUBLISHABLE_KEY}`,
  `SUPABASE_SERVICE_ROLE_KEY=${e.SERVICE_ROLE_KEY}`, `DATABASE_URL=${e.DB_URL}`, "APP_ORIGIN=http://127.0.0.1:3000", "",
].join("\n"), { mode: 0o600, flag: "wx" });
console.log("Created ignored .env.local for local synthetic development. Existing files are never overwritten.");
