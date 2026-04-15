# Canvas — Updated Project Spec & Build Priority
## Incorporating Current Status + AI Content Generation Feature

**Prepared for:** Replit  
**Date:** March 2026  
**Context:** This document reconciles your phase status report with a new AI content generation feature spec. Read it as the current source of truth for what to build next and in what order.

---

## What This Document Does

You sent back a detailed status report across all phases. Most of it is good news — the foundation is largely in place. This document does three things:

1. Acknowledges your status report as accurate and flags the items that need to be resolved before we move forward
2. Introduces a new AI Content Generation feature (full spec in Part 3) that slots into the existing phase structure
3. Gives you a revised priority order so you're always working on the highest-value unblocked task

---

## Part 1 — Status Review: What Needs Attention Before Moving Forward

Most items are either done or clearly queued. Here are the ones that matter most to address:

---

### 1A — Cloudflare Cache Purge on Publish (was 1D, ⚠️ Partial)

**Priority: Fix this first. It's small and it's a live SEO problem.**

Right now when content is published, the Cloudflare Worker isn't explicitly purging the cached version of that page. That means editors can publish a change and see the old version in the browser for an unknown amount of time. For an SEO content workflow this is a trust-destroying bug — you publish, you check, it looks broken.

**What to build:**
When a page is published in Canvas, immediately after the Supabase write succeeds, make a call to the Cloudflare Cache Purge API for that page's URL.

```
POST https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/purge_cache
Authorization: Bearer {CF_API_TOKEN}
Body: { "files": ["https://welltold.design/pages/{slug}"] }
```

Store `CF_ZONE_ID` and `CF_API_TOKEN` in Replit Secrets. The purge call should happen server-side in the publish route, not in the frontend. If the purge call fails, log the error but don't block the publish — the content is still saved.

---

### 1B — Missing SEO Editor Fields (was 1G, ⚠️ Partial)

**Priority: High. Canonical URL is the most important missing piece.**

Primary keyword exists. What's missing:

**Canonical URL override** — Add a text input in the page editor's SEO panel. Prepopulate it with the expected canonical (`https://welltolddesign.com/pages/{slug}`) so the editor can see it, but allow manual override. This value must be written into the `<link rel="canonical">` tag by the Cloudflare Worker when it renders the page. **This is the single highest-priority SEO field.** Without it, Google can index the wrong domain and split page authority.

**OG image field** — Add an image URL input in the SEO panel. This populates `og:image` in the Worker-rendered HTML head. The Cloudinary picker should be the input UI here (same picker used in content blocks).

**Structured data type selector** — A simple dropdown: Article, Product, FAQPage, None. Store the value; the Worker uses it to decide which JSON-LD schema block to inject. For now, Article and None are sufficient. Product and FAQ can be wired later.

**Redirect-from manager** — Lower priority than the above three. Skip for now, flag for Phase 3.

---

### 1C — Email Block Type Completion (was 2C, ⚠️ Partial)

**Priority: Medium — but a dependency for the AI generation feature.**

Core blocks render. Missing from the full set:
- Coupon / promo code block
- Countdown timer block
- Quote / pullquote block
- UGC / customer review block
- Divider (styled, not just `<hr>`)
- List block (bulleted or numbered text)

The AI content generation feature (Part 3 of this document) fills text blocks. If these block types don't exist yet, the AI has nothing to fill. Complete the block type set before wiring up bulk AI generation.

The more complex interactive blocks (abandoned cart dynamic block, loyalty block) can wait for Phase 4 Klaviyo integration.

---

### 1D — Auth Migration: Replit PostgreSQL → Supabase (was 0A, ❌ Not done)

**Priority: Deprioritize for now. Don't let this block other work.**

This is the right thing to do long-term — one database instead of two is cleaner — but it's a larger refactor with real risk to live functionality. Keep it on the roadmap but don't start it until the email builder and AI generation features are stable. Flag it as a Phase 5 item. We'll schedule it deliberately.

---

## Part 2 — New Infrastructure Required for AI Content Generation

Before building the AI feature UI, add the following to the database and backend. These are the foundation everything in Part 3 depends on.

