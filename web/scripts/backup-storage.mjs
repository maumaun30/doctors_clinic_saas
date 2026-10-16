// Nightly backup: download every file in the buckets that hold clinic
// data (lab result files, staff photos) into a folder, keeping paths.
// The `exports` bucket is skipped — it only holds short-lived downloads.
// With --restore, upload such a folder back (see docs/backups.md).
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-storage.mjs [--restore] <dir>
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["lab-results", "avatars"];
const PAGE = 1000;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const restore = process.argv[2] === "--restore";
const outDir = process.argv[restore ? 3 : 2];
if (!url || !key || !outDir) {
  console.error("usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-storage.mjs [--restore] <dir>");
  process.exit(2);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

// list() is one folder at a time; folders come back with a null id.
async function* walk(store, prefix) {
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await store.list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) yield* walk(store, path);
      else yield path;
    }
    if (data.length < PAGE) return;
  }
}

// Content type per "bucket/path", written by the backup, used by --restore.
const MANIFEST = "content-types.json";
const files = dir => readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter(e => e.isFile()).map(e => join(e.parentPath, e.name));

let total = 0;
if (restore) {
  const types = JSON.parse(readFileSync(join(outDir, MANIFEST), "utf8"));
  for (const bucket of BUCKETS) {
    const root = join(outDir, bucket);
    let n = 0;
    for (const file of (() => { try { return files(root); } catch { return []; } })()) {
      const path = relative(root, file).split("\\").join("/");
      const { error } = await sb.storage.from(bucket).upload(path, readFileSync(file), {
        upsert: true, contentType: types[`${bucket}/${path}`] ?? "application/octet-stream",
      });
      if (error) throw new Error(`upload ${bucket}/${path}: ${error.message}`);
      n++;
    }
    console.log(`${bucket}: ${n} files uploaded`);
    total += n;
  }
  console.log(`storage total: ${total} files uploaded`);
  process.exit(0);
}

const types = {};
for (const bucket of BUCKETS) {
  const store = sb.storage.from(bucket);
  let n = 0;
  for await (const path of walk(store, "")) {
    const { data, error } = await store.download(path);
    if (error) throw new Error(`download ${bucket}/${path}: ${error.message}`);
    const file = join(outDir, bucket, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await data.arrayBuffer()));
    types[`${bucket}/${path}`] = data.type;
    n++;
  }
  console.log(`${bucket}: ${n} files`);
  total += n;
}
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, MANIFEST), JSON.stringify(types, null, 2));
console.log(`storage total: ${total} files`);
