import { execFileSync } from "node:child_process";
import path from "node:path";

/** Reload the e2e fixture (supabase/seed/e2e.sql) before every run. */
export default function globalSetup() {
  const db = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  if (!/@(127\.0\.0\.1|localhost):/.test(db)) throw new Error(`refusing to seed non-local database: ${db}`);
  execFileSync("psql", [db, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", path.join(__dirname, "../../supabase/seed/e2e.sql")],
    { stdio: "inherit" });
}
