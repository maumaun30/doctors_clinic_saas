import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

/**
 * Rows → CSV (RFC 4180). Cells that a spreadsheet would treat as a formula
 * (=, +, -, @, tab, CR) get a leading apostrophe, so an exported patient
 * name can't run code when the file is opened in Excel or Sheets.
 */
export function toCsv(rows: Row[], columns?: string[]): string {
  const cols = columns ?? [...new Set(rows.flatMap(r => Object.keys(r)))];
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM: Excel opens UTF-8 (ñ, é) correctly
}

/** Every row the caller can see (RLS applies), paging past PostgREST's 1,000-row cap. */
export async function fetchAll(sb: SupabaseClient, table: string, select = "*", orderBy = "id"): Promise<Row[]> {
  const PAGE = 1000;
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(select).order(orderBy).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) return out;
  }
}