### 2A — New Supabase Table: `brand_context`

Single-row settings table. Use a singleton pattern (always upsert the same fixed UUID).

```sql
CREATE TABLE brand_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_document text,
  avoid_rules text[],
  always_rules text[],
  words_we_use text[],
  words_we_avoid text[],
  updated_at timestamptz DEFAULT now()
);
```

### 2B — Add `mood` to Templates Table

```sql
ALTER TABLE templates ADD COLUMN mood text DEFAULT 'conversational';
```

Valid values: `warm-sentimental`, `celebratory`, `urgent`, `helpful`, `conversational`, `aspirational`

Seed the mood values for existing templates using this mapping:

| Mood | Template IDs |
|---|---|
| `warm-sentimental` | F1, F3, F9, F13, F16, F17, F18, C12, C13, C14, C15 |
| `celebratory` | C1, C2, F2, F16 |
| `urgent` | C7, C8, F5 |
| `helpful` | F7, F8, F10, F11, C19 |
| `conversational` | F6, F12, F14, F15, F4, C17, C20, C16 |
| `aspirational` | C3, C4, C5, C6, C9, C10, C11, C18 |

### 2C — Add `mood_override` to Template Instances Table

```sql
ALTER TABLE template_instances ADD COLUMN mood_override text DEFAULT NULL;
```

NULL = use the template's default mood. A non-null value = user has overridden it for this specific instance.

### 2D — Add `ai_fillable` Flag to Block Schema

Each template record needs to define its block schema — the list of blocks, their IDs, types, and whether AI should fill them. If this structure doesn't already exist on template records in the database, add it now as a `blocks` JSONB column on the templates table.

```sql
ALTER TABLE templates ADD COLUMN IF NOT EXISTS blocks jsonb;
```

Each block entry in the array should look like:

```json
{
  "block_id": "hero_heading",
  "block_type": "heading",
  "ai_fillable": true,
  "notes": "Main hero headline. Short and punchy. 6–10 words."
}
```

Set `ai_fillable: false` for: image blocks, product URL blocks, promo code blocks, price fields.  
Set `ai_fillable: true` for: all heading, paragraph, CTA button text, email subject, preview text, quote, list, alt text blocks.

### 2E — API Routes for Brand Context

```
GET  /api/settings/brand-context   → returns single brand_context row
PUT  /api/settings/brand-context   → upserts single brand_context row
```

### 2F — Claude API Migration Check

You noted 0C (OpenAI → Claude) is ✅ Done. Confirm that the existing generate endpoint is already using `claude-sonnet-4-20250514` and the key is stored as `CLAUDE_API_KEY` in Replit Secrets. If the migration only covered part of the codebase, complete it now before adding new generation endpoints. All AI calls in Canvas should use Claude, not OpenAI.

---

## Part 3 — AI Content Generation Feature Spec

This is the full spec for the new AI content generation system. Build this after the infrastructure in Part 2 is in place and the email block types in Part 1C are complete.

---

### 3A — Brand Context Settings Panel

**Location in Canvas:** Settings → Brand Context (new settings section)

A global settings panel. Changes here affect all future AI generation calls.

**Sections:**

**Brand Voice Document**  
Full-height rich text or markdown editor. The user pastes or types the Well Told personality document here. This content is injected verbatim into the AI system prompt on every generation call. Provide a "Last updated" timestamp so editors know if it's stale.

**Grammar & Style Rules**  
Two labeled lists (each with an "+ Add rule" button and delete icon per row):
- **Always:** rules the AI must follow (e.g., "Use sentence case for all headings")
- **Avoid:** things the AI must never do (e.g., "Never use exclamation marks more than once per email")

**Tone Vocabulary**  
Two labeled lists, same UI pattern:
- **Words we use** (e.g., "crafted, intentional, grounded, honest")  
- **Words we avoid** (e.g., "amazing, incredible, journey, synergy")

On first load, pre-populate all sections with the default content provided at the end of this document (Part 4). The user can edit from there.

---

### 3B — Mood Badge in Template Editor

