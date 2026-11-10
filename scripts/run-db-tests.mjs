import { installFixtures } from "./test-fixtures.mjs";
const cleanup = await installFixtures();
try { await import("./test-db.mjs"); await import("./test-admin-accounts.mjs"); await import("./test-booking-drafts.mjs"); await import("./test-booking-documents.mjs"); }
finally { await cleanup(); }
