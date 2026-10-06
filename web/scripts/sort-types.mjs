// Normalize `supabase gen types` output: the CLI emits RPC Args/Returns
// properties in an order that varies between databases, which makes the
// committed file churn and CI's drift check flaky. Sort every contiguous
// run of single-line properties at the same indentation. stdin -> stdout.
import { readFileSync } from "node:fs";

const prop = /^(\s+)("?[A-Za-z_][\w]*"?\??): [^{]*$/;
const lines = readFileSync(0, "utf8").split("\n");
const out = [];
let run = [];
let indent = null;

const flush = () => {
  run.sort((a, b) => a.match(prop)[2].replace(/[?"]/g, "").localeCompare(b.match(prop)[2].replace(/[?"]/g, "")));
  out.push(...run);
  run = [];
  indent = null;
};

for (const line of lines) {
  const m = line.match(prop);
  if (m && (indent === null || m[1] === indent)) {
    indent = m[1];
    run.push(line);
  } else {
    flush();
    if (m) { indent = m[1]; run.push(line); } else out.push(line);
  }
}
flush();
process.stdout.write(out.join("\n"));
