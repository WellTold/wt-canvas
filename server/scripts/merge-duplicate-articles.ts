/**
 * Consolidate articles that compete for the same Google search (keyword cannibalization).
 *
 * For each group below, one article is kept and the others are retired:
 *   - the retired slugs are added to the kept article's redirect_from, so the Worker
 *     301-redirects them (rankings and links pass to the kept page);
 *   - retired articles are set back to status "draft" — nothing is deleted, so any
 *     merge can be undone by setting the draft live again and removing its slug from
 *     the kept article's redirect_from;
 *   - keywords linked to a retired article are re-linked to the kept one.
 *
 * Plan was drawn from the 2026-10-19 crawl of welltolddesign.com/a/articles.
 *
 * Run with:
 *   npx tsx server/scripts/merge-duplicate-articles.ts            # dry run: prints what would change
 *   npx tsx server/scripts/merge-duplicate-articles.ts --apply    # makes the changes
 */

import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { keywords } from "@shared/schema";

interface MergeGroup {
  search: string;
  keep: string;
  retire: string[];
}

export const MERGE_PLAN: MergeGroup[] = [
  {
    search: "gifts for him / men",
    keep: "best-gifts-for-him-unique-ideas-hell-actually-love",
    retire: [
      "best-gifts-for-men-in-2025-according-to-people-who-actually-shop",
      "gift-for-men-thoughtful-picks-hell-actually-use",
    ],
  },
  {
    search: "gifts for men who have everything",
    keep: "gifts-for-men-who-are-impossible-to-shop-for",
    retire: [
      "what-to-get-the-guy-who-already-has-everything",
      "what-to-get-the-man-who-says-he-doesnt-need-anything",
    ],
  },
  {
    search: "christmas gifts for men who are hard to shop for",
    keep: "christmas-gifts-for-the-guy-whos-genuinely-hard-to-shop-for",
    retire: [
      "christmas-gifts-for-the-guy-who-never-asks-for-anything",
      "christmas-gifts-for-the-man-who-never-asks-for-anything",
    ],
  },
  {
    search: "gifts for women",
    keep: "best-gifts-for-women-thoughtful-ideas-shell-actually-love",
    retire: [
      "thoughtful-gift-ideas-for-the-woman-who-means-so-much-to-you",
      "thoughtful-gifts-women-actually-want-to-give-other-women",
    ],
  },
  {
    search: "gifts for boyfriend",
    keep: "best-gifts-for-boyfriend-unique-ideas-hell-actually-love",
    retire: [
      "thoughtful-gift-ideas-for-your-boyfriend-from-someone-who-gets-him",
      "what-to-get-your-boyfriend-when-he-says-he-wants-nothing",
    ],
  },
  {
    search: "gifts for dad",
    keep: "best-gifts-for-dad-unique-ideas-hell-actually-love",
    retire: ["gift-ideas-for-dad-from-the-guy-whos-hard-to-shop-for"],
  },
  {
    search: "gifts for mom",
    keep: "best-gifts-for-mom-that-show-how-much-you-care",
    retire: [
      "what-to-get-mom-when-thank-you-isnt-enough",
      "what-to-get-mom-when-you-want-to-show-you-really-know-her",
    ],
  },
  {
    search: "christmas gifts for mom",
    keep: "what-to-get-mom-for-christmas-when-she-says-she-doesnt-need-anything",
    retire: [
      "christmas-gift-ideas-for-mom-shell-actually-use-all-year",
      "christmas-gifts-for-mom-shell-actually-want-to-unwrap",
    ],
  },
  {
    search: "star map gifts",
    keep: "star-maps-as-gifts-a-sweet-way-to-mark-a-meaningful-date",
    retire: ["what-do-you-get-someone-who-wants-to-remember-a-certain-night"],
  },
  {
    search: "wedding gifts",
    keep: "what-to-get-a-couple-for-their-wedding-according-to-us",
    retire: [
      "wedding-gifts-a-couple-will-actually-want-to-keep",
      "what-to-get-when-youre-invited-to-a-wedding-this-season", // returns HTTP 500
    ],
  },
  {
    search: "gifts for travelers",
    keep: "gifts-for-travelers-who-notice-the-little-things-along-the-way",
    retire: ["best-birthday-gifts-for-travelers-25-perfect-ideas-theyll-love"],
  },
  {
    search: "birthday gifts for him",
    keep: "birthday-gifts-for-him-that-feel-thoughtful-not-predictable",
    retire: ["birthday-gifts-for-men-who-say-they-dont-need-anything"],
  },
  {
    search: "christmas gifts for dad",
    keep: "christmas-gifts-for-dad-that-feel-thoughtful-not-predictable",
    retire: ["christmas-gift-ideas-for-dad-thoughtful-picks-hell-actually-use"],
  },
  {
    search: "gifts for wife",
    keep: "gifts-for-your-wife-that-feel-as-thoughtful-as-they-look",
    retire: ["gift-ideas-for-your-wife-that-feel-thoughtful-not-generic"],
  },
  {
    search: "gifts for girlfriend",
    keep: "thoughtful-gifts-for-girlfriend-that-feel-personal-not-generic",
    retire: ["thoughtful-gift-ideas-for-your-girlfriend-from-someone-who-gets-it"],
  },
  {
    search: "valentine's day gifts for him",
    keep: "valentines-day-gifts-for-him-that-dont-feel-like-an-afterthought",
    retire: ["what-to-give-him-for-valentines-day-when-he-says-he-doesnt-need-anything"],
  },
];

