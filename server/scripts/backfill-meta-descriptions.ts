/**
 * Backfill script: populate meta_description for live content that's missing it.
 *
 * Safe to re-run — only touches rows where meta_description is null or empty,
 * so it can be run periodically to catch anything the generation pipeline
 * still misses (manual imports, older rows, etc).
 *
 * Run with:
 *   npx tsx server/scripts/backfill-meta-descriptions.ts
 */

import { createClient } from "@supabase/supabase-js";
import { generateMetaDescription } from "../services/claude";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TABLES: Array<{ name: string; type: string }> = [
  { name: "blog_articles", type: "blog_article" },
  { name: "landing_pages", type: "landing_page" },
  { name: "lead_magnets", type: "lead_magnet" },
];

async function backfillTable(table: string, type: string) {
  const { data, error } = await supabase
    .from(table)
    .select("id, title, focus_keyword, supporting_keywords")
    .eq("status", "live")
    .or("meta_description.is.null,meta_description.eq.");

  if (error) {
    console.error(`[backfill] Failed to fetch ${table}:`, error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log(`[backfill] ${table}: nothing to do`);
    return;
  }

  console.log(`[backfill] ${table}: ${data.length} row(s) missing meta_description`);

  for (const row of data) {
    try {
      const metaDescription = await generateMetaDescription(
        row.title,
        type,
        row.focus_keyword || undefined,
        row.supporting_keywords || undefined,
      );
      const { error: updateError } = await supabase
        .from(table)
        .update({ meta_description: metaDescription })
        .eq("id", row.id);
      if (updateError) {
        console.error(`[backfill] ${table} ${row.id} update failed:`, updateError.message);
        continue;
      }
      console.log(`[backfill] ${table} ${row.id} "${row.title}" (${metaDescription.length} chars) → "${metaDescription}"`);
    } catch (e) {
      console.error(`[backfill] ${table} ${row.id} generation failed:`, (e as Error).message);
    }
  }
}

async function main() {
  for (const { name, type } of TABLES) {
    await backfillTable(name, type);
  }
  console.log("[backfill] Done.");
}

main();
