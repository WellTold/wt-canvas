/**
 * Seed script: Webpage Templates Audit & High-Quality Template Creation
 *
 * This script is idempotent — it can be run multiple times safely.
 * It:
 *   1. Fixes templates that have wrong type casing (e.g. "Blog Article" → "blog_article")
 *   2. Deletes known non-functional test templates (missing system_prompt, dummy blocks)
 *   3. Upserts three high-quality webpage templates (one per webpage type) by name
 *
 * Run with:
 *   npx tsx server/scripts/seed-webpage-templates.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Step 1: Fix type casing ──────────────────────────────────────────────────

const TYPE_FIXES: Record<string, string> = {
  "Blog Article": "blog_article",
  "Landing Page": "landing_page",
  "Lead Magnet": "lead_magnet",
};

async function fixTypeCasing() {
  for (const [wrong, correct] of Object.entries(TYPE_FIXES)) {
    const { data, error } = await supabase
      .from("templates")
      .update({ type: correct })
      .eq("type", wrong)
      .select("id, name");

    if (error) {
      console.error(`Failed to fix type "${wrong}":`, error.message);
    } else if (data.length > 0) {
      console.log(`Fixed ${data.length} templates: "${wrong}" → "${correct}"`);
      data.forEach((t) => console.log(`  - ${t.name}`));
    }
  }
}

// ── Step 2: Delete non-functional test templates ─────────────────────────────
// These are templates with no system_prompt and dummy blocks, identified by name

const NON_FUNCTIONAL_NAMES = ["Test Template", "Product Focus", "Test Product", "Shopify Test"];

async function deleteNonFunctionalTemplates() {
  const { data, error } = await supabase
    .from("templates")
    .delete()
    .in("name", NON_FUNCTIONAL_NAMES)
    .select("id, name");

  if (error) {
    console.error("Failed to delete non-functional templates:", error.message);
  } else if (data.length > 0) {
    console.log(`Deleted ${data.length} non-functional templates:`);
    data.forEach((t) => console.log(`  - ${t.name}`));
  } else {
    console.log("No non-functional templates found to delete (already clean).");
  }
}

// ── Step 3: Upsert high-quality webpage templates ────────────────────────────

const HIGH_QUALITY_TEMPLATES = [
  {
    name: "Deep Dive Article",
    type: "blog_article",
    description:
      "A long-form, SEO-optimised blog article with a strong intro, multiple substantive sections, a featured quote, and a clear CTA. Designed to build authority and trust.",
    system_prompt: `You are writing a long-form blog article for Well Told. This is a brand that values thoughtfulness, craft, and connection — so the writing should feel grounded, warm, and substantive.

For EACH block, write with real depth. Not marketing fluff. Not placeholder copy. Actual content:
- Headings: Clear, specific, human — not keyword-stuffed. Use sentence case. Make them feel like something a thoughtful writer would choose.
- Intro: 3–4 sentences minimum. Hook the reader by naming their situation or question directly. Set up the article's promise.
- Section body paragraphs: Each should be 4–6 sentences, minimum. Include concrete details, examples, or reasoning. Write as if the reader genuinely wants to understand the topic, not just skim it.
- The featured quote: Pull out a single powerful observation — something the reader might screenshot or underline. Make it resonant, not generic.
- Key takeaways list: 4–6 specific, actionable items. Not vague summaries — real insights the reader can carry with them.
- CTA: One to two sentences that feel like a natural next step, not a hard sell.

Write every block as part of a coherent, well-structured article. The sections should build on each other logically. The brand's vocabulary is specific (thoughtful, made with care, meaningful) — avoid hollow corporate or influencer language.`,
    user_prompt_addition:
      "Use natural transitions between sections. Make each section feel like it was written by a person who genuinely knows the subject, not a content robot.",
    structure: [
      "hero_image",
      "article_title",
      "intro_paragraph",
      "divider_1",
      "section_1_heading",
      "section_1_body",
      "section_2_heading",
      "section_2_body",
      "pullquote",
      "divider_2",
      "section_3_heading",
      "section_3_body",
      "key_takeaways",
      "cta",
    ],
    blocks: [
      { block_id: "hero_image", block_type: "image", ai_fillable: false, order: 1, notes: "Hero image — use Cloudinary picker. Choose something evocative of the topic, not generic." },
      { block_id: "article_title", block_type: "heading", ai_fillable: true, order: 2, notes: "H1 title. Specific and intriguing — not a listicle headline. Sentence case. 7–12 words." },
      { block_id: "intro_paragraph", block_type: "paragraph", ai_fillable: true, order: 3, notes: "Opening paragraph. 3–4 sentences. Name the reader's situation, raise the central question, and make a promise about what this article delivers. Conversational but substantive." },
      { block_id: "divider_1", block_type: "divider", ai_fillable: false, order: 4, notes: "Visual divider between intro and main body." },
      { block_id: "section_1_heading", block_type: "heading", ai_fillable: true, order: 5, notes: "H2 heading for first main section. Should feel like a chapter title — clear, direct, human. Sentence case." },
      { block_id: "section_1_body", block_type: "paragraph", ai_fillable: true, order: 6, notes: "First section body. 4–6 sentences. Establish the foundation or context for the topic. Include at least one concrete detail, example, or insight that a generic AI would not produce." },
      { block_id: "section_2_heading", block_type: "heading", ai_fillable: true, order: 7, notes: "H2 heading for second main section. Different angle or dimension from section 1." },
      { block_id: "section_2_body", block_type: "paragraph", ai_fillable: true, order: 8, notes: "Second section body. 4–6 sentences. Go deeper. Add nuance, contrast, or a specific example. This is the heart of the article — don't let it be thin." },
      { block_id: "pullquote", block_type: "quote", ai_fillable: true, order: 9, notes: "A single, powerful observation. 1–2 sentences max. Should feel like something worth sharing — not a summary, but a crystallised insight. No attribution needed." },
      { block_id: "divider_2", block_type: "divider", ai_fillable: false, order: 10, notes: "Visual divider before final sections." },
      { block_id: "section_3_heading", block_type: "heading", ai_fillable: true, order: 11, notes: "H2 heading for the third section. Should point toward application or resolution." },
      { block_id: "section_3_body", block_type: "paragraph", ai_fillable: true, order: 12, notes: "Third section body. 4–6 sentences. Bring it home — practical takeaways, implications, or a clear recommendation. Make the reader feel like they gained something real." },
      { block_id: "key_takeaways", block_type: "list", ai_fillable: true, order: 13, notes: "4–6 key takeaways. Specific and actionable — not restatements of the headings. Each item should be a complete thought, 1–2 sentences." },
      { block_id: "cta", block_type: "cta", ai_fillable: true, order: 14, notes: "Call to action. 1–2 sentences that feel like a natural invitation, not a command. Button text: 3–5 words, action-first." },
    ],
    tags: ["blog", "long-form", "authority", "educational"],
    mood: "conversational",
  },
  {
    name: "Product Story Page",
    type: "landing_page",
    description:
      "A conversion-focused landing page that leads with a powerful hero, tells the product's story, backs it up with social proof, and guides the visitor to a clear next step.",
    system_prompt: `You are writing a product landing page for Well Told. This is not a generic e-commerce page — it's a story-forward page for a brand that believes in the meaning behind what people give.

Write with conviction and warmth. Each section should do real work:

- Hero headline: 6–10 words. The most important thing you want the visitor to feel or understand in the first 3 seconds. Bold, specific, not generic. No exclamation marks.
- Hero subheading: 2–3 sentences. Expand on the headline. Give the visitor a reason to keep reading. Speak to what this product means, not just what it does.
- Problem/insight paragraph: 3–4 sentences. Name the situation this product was made for. Don't be preachy — be specific and real. This is the "you understand me" moment.
- Product story paragraph: 4–5 sentences. Tell the story of this product in a way that makes the visitor understand why it exists. Include craft details, design thinking, or the human moment it was made for.
- Features/benefits list: 4–5 items. Each item should be 1 sentence naming the feature and its meaning. Not just "Made from quality materials" — something specific and meaningful.
- Social proof / quote: 2–3 sentences of genuine-sounding customer sentiment. Make it specific to the type of person who would buy this product. First name only, short descriptor.
- Closing section heading and body: The heading should feel like a gentle invitation. The body (3–4 sentences) should reinforce the core emotional promise and move the visitor toward action.
- CTA: Button text 3–5 words. Action-first. "Shop the collection", "Find yours", "Start here" — not just "Buy now".

Every section should feel coherent, like it was written by a single thoughtful voice, not assembled from parts.`,
    user_prompt_addition:
      "The page should feel like a gift shop, not an Amazon listing. Make the visitor want to be the kind of person who gives this product.",
    structure: [
      "hero_image",
      "hero_headline",
      "hero_subheading",
      "spacer_1",
      "insight_heading",
      "insight_body",
      "product_story_heading",
      "product_story_body",
      "features_list",
      "divider_1",
      "social_proof_quote",
      "closing_heading",
      "closing_body",
      "cta_primary",
    ],
    blocks: [
      { block_id: "hero_image", block_type: "image", ai_fillable: false, order: 1, notes: "Full-width hero image. Use Cloudinary picker. Product in use or lifestyle context — not a white-background product shot." },
      { block_id: "hero_headline", block_type: "heading", ai_fillable: true, order: 2, notes: "H1 hero headline. 6–10 words. The most important thing the visitor should feel in 3 seconds. Specific, not generic. No exclamation marks." },
      { block_id: "hero_subheading", block_type: "heading", ai_fillable: true, order: 3, notes: "H2 subheading under the hero. 2–3 sentences that expand on the headline and make the visitor want to scroll. Warm and inviting." },
      { block_id: "spacer_1", block_type: "spacer", ai_fillable: false, order: 4, notes: "Spacer for breathing room before the story sections." },
      { block_id: "insight_heading", block_type: "heading", ai_fillable: true, order: 5, notes: "H2 heading for the insight/problem section. Should name the human moment this product serves — 5–8 words." },
      { block_id: "insight_body", block_type: "paragraph", ai_fillable: true, order: 6, notes: "3–4 sentences. Name the situation this product was made for. Speak directly to the visitor's experience. The 'you understand me' moment. Be specific, not generic." },
      { block_id: "product_story_heading", block_type: "heading", ai_fillable: true, order: 7, notes: "H2 heading for the product story section. Should hint at the craft or care behind the product." },
      { block_id: "product_story_body", block_type: "paragraph", ai_fillable: true, order: 8, notes: "4–5 sentences on the product's origin, design thinking, or the human moment it was created for. Make the visitor understand why this product exists. Include sensory or craft details." },
      { block_id: "features_list", block_type: "list", ai_fillable: true, order: 9, notes: "4–5 features or benefits. Each as a complete sentence naming the feature and why it matters. Specific — not 'quality materials' but what those materials do for the recipient." },
      { block_id: "divider_1", block_type: "divider", ai_fillable: false, order: 10, notes: "Visual divider between product details and social proof." },
      { block_id: "social_proof_quote", block_type: "quote", ai_fillable: true, order: 11, notes: "A genuine-sounding customer quote. 2–3 sentences specific to the product experience. Attribution: first name only + short descriptor (e.g. 'Emma, gift for her dad's retirement')." },
      { block_id: "closing_heading", block_type: "heading", ai_fillable: true, order: 12, notes: "H2 closing section heading. A gentle, warm invitation — 5–8 words. Should feel like the natural next step." },
      { block_id: "closing_body", block_type: "paragraph", ai_fillable: true, order: 13, notes: "3–4 sentences. Reinforce the emotional promise of the product. Make the visitor feel like choosing this is an expression of care. Lead naturally into the CTA." },
      { block_id: "cta_primary", block_type: "cta", ai_fillable: true, order: 14, notes: "Primary call to action. Button text 3–5 words. Action-first but not pushy. 'Shop the collection', 'Find yours', 'Start here' — not 'Buy now'." },
    ],
    tags: ["landing-page", "product", "conversion", "story"],
    mood: "aspirational",
  },
  {
    name: "Expert Resource Guide",
    type: "lead_magnet",
    description:
      "A value-packed lead magnet page that positions the brand as a trusted expert, clearly communicates what the reader gets, and makes signing up feel like a no-brainer.",
    system_prompt: `You are writing a lead magnet landing page for Well Told. This page needs to convince a visitor to give their email address in exchange for a resource — a guide, checklist, template, or toolkit.

The copy needs to do three things: establish that you understand the visitor's problem, show that this resource is genuinely valuable (not generic filler), and make the ask feel easy and worth it.

Write each section with real substance:

- Hero headline: 7–12 words. Name what the visitor gets AND the problem it solves. Be direct and specific. Sentence case.
- Hero subheading: 2–3 sentences. Expand on the headline. Make the visitor feel seen — you know their situation. Name the transformation or relief this resource provides.
- Problem statement: 3–4 sentences. Describe the frustration or gap this resource addresses. Use real language — not corporate speak. Make the visitor nod along.
- What's inside heading + body: Explain what's in the resource with specifics. 3–4 sentences. Don't just say "comprehensive guide" — say what sections, frameworks, or answers it includes.
- What you'll gain list: 4–6 items. Specific outcomes or insights the reader will walk away with. Write each as a complete sentence starting with an action verb or a tangible result.
- Social proof quote: 2–3 sentences. Someone who found real value in similar content from this brand. First name + context. Should feel genuinely helpful, not promotional.
- Closing section: 2–3 sentences. Low-pressure, high-warmth close. Remind them of the value, make the ask feel easy.
- CTA: Button text 3–5 words. Should feel like gaining something, not giving something: "Get the guide", "Send me the guide", "Yes, I want this".

Voice: Warm, knowledgeable, genuine. Like a trusted friend who knows a lot about this topic, not a conversion copywriter.`,
    user_prompt_addition:
      "Make the visitor feel that this resource was made specifically for someone in their situation. Every claim should be believable and specific.",
    structure: [
      "hero_image",
      "hero_headline",
      "hero_subheading",
      "spacer_1",
      "problem_heading",
      "problem_body",
      "divider_1",
      "whats_inside_heading",
      "whats_inside_body",
      "gains_list",
      "divider_2",
      "social_proof_quote",
      "closing_body",
      "cta",
    ],
    blocks: [
      { block_id: "hero_image", block_type: "image", ai_fillable: false, order: 1, notes: "Hero image — use Cloudinary picker. Should suggest the resource (e.g. a beautifully laid-out guide, a thoughtful workspace, relevant product/lifestyle)." },
      { block_id: "hero_headline", block_type: "heading", ai_fillable: true, order: 2, notes: "H1 headline. 7–12 words. Name what the visitor gets AND the problem it solves. Direct, specific, sentence case. Should make the visitor think 'I need this'." },
      { block_id: "hero_subheading", block_type: "heading", ai_fillable: true, order: 3, notes: "H2 subheading. 2–3 sentences. Make the visitor feel seen — name their situation and the transformation this resource delivers. Warm and conversational." },
      { block_id: "spacer_1", block_type: "spacer", ai_fillable: false, order: 4, notes: "Spacer for breathing room." },
      { block_id: "problem_heading", block_type: "heading", ai_fillable: true, order: 5, notes: "H2 heading for problem/context section. 5–8 words. Should name the frustration or gap this resource addresses." },
      { block_id: "problem_body", block_type: "paragraph", ai_fillable: true, order: 6, notes: "3–4 sentences. Describe the specific frustration or knowledge gap this resource fills. Use real language. Make the visitor feel understood." },
      { block_id: "divider_1", block_type: "divider", ai_fillable: false, order: 7, notes: "Visual divider." },
      { block_id: "whats_inside_heading", block_type: "heading", ai_fillable: true, order: 8, notes: "H2 heading for 'What's Inside' section. Something like 'What you'll find inside' or 'Here's what we cover' — but make it feel specific to the resource." },
      { block_id: "whats_inside_body", block_type: "paragraph", ai_fillable: true, order: 9, notes: "3–4 sentences describing the specific sections, frameworks, or insights inside the resource. Be concrete — no vague superlatives. Make it feel genuinely useful." },
      { block_id: "gains_list", block_type: "list", ai_fillable: true, order: 10, notes: "4–6 outcomes or insights the reader gains. Each as a complete sentence starting with an action verb or naming a tangible result. Specific, not vague." },
      { block_id: "divider_2", block_type: "divider", ai_fillable: false, order: 11, notes: "Visual divider before social proof." },
      { block_id: "social_proof_quote", block_type: "quote", ai_fillable: true, order: 12, notes: "2–3 sentence customer quote about the value of similar content from this brand. First name + context (e.g. 'Sarah, small business owner'). Should feel genuine and specific." },
      { block_id: "closing_body", block_type: "paragraph", ai_fillable: true, order: 13, notes: "2–3 sentences. Low-pressure, high-warmth close. Remind the visitor of the core value and make the ask feel easy and natural." },
      { block_id: "cta", block_type: "cta", ai_fillable: true, order: 14, notes: "CTA button. Text 3–5 words. Should feel like gaining something: 'Get the guide', 'Send me the guide', 'Yes, I want this' — not a generic 'Sign up' or 'Submit'." },
    ],
    tags: ["lead-magnet", "resource", "guide", "email-capture"],
    mood: "helpful",
  },
];

async function upsertHighQualityTemplates() {
  for (const template of HIGH_QUALITY_TEMPLATES) {
    const { data: existing } = await supabase
      .from("templates")
      .select("id")
      .eq("name", template.name)
      .eq("type", template.type)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("templates")
        .update(template)
        .eq("id", existing.id);

      if (error) {
        console.error(`Failed to update template "${template.name}":`, error.message);
      } else {
        console.log(`Updated existing template: "${template.name}"`);
      }
    } else {
      const { error } = await supabase.from("templates").insert(template);
      if (error) {
        console.error(`Failed to insert template "${template.name}":`, error.message);
      } else {
        console.log(`Created new template: "${template.name}" (${template.type})`);
      }
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Template Audit & Seed Script ===\n");

  console.log("Step 1: Fixing template type casing...");
  await fixTypeCasing();

  console.log("\nStep 2: Deleting non-functional test templates...");
  await deleteNonFunctionalTemplates();

  console.log("\nStep 3: Upserting high-quality webpage templates...");
  await upsertHighQualityTemplates();

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