const APPLY = process.argv.includes("--apply");
const TABLE = "blog_articles";

async function purgeCloudflare(slugs: string[]) {
  if (!process.env.CF_ZONE_ID || !process.env.CF_API_TOKEN || slugs.length === 0) {
    console.log("  (Cloudflare purge skipped — CF_ZONE_ID/CF_API_TOKEN not set; pages refresh within the hour)");
    return;
  }
  const base = process.env.SITE_BASE_URL || "https://welltolddesign.com";
  const files = [...slugs.map((s) => `${base}/a/articles/${s}`), `${base}/a/articles`, `${base}/a/articles/sitemap.xml`];
  // Cloudflare accepts up to 30 URLs per purge call.
  for (let i = 0; i < files.length; i += 30) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ files: files.slice(i, i + 30) }),
    });
    console.log(`  Cloudflare purge ${res.ok ? "ok" : `failed (${res.status})`} for ${files.slice(i, i + 30).length} URLs`);
  }
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  );

  const allSlugs = MERGE_PLAN.flatMap((g) => [g.keep, ...g.retire]);
  const { data: rows, error } = await supabase.from(TABLE).select("id, slug, title, status, redirect_from").in("slug", allSlugs);
  if (error) throw new Error(`Failed to read ${TABLE}: ${error.message}`);
  const bySlug = new Map((rows ?? []).map((r: any) => [r.slug as string, r]));

  console.log(APPLY ? "APPLYING merge plan\n" : "DRY RUN — nothing will change. Re-run with --apply to make these changes.\n");

  const touchedSlugs: string[] = [];
  let retiredCount = 0;

  for (const group of MERGE_PLAN) {
    const keep = bySlug.get(group.keep);
    console.log(`▸ ${group.search}`);
    if (!keep) {
      console.log(`  ! kept article not found: ${group.keep} — skipping this group`);
      continue;
    }
    if (keep.status !== "live") {
      console.log(`  ! kept article "${group.keep}" is ${keep.status}, not live — skipping this group`);
      continue;
    }
    console.log(`  keep   ${keep.slug}`);

    const retiring = group.retire.map((slug) => ({ slug, row: bySlug.get(slug) }));
    for (const r of retiring) {
      console.log(`  retire ${r.slug}${r.row ? ` (${r.row.status})` : " (not found — will still redirect)"}`);
    }

    const redirectFrom = Array.from(new Set([...(keep.redirect_from ?? []), ...group.retire]));
    if (!APPLY) continue;

    const { error: keepErr } = await supabase.from(TABLE).update({ redirect_from: redirectFrom }).eq("id", keep.id);
    if (keepErr) {
      console.log(`  ! failed to add redirects to ${keep.slug}: ${keepErr.message} — leaving this group's articles as they are`);
      continue;
    }

    for (const r of retiring) {
      if (!r.row) continue;
      if (r.row.status === "live") {
        const { error: retireErr } = await supabase
          .from(TABLE)
          .update({ status: "draft", updated_at: new Date().toISOString() })
          .eq("id", r.row.id);
        if (retireErr) {
          console.log(`  ! failed to retire ${r.slug}: ${retireErr.message}`);
          continue;
        }
        retiredCount++;
      }
      // Point keywords that targeted the retired article at the kept one.
      await db
        .update(keywords)
        .set({ contentItemId: String(keep.id), contentItemTitle: keep.title })
        .where(eq(keywords.contentItemId, String(r.row.id)));
    }
    touchedSlugs.push(keep.slug, ...group.retire);
  }

  if (APPLY) {
    await purgeCloudflare(touchedSlugs);
    console.log(`\nDone. Retired ${retiredCount} live article(s) into redirects.`);
  } else {
    console.log(`\n${MERGE_PLAN.reduce((n, g) => n + g.retire.length, 0)} articles would be retired into ${MERGE_PLAN.length} kept pages.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