Show the current mood as a clickable pill badge in the template editor header/toolbar, near the template name.

**Label format:** `✦ Warm & Sentimental` / `✦ Urgent` / `✦ Aspirational` etc.

Clicking the badge opens a dropdown with all 6 mood options. Selecting one:
1. Saves the selection to `mood_override` on the instance record
2. Updates the badge label immediately
3. Shows a brief toast: "Mood updated — regenerated content will use this tone"

Visual distinction: default mood (no override) = standard badge weight; user override applied = slightly bolder or with a small dot indicator, so it's clear the default has been changed.

The mood badge is also present and interactive inside the pre-launch setup modal (described next), so the user can adjust it before generation runs.

---

### 3C — Pre-Launch Setup Modal

This modal intercepts the template launch. Instead of opening a blank template immediately, it collects context first and offers a choice between auto-generating all text blocks at once or opening manually.

**Trigger:** User clicks "New Email" or "New Page" and selects a template.

**Modal layout:**

**Header:** Template name + interactive mood badge

**Field 1 — Description** *(required)*  
Textarea, 3–4 rows.  
Placeholder for email: *"What is this email about? Include key details — product names, offer specifics, the story you want to tell."*  
Placeholder for web page: *"What is this page about? Include the topic, key points, and the audience you're writing for."*

**Field 2 — Title** *(optional)*  
Single text input. Label: *"Title or subject line (optional — AI will generate one if left blank)"*  
For email: seeds the subject line. For web page: seeds the H1.

**Field 3 — Context fields** *(conditional — show only the relevant fields based on template type)*

| Template Category | Fields |
|---|---|
| Product templates | Product name, Key details / materials (text), Product URL (optional) |
| Sale / Promo templates | Offer description, Promo code (text), Sale end date (date picker) |
| Collection templates | Collection name, Collection theme |
| Give Back / Mission | Cause or charity name, Impact stat or story detail (optional) |
| Post-Purchase flows | Product name (optional) |
| Re-engagement, Transactional | No additional fields |

**Field 4 — Generation mode** *(required)*  
Two clearly differentiated button options:

```
[ ✦ Auto-Generate All Blocks ]       [ Open Template Manually ]
  AI fills every text block in          Start with a blank template.
  this template at once. Edit           Use per-block generate buttons
  anything you want after.              as you go.
```

**Footer:**
- "Cancel" — closes modal, returns to template picker
- Primary action button — label changes based on selected mode:
  - Auto-Generate selected: "Generate & Open →"
  - Manual selected: "Open Template →"

**Auto-generate loading state:**  
When "Generate & Open →" is clicked, replace the modal form with a centered spinner and the label: *"Generating content for [Template Name]..."*  
On success: modal closes, template opens with all text blocks pre-populated.  
On error: show inline error with a "Try again" button. Do not close the modal on error.

---

### 3D — Template Editor Block States

Three visual states for blocks in the editor:

**AI Generated — green left border**  
Block was filled by AI (via modal auto-generate or per-block button). Show a small `AI ✦` badge in the block's top-right corner. Block is fully editable — clicking into it to type removes the badge and marks the block as manually edited.

**Needs Input — amber left border**  
Block cannot be AI-filled (image URL, product URL, promo code, price). Show an amber left border and a contextual placeholder label:
- Image blocks: `[ Add image — open Cloudinary picker ]`
- Product URL: `[ Add product URL ]`
- Promo code: `[ Enter promo code ]`
- Price: `[ Enter price ]`

These amber blocks are never touched by the AI system and should never appear in the `ai_fillable: true` list.

**Empty / Manual — neutral**  
No content, no AI attempt. Standard empty state, same as current behavior.

---

### 3E — Per-Block Generate Button Upgrade

The existing per-block "Generate ✦" buttons are preserved. Upgrade them:

- All per-block calls now use the full prompt assembly pipeline: brand context + mood + grammar rules + block type notes
- If the setup modal was completed for this instance, its description and context fields are included in the per-block call
- Sibling block content (other blocks already filled in the template) is passed as context so the AI writes each block as part of a coherent whole, not in isolation
- After generation, block enters the AI Generated state (green border, `AI ✦` badge)

