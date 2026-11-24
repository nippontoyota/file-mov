import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const types = execFileSync("node_modules/.bin/supabase", ["gen", "types", "typescript", "--db-url", dbUrl, "--schema", "public"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const exportIndex = types.indexOf("export type Json");
if (exportIndex === -1) throw new Error("Type generation failed; existing types retained");
const cleanTypes = types.slice(exportIndex);
writeFileSync("src/lib/database.types.ts", cleanTypes);
