/**
 * Test Klaviyo campaign creation directly, without going through the app UI or a deploy.
 *
 * Uses the real stored Klaviyo API key (from the integrations table), so it must be run
 * in an environment with the real DATABASE_URL — e.g. your Replit workspace Shell.
 *
 * Run with:
 *   npx tsx server/scripts/test-campaign-push.ts                 # auto-picks the first list found
 *   npx tsx server/scripts/test-campaign-push.ts <audienceId>     # use a specific list/segment id
 */

import { listLists, listSegments, createCampaign } from "../services/klaviyo";

async function main() {
  const audienceIdArg = process.argv[2];

  let audienceId = audienceIdArg;
  let audienceType: "list" | "segment" = "list";

  if (!audienceId) {
    console.log("No audience id given — fetching lists…");
    const lists = await listLists();
    if (lists.length === 0) {
      console.log("No lists found, trying segments…");
      const segments = await listSegments();
      if (segments.length === 0) {
        console.error("No lists or segments found in this Klaviyo account. Pass an audience id explicitly.");
        process.exit(1);
      }
      audienceId = segments[0].id;
      audienceType = "segment";
      console.log(`Using segment "${segments[0].name}" (${audienceId})`);
    } else {
      audienceId = lists[0].id;
      console.log(`Using list "${lists[0].name}" (${audienceId})`);
    }
  }

  console.log("\nCreating test campaign…");
  try {
    const result = await createCampaign({
      name: `[TEST] Canvas campaign-push test ${new Date().toISOString()}`,
      subject: "Test subject line",
      previewText: "Test preview text",
      fromEmail: "shop@welltolddesign.com",
      fromLabel: "Well Told",
      audienceId,
      audienceType,
      html: "<p>Test campaign push from Canvas test script.</p>",
    });
    console.log("\n✅ Success:");
    console.log(result);
  } catch (err) {
    console.log("\n❌ Failed:");
    console.error(err);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