**Regenerate state:**  
If a block is already in AI Generated state, the button label changes to "Regenerate ✦". Clicking it replaces the current content with a fresh generation using the same context.

---

### 3F — API Endpoint: `/api/ai/generate-content`

Upgrade or replace the existing AI generation endpoint.

**Request body:**

```json
{
  "instance_id": "uuid",
  "template_id": "string",
  "template_type": "email | web_page",
  "mood": "warm-sentimental | celebratory | urgent | helpful | conversational | aspirational",
  "description": "User's description from the setup modal",
  "title_hint": "Optional",
  "context_fields": {
    "product_name": "optional string",
    "product_details": "optional string",
    "product_url": "optional string",
    "offer": "optional string",
    "promo_code": "optional string",
    "end_date": "optional string",
    "cause_name": "optional string",
    "impact_stat": "optional string"
  },
  "blocks": [ /* pulled from template's blocks JSONB column */ ],
  "sibling_context": { /* keyed by block_id, values are current content */ }
}
```

**Server-side assembly order:**
1. Fetch `brand_context` row from Supabase
2. Map mood ID to natural language instruction (see mood map below)
3. Assemble system prompt from all layers
4. Assemble user message from description + context fields + block schema
5. Call Claude API (`claude-sonnet-4-20250514`)
6. Parse and validate JSON response against block list
7. Return populated block map

**Response:**

```json
{
  "success": true,
  "generated": {
    "hero_heading": "The story behind every gift.",
    "hero_subheading": "We make things worth giving — and keeping.",
    "cta_button": "Explore the collection",
    "email_subject": "This one's for the people who matter most",
    "preview_text": "A little about why we make what we make — and why it matters."
  },
  "skipped": ["hero_image", "promo_code_block"],
  "mood_used": "warm-sentimental"
}
```

**Error handling:**
- Malformed JSON from Claude: retry once, then return `{ "success": false, "error": "generation_failed" }`
- Empty brand_context: proceed with generation, log a warning, do not block
- Timeout: 30 seconds max

---

### 3G — Server-Side Mood Instruction Map

Store this as a constant in the codebase. Inject the matching string into the system prompt based on the active mood.

```
warm-sentimental:
  "Write with sincerity and warmth. This content is meant to create an 
  emotional connection. Avoid humor, urgency, and sales pressure. Prioritize 
  heart over transaction. Use calm, unhurried phrasing."

celebratory:
  "Write with genuine excitement and energy. This is a moment worth 
  celebrating. The tone should feel like good news delivered by a friend. 
  Avoid being hyperbolic or hollow — the enthusiasm should feel earned."

urgent:
  "Write with clarity and momentum. Time matters in this message. The tone 
  should create a sense that acting now is the right move — but stay truthful 
  and avoid manufactured panic. Be direct and efficient with words."

helpful:
  "Write in a practical, reassuring, and informative tone. The reader needs 
  information or guidance. Be clear and warm, not clinical. Avoid fluff — 
  get to the useful part quickly while still feeling human."

conversational:
  "Write like a real person talking to another real person. Approachable, 
  natural, and unpretentious. It's okay to be a little casual. Avoid 
  corporate language and over-polished copy that sounds like an ad."

aspirational:
  "Write in a way that helps the reader imagine a better version of their 
  world — through thoughtful gifts, beautiful objects, or meaningful gestures. 
  The tone should be quietly confident and evocative, not salesy."
```

---

### 3H — System Prompt Template

Assemble this server-side on every generation call. Static sections are constants; dynamic sections are injected at runtime.

