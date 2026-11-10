import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { Pool } from "pg";
import { parseEnv } from "node:util";
if (!existsSync(".env.local")) {
  const status = JSON.parse(execFileSync("node_modules/.bin/supabase", ["status", "--output-format", "json"], { encoding: "utf8" }));
  const e = status.env;
  if (!e?.API_URL || new URL(e.API_URL).hostname !== "127.0.0.1") throw new Error("Only the local stack is supported");
  writeFileSync(".env.local", [
    `NEXT_PUBLIC_SUPABASE_URL=${e.API_URL}`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${e.PUBLISHABLE_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${e.SERVICE_ROLE_KEY}`, `DATABASE_URL=${e.DB_URL}`, "APP_ORIGIN=http://127.0.0.1:3000", "",
  ].join("\n"), { mode: 0o600, flag: "wx" });
  console.log("Created ignored .env.local for local synthetic development. Existing application settings are preserved.");

}
const source=readFileSync(".env.local","utf8");
const env=parseEnv(source);
if (!["127.0.0.1","localhost"].includes(new URL(env.DATABASE_URL).hostname)) throw new Error("Local database required");
const pool=new Pool({connectionString:env.DATABASE_URL});
try {
 const {rows:[row]}=await pool.query("select secret from private.document_verifier where singleton");
 if(env.DOCUMENT_VERIFICATION_SECRET!==row.secret){
  const next=source.replace(/^DOCUMENT_VERIFICATION_SECRET=.*\n?/gm,"");
  writeFileSync(".env.local",`${next}\nDOCUMENT_VERIFICATION_SECRET=${row.secret}\n`);
  chmodSync(".env.local",0o600);
  console.log("Synchronized local document verifier. Restart the app after a database reset. No secret printed.");
 }
} finally {await pool.end();}
