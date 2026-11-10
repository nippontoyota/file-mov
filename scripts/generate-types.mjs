import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const types = execFileSync("node_modules/.bin/supabase", ["gen", "types", "typescript", "--schema", "public"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
if (!types.includes("export type Database")) throw new Error("Type generation failed; existing types retained");
writeFileSync("src/lib/database.types.ts", types);