```
You are the AI writing assistant inside Canvas, a content management platform 
built for Well Told — a thoughtful gift brand that creates products for people 
who believe what you give says something about who you are.

Your job is to write copy for email campaigns and website pages. Every piece of 
content you write must feel like it came from a real person at Well Told — not 
from a marketing template or a generic AI.

---

## WHO WELL TOLD IS

{{BRAND_VOICE_DOCUMENT}}

---

## TONE FOR THIS CONTENT

{{MOOD_INSTRUCTION}}

---

## GRAMMAR & STYLE RULES

Always follow these rules without exception:

{{ALWAYS_RULES_LIST}}

Never do any of the following:

{{AVOID_RULES_LIST}}

---

## VOCABULARY

Use words that feel like Well Told:
{{WORDS_WE_USE}}

Avoid words that feel generic, hollow, or off-brand:
{{WORDS_WE_AVOID}}

---

## YOUR OUTPUT FORMAT

You will receive a description of the content to write, optional context details, 
and a list of blocks that need to be filled. Each block has an ID, a type, and 
optional notes about length or intent.

Respond with ONLY a valid JSON object. No preamble, no explanation, no markdown 
code fences. The JSON object must use block IDs as keys and generated copy as 
string values.

Only include blocks where ai_fillable is true. Do not include any other blocks.

If a block references a promo code, write around it using the placeholder 
[PROMO_CODE]. If a block references a price, write around it using 
[PRODUCT_PRICE]. Never invent specific discount amounts or prices.

Write every block as if it exists in a coherent whole. The heading, body, and 
CTA should feel like they belong together.
```

**User message template:**

```
## WHAT THIS CONTENT IS ABOUT

{{USER_DESCRIPTION}}

{{TITLE_HINT if provided}}

## ADDITIONAL CONTEXT

{{PRODUCT_NAME if provided}}
{{PRODUCT_DETAILS if provided}}
{{OFFER if provided}}
{{PROMO_CODE if provided}}
{{END_DATE if provided}}
{{CAUSE_NAME if provided}}
{{IMPACT_STAT if provided}}

## EXISTING BLOCK CONTENT (for context and consistency)

{{SIBLING_CONTEXT if any blocks already have content}}

## BLOCKS TO FILL

{{BLOCK_SCHEMA_AS_JSON}}

Respond with only a valid JSON object using block IDs as keys.
```

---

## Part 4 — Default Brand Voice & Grammar Rules

Load these as the initial values in the Brand Context settings panel on first launch. Everything here is editable.

---

### Brand Voice Document (paste into voice_document field)

```
# Well Told Brand Voice

## Who We Are

Well Told is a gift brand. We make objects for people who think carefully about 
what they give — and who they give it to. Our products live at the intersection 
of craft, meaning, and everyday use. They're not decorative for decoration's 
sake. They tell a story, hold a value, or mark a moment.

We are a small brand that takes quality seriously. Every product decision is 
deliberate. Every word we write should reflect that same care.

## How We Talk

We talk like a thoughtful person, not a marketing department. We don't inflate. 
We don't use words like "amazing" or "incredible" because we've seen those words 
used to describe things that aren't. We trust our products to speak through 
honest, well-chosen language.

We are warm but not saccharine. We have a point of view but don't lecture. We 
believe in the power of a good gift without making people feel guilty for giving 
something simple.

We are occasionally quiet. Not every sentence needs to do heavy lifting. A short 
sentence after a long one feels intentional.

## The People We're Writing For

Our customers are thoughtful givers. They care about provenance, quality, and 
meaning. They're skeptical of fast fashion and mass-market noise. They appreciate 
when a brand treats them like an adult. They've probably already scrolled past 
three generic email blasts this morning — we do not want to be the fourth.

## Things We Believe

- The best gifts feel personal even when they're not personalized.
- Objects can hold memory and meaning in a way that digital things cannot.
- Giving is an act of attention — noticing someone well enough to choose 
  something right for them.
- We give back because it's the right thing, not as a marketing tactic.

## Things We Never Do

- We never create false urgency. If a sale ends Friday, we say Friday.
- We never use countdown pressure as a substitute for a genuine offer.
- We don't over-exclaim. One exclamation mark per email maximum, if any.
- We don't call things "perfect" or "luxurious" — wrong register for us.
- We don't write in passive voice when active is available.
- We don't use "journey" as a metaphor for anything.

## Voice in Different Contexts

Product copy: Clear, specific, honest. Name the material. Name the process. 
Avoid adjectives that don't carry information.

Email subject lines: Short, direct, and intriguing without being clickbait. 
No emoji unless it genuinely adds something. Never all caps.

CTA buttons: Active verbs. Not "Click here" — "Shop the collection," 
"Read the story," "Explore the guide."

Storytelling / give-back copy: Take your time. Let the cause breathe before 
connecting it back to what we make.

Sale copy: Honest about the offer, brief about the urgency, still on-brand 
in voice. A sale email can still sound like Well Told.
```

