/**
 * Read-only export of everything needed for an SEO/keyword audit:
 * all articles/pages in every status (Supabase) plus the keyword list (Postgres).
 *
 * Writes seo-audit-export.json to the workspace root (gitignored). Changes nothing.
 *
 * Run with:
 *   npx tsx server/scripts/export-seo-audit.ts
 */

import { writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { db } from "../db";
import { keywords } from "@shared/schema";

const OUTPUT = "seo-audit-export.json";
const TABLES = ["blog_articles", "landing_pages", "lead_magnets"] as const;

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  const content: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    content[table] = data ?? [];
    console.log(`${table}: ${data?.length ?? 0} rows`);
  }

  const keywordRows = await db.select().from(keywords);
  console.log(`keywords: ${keywordRows.length} rows`);

  writeFileSync(
    OUTPUT,
    JSON.stringify({ exportedAt: new Date().toISOString(), content, keywords: keywordRows }, null, 2),
  );
  console.log(`\nWrote ${OUTPUT}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