---

### Default Always Rules (load as `always_rules` array)

1. Use sentence case for all headings — capitalize first word and proper nouns only
2. Oxford comma in all lists
3. Spell out numbers one through nine; use numerals for 10 and above
4. Use em dashes (—) instead of hyphens for breaks in a sentence
5. Keep email subject lines under 50 characters when possible
6. Write CTA button text as an active verb phrase
7. Preview text should be 85–100 characters and complement, not repeat, the subject line

### Default Avoid Rules (load as `avoid_rules` array)

1. Do not use exclamation marks more than once per email
2. Do not use these words: amazing, incredible, perfect, luxurious, journey, synergy, seamless, elevate (in a sales context)
3. Do not use passive voice when active is available
4. Do not use "Click here" as CTA button text
5. Do not write in all caps for emphasis
6. Do not use manufactured urgency language (e.g., "Don't miss out," "Act now," "Going fast") unless a genuine and specific deadline exists
7. Do not use ellipses (...) for dramatic effect
8. Do not start multiple consecutive sentences with "We"

### Default Words We Use (load as `words_we_use` array)

crafted, intentional, grounded, honest, considered, quietly, useful, made, gathered, thoughtful, specific, earned

### Default Words We Avoid (load as `words_we_avoid` array)

amazing, incredible, perfect, luxurious, journey, synergy, seamless, curated (overused), obsessed, excited to announce, game-changer

---

## Part 5 — Revised Priority Order

Here is the full recommended sequence. Tasks marked with a dependency note should not start until that dependency is resolved.

| Priority | Task | Phase | Notes |
|---|---|---|---|
| 1 | Cloudflare cache purge on publish | 1D | Small fix, high SEO impact, unblocked |
| 2 | Canonical URL field + Worker injection | 1G | Highest-priority SEO field, unblocked |
| 3 | OG image field in SEO panel | 1G | Pairs with canonical, same panel |
| 4 | Structured data type selector | 1G | Add to same SEO panel pass |
| 5 | Complete email block types (promo code, countdown, quote, UGC, divider, list) | 2C | Dependency for AI generation |
| 6 | Brand context DB + settings panel + API routes | New (Part 2 + 3A) | Dependency for AI generation |
| 7 | Mood column + mood_override + block ai_fillable schema | New (Part 2B–2D) | Dependency for AI generation |
| 8 | Pre-launch setup modal | New (3C) | Requires 6 and 7 |
| 9 | Mood badge in editor with override | New (3B) | Requires 7 |
| 10 | `/api/ai/generate-content` endpoint upgrade | New (3F–3H) | Requires 6, 7, and Claude migration confirmed |
| 11 | Block visual states (green/amber) | New (3D) | Pairs with endpoint |
| 12 | Per-block generate button upgrade + Regenerate state | New (3E) | After endpoint is stable |
| 13 | Email desktop/mobile preview | 2G | After block types complete |
| 14 | Send test button | 2G | Pairs with preview |
| 15 | Klaviyo API service + push templates | Phase 4 | After email builder stable |
| 16 | Klaviyo campaign pipeline (audience, metrics) | Phase 4 | After service layer |
| 17 | Supabase auth migration (from Replit PostgreSQL) | 0A | Scheduled deliberately, not urgent |
| 18 | SMS builder | Phase 5 | After Klaviyo stable |
| 19 | Unified media library (Supabase storage + tagging) | Phase 6 | After Cloudinary picker complete |

---

Tasks 11 and 12 (Shopify product search drawer, Shopify connection config) that you noted as in-progress: continue those in parallel. They don't block or conflict with the SEO fixes or AI generation work.

---

*End of document.*
