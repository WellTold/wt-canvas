import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-5";
const MAX_TOKENS_ARTICLE = 8192;
const MAX_TOKENS_SHORT = 1024;

// Universal writing rule — injected into every system prompt and enforced in post-processing.
const NO_EMDASH = "Never use em-dashes (—). Use a regular hyphen (-) or rewrite the sentence instead.";

export const MOOD_INSTRUCTIONS: Record<string, string> = {
  "warm-sentimental": "Write with sincerity and warmth. This content is meant to create an emotional connection. Avoid humor, urgency, and sales pressure. Prioritize heart over transaction. Use calm, unhurried phrasing.",
  "celebratory": "Write with genuine excitement and energy. This is a moment worth celebrating. The tone should feel like good news delivered by a friend. Avoid being hyperbolic or hollow — the enthusiasm should feel earned.",
  "urgent": "Write with clarity and momentum. Time matters in this message. The tone should create a sense that acting now is the right move — but stay truthful and avoid manufactured panic. Be direct and efficient with words.",
  "helpful": "Write in a practical, reassuring, and informative tone. The reader needs information or guidance. Be clear and warm, not clinical. Avoid fluff — get to the useful part quickly while still feeling human.",
  "conversational": "Write like a real person talking to another real person. Approachable, natural, and unpretentious. It's okay to be a little casual. Avoid corporate language and over-polished copy that sounds like an ad.",
  "aspirational": "Write in a way that helps the reader imagine a better version of their world — through thoughtful gifts, beautiful objects, or meaningful gestures. The tone should be quietly confident and evocative, not salesy."
};

function cleanAIContent(content: string): string {
  if (!content) return content;
  let cleaned = content;
  cleaned = cleaned.replace(/^["'`]+\s*/, "");
  cleaned = cleaned.replace(/^```(markdown|md|json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```\s*$/i, "");
  cleaned = cleaned.replace(/\s*["'`]+$/, "");
  const subscriptionPatterns = [
    /.*subscribe\s+to\s+our\s+newsletter.*$/gmi,
    /.*follow\s+our\s+blog.*$/gmi,
    /\*\*\[subscribe[^\]]*\]\([^)]*\)\*\*.*$/gmi,
    /.*for\s+more.*follow.*blog.*$/gmi,
    /^.*subscribe.*newsletter.*$/gmi,
    /^.*follow.*blog.*latest.*$/gmi,
  ];
  subscriptionPatterns.forEach((p) => { cleaned = cleaned.replace(p, ""); });
  cleaned = cleaned.replace(/\*\*\[[^\]]*\]\(#\)\*\*/g, "");
  cleaned = cleaned.replace(/\[[^\]]*\]\(#\)/g, "");
  cleaned = cleaned.replace(/\(#\)\*\*/g, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  // Replace any em-dashes that slipped through — universal house rule
  cleaned = cleaned.replace(/—/g, "-");
  // Strip year from H1 title line — titles should be evergreen
  cleaned = cleaned.replace(/^#\s+([^\n]*\b20\d{2}\b[^\n]*)$/m, (_m, heading) => {
    console.warn(`[AI] Stripped year reference from generated title`);
    return `# ${stripYearReferences(heading)}`;
  });
  cleaned = stripDuplicateParagraphs(cleaned);
  return cleaned.trim();
}

// Regeneration sometimes reintroduces an earlier paragraph verbatim (e.g. the
// same opening hook appearing again a few sections later). Drop later
// duplicates of substantial prose paragraphs, keeping the first occurrence.
// Headings, images, list items, and blockquotes are left untouched since
// short/structural lines can legitimately repeat (e.g. a CTA link).
function stripDuplicateParagraphs(content: string): string {
  const paragraphs = content.split(/\n{2,}/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    const isProse =
      trimmed.length > 60 &&
      !/^#{1,6}\s/.test(trimmed) &&
      !/^!\[/.test(trimmed) &&
      !/^[-*]\s/.test(trimmed) &&
      !/^\d+\.\s/.test(trimmed) &&
      !/^>/.test(trimmed);
    if (isProse) {
      const signature = trimmed.toLowerCase().replace(/\s+/g, " ").slice(0, 120);
      if (seen.has(signature)) {
        console.warn("[AI] Dropped duplicate paragraph (regeneration artifact):", signature.slice(0, 60));
        continue;
      }
      seen.add(signature);
    }
    result.push(para);
  }
  return result.join("\n\n");
}

const CONTENT_TEMPLATES = {
  blog: {
    sections: [
      { type: "heading", label: "Introduction", placeholder: "Introduce the topic and hook the reader" },
      { type: "text", label: "Opening Paragraph", placeholder: "Set the context and explain why this matters" },
      { type: "heading", label: "Main Section 1", placeholder: "First key point or benefit" },
      { type: "text", label: "Supporting Content", placeholder: "Detailed explanation with examples" },
      { type: "list", label: "Key Points", placeholder: "Bullet points of important information" },
      { type: "heading", label: "Main Section 2", placeholder: "Second key point or strategy" },
      { type: "text", label: "Implementation Details", placeholder: "How-to information and practical steps" },
      { type: "quote", label: "Expert Insight", placeholder: "Relevant quote from industry expert" },
      { type: "text", label: "Conclusion", placeholder: "Summary and next steps" },
      { type: "cta", label: "Call to Action", placeholder: "Clear next step for the reader" },
    ],
  },
  lead_magnet: {
    sections: [
      { type: "heading", label: "Problem Statement", placeholder: "What challenge does this solve?" },
      { type: "text", label: "Pain Points", placeholder: "Describe the reader's frustrations" },
      { type: "heading", label: "Solution Overview", placeholder: "How this lead magnet helps" },
      { type: "list", label: "What You'll Learn", placeholder: "Key takeaways and benefits" },
      { type: "heading", label: "Preview Content", placeholder: "Sample of what's inside" },
      { type: "text", label: "Value Demonstration", placeholder: "Show the value they'll receive" },
      { type: "quote", label: "Social Proof", placeholder: "Testimonial or success story" },
      { type: "cta", label: "Download CTA", placeholder: "Strong call-to-action to download" },
    ],
  },
  landing: {
    sections: [
      { type: "heading", label: "Compelling Headline", placeholder: "Clear value proposition" },
      { type: "text", label: "Problem Description", placeholder: "What problem does this solve?" },
      { type: "heading", label: "Solution Benefits", placeholder: "How we solve the problem" },
      { type: "list", label: "Key Features", placeholder: "Main features and benefits" },
      { type: "quote", label: "Customer Testimonial", placeholder: "Social proof from happy customer" },
      { type: "heading", label: "Why Choose Us", placeholder: "Differentiation from competitors" },
      { type: "text", label: "Trust Building", placeholder: "Credibility and authority content" },
      { type: "cta", label: "Primary CTA", placeholder: "Main conversion action" },
    ],
  },
};

const ARTICLE_ANGLE_DEFINITIONS: Record<string, string> = {
  "Gift Guide — Standard": "Curated roundup, warm but focused. Straightforward gift recommendations with story context.",
  "Gift Guide — Passion-Led": "Enthusiast tone. Respect the identity — gifts that honor the lifestyle, not just the hobby.",
  "Story-Led — Mark the Moment": "Intimate, quiet. The product is a vessel for a specific memory or place. Lead with the moment.",
  "Personal — The Gift That Actually Means Something": "For someone hard to buy for. Emotional permission. Lead with the feeling of giving a gift that actually lands.",
  "Contrarian — Why These Gifts Are Always Boring": "Open by calling out the tired category honestly. Empathize with the frustration. Then solve it with Well Told.",
  "Reframe — Gifts for the Parents Not the Baby": "Shift who the recipient really is. The product serves the adult, not the child.",
  "Informational — Build Authority": "Answer the question fully and honestly. Bridge naturally to Well Told at the end. Never force it.",
};

const WELL_TOLD_BRAND_VOICE_FALLBACK = `Well Told Design makes story-driven everyday objects — glassware, drinkware, throws, and accessories featuring maps, constellations, and topographic themes. Every product is designed around a place, a moment, or a memory that matters.

BRAND POSITIONING
The gift that actually means something. In a world of generic options, Well Told makes objects that mark where you're from, where you've been, and what you care about. We are not a novelty brand. We are not a personalization vendor. We make things that earn a permanent place in someone's life.

CORE BELIEF
People don't need more stuff. They need objects that tell their story. A map of the city where someone grew up. A constellation of the night a child was born. A glass etched with the trail they hiked every summer. These aren't gifts — they're evidence that someone paid attention.

TONE PRINCIPLES
1. Warm but not gushing — Write like a thoughtful friend who gives great gifts, not a brand trying to seem human. Avoid exclamation points. Avoid superlatives like "amazing", "incredible", "perfect." Let the idea carry the weight.
2. Specific over generic — "A map of the neighborhood she grew up in" beats "a personalized gift." "The night sky over Chicago on your wedding night" beats "a custom star map." Always reach for the specific image.
3. Story before product — Introduce the moment or the feeling before the object. The product is the answer to an emotional question, not the opening line.
4. Confident, not salesy — Never use urgency tactics. Never say "order now" or "limited time." Well Told earns the sale by being genuinely useful and trustworthy. One clear CTA at the end is enough.
5. Second person for gift guides — Address the gift-giver directly as "you." They are choosing for someone else — keep them in that mindset.
6. No listicle filler — Do not pad articles with items that don't connect to Well Told's world. Quality over quantity always.

VOCABULARY TO USE
place, mark, story, moment, memory, earn, belong, permanent, specific, personal, meaningful, craft, origin, hometown, constellation, trail, summit, neighborhood, founding, chapter, connection

VOCABULARY TO AVOID
amazing, incredible, perfect, best-ever, unique (overused), stunning, game-changer, must-have, treat yourself, affordable luxury, high-quality

PRODUCT UNIVERSE (reference when making recommendations)
Well Told products fall into these categories:
- Map glassware: wine glasses, rocks glasses, pint glasses, champagne flutes, coffee mugs, tumblers — engraved with city/neighborhood maps
- Constellation glassware: same vessel types — engraved with star maps for specific dates and locations
- Topographic drinkware: mugs and glasses with terrain map engraving
- Night sky products: custom night sky maps on glass, ornaments, blankets
- Throws and blankets: map, constellation, and topographic textile designs
- Accessories: stainless steel straws, decanters, gift sets

When writing gift guides, draw recommendations from this universe. Do not recommend products outside this world unless explicitly writing a broad editorial guide.`;

// ─── Article structures ──────────────────────────────────────────────────────
// Every article used to get one fixed format, which is the main reason the library
// reads alike. Structures now follow search intent, and commercial gift-guide
// keywords rotate between three shapes (weighted toward the scannable list Google
// tends to rank for gift queries). See selectArticleStructure below.
const COMPARISON_TABLE_RULE = `Include one compact comparison table in Markdown pipe-table syntax with the columns: Gift | Best for | Price | Personalize with. Use only prices given in the product context; where none is given, write "See options".`;

export const ARTICLE_STRUCTURES = {
  curated_list: `FORMAT: Curated gift list
Recommend 6-10 specific gifts. Give each pick its own ### H3 heading with the product name, then 2-4 sentences: who it suits, why it works for this person, and exactly what to personalize (which place, date, coordinates or text). Mention the price when the product context lists one. Group the picks under 2-4 ## H2 sections that reflect real buying decisions (by what they love, by budget, by how they'll use it) rather than generic headings. ${COMPARISON_TABLE_RULE} Aim for 1,100-1,600 words.`,
  decision_guide: `FORMAT: How-to-choose guide
Answer the reader's question directly in the first 2-3 sentences. Then use 3-5 ## H2 sections that walk through how to choose well (what to personalize, which place or date to pick, which piece fits how they live, lead time), each grounded in concrete examples. Recommend 4-6 specific products along the way, with a ### H3 heading wherever a product is the focus. ${COMPARISON_TABLE_RULE} End with a short checklist as a Markdown bullet list. Aim for 1,000-1,400 words.`,
  story_led: `FORMAT: Story-led guide
Open with one concrete, specific scene that fits this exact search, not a general observation about gifting being hard. Then recommend 5-7 products, each under its own ### H3 heading, inside 2-3 ## H2 sections that each tie to a distinct kind of memory or place. ${COMPARISON_TABLE_RULE} Aim for 900-1,300 words.`,
  place_guide: `FORMAT: Place guide
Write for someone looking for a gift connected to one specific place. Show real knowledge of it: neighborhoods, landmarks, trails, traditions, details people who love it would recognize. Never generic filler that could apply to any town. Organize with ## H2 sections by kind of connection (grew up there, went to school there, ran it, got married there, moved away from it). Recommend 5-8 products with ### H3 headings and say exactly what to engrave on each (which part of the map, which coordinates, which date). ${COMPARISON_TABLE_RULE} Aim for 1,000-1,500 words.`,
  corporate_guide: `FORMAT: Corporate and client gifting guide
Write for a business buyer: an office manager, HR lead, founder, realtor or advisor buying for clients, employees or a team. Lead with their real constraints (budget per head, volume, lead time, making it feel personal instead of branded swag, shipping to many addresses). Use ## H2 sections for the main gifting situations (client thank-yous, employee milestones, closing gifts, events) and ### H3 headings for specific product recommendations. Explain how pieces can carry a company logo, a meaningful place (the office, the client's new home, the deal city) or a date. ${COMPARISON_TABLE_RULE} End with a short paragraph on ordering in volume. Aim for 1,000-1,400 words.`,
  editorial: `FORMAT: Brand editorial guide
Write this as an opinionated, genuinely useful essay that answers the question fully - not a product list. Help the reader think differently about this topic. Reference Well Told products 2-3 times as concrete examples. Use ## H2 sections a skimmer can follow. Aim for 800-1,200 words.`,
  professional_landing: `FORMAT: Professional landing page
Write for a professional buyer (realtor, HR director, financial advisor, etc.) who needs a gift that reflects well on them. Lead with their challenge, not our products. Speak peer-to-peer. Include practical context about how Well Told products can be personalized for this professional context. End with both a shop CTA and a volume inquiry CTA.`,
} as const;

export type ArticleStructure = keyof typeof ARTICLE_STRUCTURES;

const PERSONA_DEFINITIONS: Record<string, string> = {
  "Personal Gifter": "Individual buying for someone they love. They want confidence they've found the right thing, and the details to order it correctly.",
  "Professional Gifter": "Service professional (realtor, advisor, planner) buying for a client. They need the gift to reflect well on them.",
  "Institutional Buyer": "HR lead, office manager, school or company buying in volume. They need process clarity, reliability, budget fit and scale confidence.",
  "Brand / Editorial": "Discovery-phase reader. Not yet buying. Give generously — earn trust, not just a click.",
};

const CORPORATE_TERMS = /\b(corporate|client|clients|employee|employees|staff|team|coworker|coworkers|company|business|bulk|volume|logo|branded|closing gift|realtor|onboarding)\b/i;

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Infer search intent when a keyword has none stored. */
export function inferIntent(keyword: string): "informational" | "commercial" | "transactional" {
  const k = keyword.toLowerCase();
  if (/^(how|why|what is|what are|when|should|is it|can you)\b/.test(k) || /\b(meaning|history|etiquette|tradition|explained)\b/.test(k)) return "informational";
  if (/\b(buy|order|custom|personalized|engraved|shop|near me|price)\b/.test(k) && !/\b(gift|gifts|ideas)\b/.test(k)) return "transactional";
  return "commercial";
}

export function selectArticleStructure(opts: {
  type: string;
  keyword: string;
  intent?: string | null;
  isPlace?: boolean;
  articleAngle?: string | null;
}): ArticleStructure {
  const { type, keyword, intent, isPlace, articleAngle } = opts;
  if (type === 'landing_page' || type === 'landing') return 'professional_landing';
  if (isPlace) return 'place_guide';
  if (CORPORATE_TERMS.test(keyword)) return 'corporate_guide';
  const angle = (articleAngle || '').toLowerCase();
  if (angle.includes('story-led')) return 'story_led';
  if (angle.includes('informational')) return 'editorial';
  const resolvedIntent = intent || inferIntent(keyword);
  if (resolvedIntent === 'informational') return stableHash(keyword) % 2 === 0 ? 'decision_guide' : 'editorial';
  // Commercial/transactional gift searches: mostly the scannable list Google ranks,
  // with some variety so the library doesn't read as one template.
  const slot = stableHash(keyword) % 5;
  return slot <= 2 ? 'curated_list' : slot === 3 ? 'decision_guide' : 'story_led';
}

function detectPersona(type: string, structure: ArticleStructure, primaryKeyword?: string): string {
  const kw = (primaryKeyword || '').toLowerCase();
  if (structure === 'corporate_guide' || structure === 'professional_landing') {
    return /\b(employee|employees|staff|team|company|corporate|bulk|volume|hospital|school|onboarding)\b/.test(kw)
      ? 'Institutional Buyer'
      : 'Professional Gifter';
  }
  if (structure === 'editorial') return 'Brand / Editorial';
  return 'Personal Gifter';
}

// Phrases that turned up across dozens of published articles. The model is told to
// avoid them so new articles stop echoing the same lines.
const OVERUSED_PHRASES = [
  "where he grew up", "where she grew up", "doesn't need anything", "says he wants nothing",
  "says she wants nothing", "has everything", "particular kind of", "evidence that",
  "Here's what we believe", "That's the whole idea behind what we make", "it's a quiet way of saying",
  "designed to mark a specific", "rather than serve as a generic keepsake", "the exact arrangement of stars",
  "candles", "gadgets", "another gift card", "hard to shop for", "pressure", "puzzle",
];

/**
 * Remove a 4-digit year (and the "for/in/of" in front of it) from a title or H1,
 * then tidy the punctuation it leaves behind. Titles should be evergreen; the old
 * version left holes like "Best Christmas Gifts for : Top Picks".
 */
export function stripYearReferences(text: string): string {
  return text
    .replace(/\b20\d{2}['’]s\s+/g, "")
    .replace(/\s*\b(?:for|in|of)\s+20\d{2}\b/gi, "")
    .replace(/\s*\(?\b20\d{2}\b\)?/g, "")
    .replace(/\s+([:,.!?])/g, "$1")
    .replace(/:\s*:/g, ":")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s:,\-]+$/, "")
    .trim();
}

export interface FAQItem {
  question: string;
  answer: string;
}

export async function generateFAQ(
  primaryKeyword: string,
  supportingKeywords?: string,
  productLinks?: Array<{ title: string; url: string }>,
): Promise<FAQItem[]> {
  const hasLinks = Boolean(productLinks && productLinks.length > 0);
  const linkRules = hasLinks
    ? `- Every answer must end with a natural nudge back to a specific Well Told product or collection page, written as a markdown link in the exact form [Product Name](URL) — since these Q&A pairs get cited as standalone units by search engines and AI assistants, the link needs to be inside the answer itself, not just implied
- Only use the exact product names and URLs from this list — never invent a product name or URL:
${productLinks!.map((p) => `  - ${p.title}: ${p.url}`).join("\n")}
- Vary which product/collection each answer points to rather than repeating the same one every time`
    : `- At least 2 answers should naturally mention a Well Told product type (map glassware, constellation gifts, personalized drinkware, throws, etc.)`;

  const systemPrompt = `You generate FAQ content for Well Told Design, a Boston-based gift brand making story-driven objects — map glassware, constellation gifts, and topographic drinkware.

Rules:
- Questions should mirror how a real person searches Google (e.g. "What is a good gift for a hiker who has everything?")
- Answers should be 2-4 sentences, direct, and specific
${linkRules}
- Do not be salesy — answer the question genuinely first, then mention the product as a concrete example
- Questions should cover what a real searcher still wants to know after reading: how to choose, what to personalize, lead time and timing, budget, and at least one specific Well Told angle
- Every question must stay on this exact topic: the same recipient and occasion as the keyword. Never ask about other occasions or holidays, other retailers or stores, or product categories Well Told doesn't make
- Do not use exclamation points
- Do not use: amazing, incredible, perfect, stunning, game-changer, must-have
- Never reference a specific year (e.g. "in 2024", "this year") — the copy must read as evergreen since it may be read long after publishing

Return ONLY a valid JSON array with no markdown fencing or extra text:
[{"question": "...", "answer": "..."}, ...]`;

  const userPrompt = supportingKeywords
    ? `Generate 6 FAQ questions and answers for an article about: ${primaryKeyword}\n\nRelated keyword angles to draw question topics from (do not use these as a list — each should inspire one distinct question):\n${supportingKeywords}`
    : `Generate 5 FAQ questions and answers for an article about: ${primaryKeyword}`;

  let rawText = '';
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    rawText = response.content[0].type === 'text' ? response.content[0].text : '[]';
    // Strip any markdown code fences the model might add
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        // Valid JSON, zero items — not an error the catch block below will ever see.
        // Log the raw response so an empty FAQ section is debuggable instead of silent.
        console.warn(`[AI] FAQ returned an empty array for keyword: ${primaryKeyword} — raw response:`, rawText.substring(0, 800));
      } else {
        console.log(`[AI] FAQ generated ${parsed.length} items for keyword: ${primaryKeyword}`);
      }
      return parsed.slice(0, 6) as FAQItem[];
    }
    console.warn('[AI] FAQ response was not an array:', clean.substring(0, 200));
  } catch (e) {
    console.error('[AI] FAQ generation/parsing failed for keyword:', primaryKeyword);
    console.error('[AI] FAQ error:', e instanceof Error ? e.message : e);
    if (rawText) console.error('[AI] FAQ raw response (first 500 chars):', rawText.substring(0, 500));
  }
  return [];
}

export interface GenerateArticleParams {
  title: string;
  type: string;
  primaryKeyword?: string;
  supportingKeywords?: string;
  articleAngle?: string | null;
  metaDescription?: string;
  additionalInstructions?: string;
  internalLinks?: Array<{ title: string; url: string; keyword: string | null }>;
  shopifyProducts?: Array<{ title: string; handle: string; price: string; description: string }>;
  template?: {
    templateId?: string;
    systemPrompt?: string;
    userPromptAddition?: string;
    structure?: any;
    existingContent?: any[];
  };
}

export async function generateContent(params: {
  description: string;
  title_hint?: string;
  mood: string;
  template_type: string;
  context_fields?: Record<string, string>;
  blocks: Array<{ block_id: string; block_type: string; ai_fillable: boolean; notes?: string; order?: number }>;
  sibling_context?: Record<string, string>;
  brand_context?: {
    voice_document?: string;
    always_rules?: string[];
    avoid_rules?: string[];
    words_we_use?: string[];
    words_we_avoid?: string[];
  };
  template_system_prompt?: string;
  template_user_prompt_addition?: string;
}): Promise<{ generated: Record<string, string>; skipped: string[]; mood_used: string }> {
  const {
    description,
    title_hint,
    mood,
    template_type,
    context_fields,
    blocks,
    sibling_context,
    brand_context,
    template_system_prompt,
    template_user_prompt_addition,
  } = params;

  const activeMood = mood || "conversational";
  const moodInstruction = MOOD_INSTRUCTIONS[activeMood] || MOOD_INSTRUCTIONS["conversational"];

  const alwaysRules = brand_context?.always_rules?.length 
    ? brand_context.always_rules.map((r, i) => `${i + 1}. ${r}`).join("\n")
    : "No specific rules set.";
  
  const avoidRules = brand_context?.avoid_rules?.length
    ? brand_context.avoid_rules.map((r, i) => `${i + 1}. ${r}`).join("\n")
    : "No specific rules set.";

  const wordsWeUse = brand_context?.words_we_use?.length
    ? brand_context.words_we_use.join(", ")
    : "Not specified.";

  const wordsWeAvoid = brand_context?.words_we_avoid?.length
    ? brand_context.words_we_avoid.join(", ")
    : "Not specified.";

  const systemPrompt = `You are the AI writing assistant inside Canvas, a content management platform built for Well Told — a thoughtful gift brand that creates products for people who believe what you give says something about who you are.

Your job is to write copy for email campaigns and website pages. Every piece of content you write must feel like it came from a real person at Well Told — not from a marketing template or a generic AI.

---

## WHO WELL TOLD IS

${brand_context?.voice_document || "No brand voice document provided."}

---

## TONE FOR THIS CONTENT

${moodInstruction}

---

## GRAMMAR & STYLE RULES

Always follow these rules without exception:
${alwaysRules}

Never do any of the following:
${avoidRules}

Universal rule: ${NO_EMDASH}

---

## VOCABULARY

Use words that feel like Well Told: ${wordsWeUse}

Avoid words that feel generic, hollow, or off-brand: ${wordsWeAvoid}

---
${template_system_prompt ? `\n## TEMPLATE-SPECIFIC INSTRUCTIONS\n\n${template_system_prompt}\n\n---\n` : ""}
## YOUR OUTPUT FORMAT

You will receive a description of the content to write, optional context details, and a list of blocks that need to be filled. Each block has an ID, a type, and optional notes about length or intent.

Respond with ONLY a valid JSON object. No preamble, no explanation, no markdown code fences. The JSON object must use block IDs as keys and generated copy as string values.

Only include blocks where ai_fillable is true. Do not include any other blocks.

If a block references a promo code, write around it using the placeholder [PROMO_CODE]. If a block references a price, write around it using [PRODUCT_PRICE]. Never invent specific discount amounts or prices.

Write every block as if it exists in a coherent whole. The heading, body, and CTA should feel like they belong together.`;

  let contextFieldsStr = "";
  if (context_fields) {
    for (const [key, value] of Object.entries(context_fields)) {
      if (value) {
        contextFieldsStr += `${key}: ${value}\n`;
      }
    }
  }

  let siblingContextStr = "";
  if (sibling_context && Object.keys(sibling_context).length > 0) {
    siblingContextStr = Object.entries(sibling_context)
      .map(([id, content]) => `${id}: ${content}`)
      .join("\n");
  }

  const fillableBlocks = blocks.filter(b => b.ai_fillable);

  const userPrompt = `## WHAT THIS CONTENT IS ABOUT

${description}

${title_hint ? `Suggested title/subject: ${title_hint}` : ""}

## ADDITIONAL CONTEXT

${contextFieldsStr || "No additional context provided."}

${siblingContextStr ? `## EXISTING BLOCK CONTENT (for context and consistency)\n\n${siblingContextStr}\n` : ""}
${template_user_prompt_addition ? `## ADDITIONAL WRITING GUIDANCE\n\n${template_user_prompt_addition}\n\n` : ""}
## BLOCKS TO FILL

${JSON.stringify(fillableBlocks, null, 2)}

Respond with only a valid JSON object using block IDs as keys.`;

  const callClaude = async () => {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "disabled" },
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    
    // Attempt to extract JSON if it's wrapped in text or code blocks
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
    return JSON.parse(jsonStr);
  };

  try {
    let generated;
    try {
      generated = await callClaude();
    } catch (e) {
      console.warn("First Claude attempt failed, retrying once...", e);
      generated = await callClaude();
    }

    // Clean the generated content
    const cleanedGenerated: Record<string, string> = {};
    for (const [id, text] of Object.entries(generated)) {
      if (typeof text === 'string') {
        cleanedGenerated[id] = cleanAIContent(text);
      } else {
        cleanedGenerated[id] = JSON.stringify(text);
      }
    }

    return {
      generated: cleanedGenerated,
      skipped: blocks.filter(b => !b.ai_fillable).map(b => b.block_id),
      mood_used: activeMood,
    };
  } catch (error) {
    console.error("Claude generateContent error:", error);
    throw error;
  }
}

export async function generateCompleteArticle({
  title,
  type: contentType,
  primaryKeyword,
  supportingKeywords,
  articleAngle,
  metaDescription,
  additionalInstructions,
  internalLinks,
  shopifyProducts,
  template,
}: GenerateArticleParams) {
  try {
    let sectionsToGenerate;
    if (template?.structure) {
      const templateBlocks = Array.isArray(template.structure)
        ? template.structure
        : template.structure.blocks || template.structure.sections || [];
      sectionsToGenerate = templateBlocks.map((block: any) => ({
        type: block.type || "text",
        label: block.label || block.name || `${block.type} section`,
        instruction: block.instruction || block.description || `Generate ${block.type} content`,
      }));
    } else {
      const defaultTemplate =
        CONTENT_TEMPLATES[contentType as keyof typeof CONTENT_TEMPLATES] || CONTENT_TEMPLATES.blog;
      sectionsToGenerate = defaultTemplate.sections.map((s) => ({
        type: s.type,
        label: s.label,
        instruction: s.placeholder,
      }));
    }

    let existingContentContext = "";
    if (template?.existingContent && template.existingContent.length > 0) {
      const clean = JSON.parse(JSON.stringify(template.existingContent));
      existingContentContext = `\n\nExisting content to incorporate:\n${clean
        .map((block: any, i: number) => {
          const c = block.content || {};
          if (block.type === "text" || block.type === "heading") return `${i + 1}. ${block.type}: ${c.text || ""}`;
          if (block.type === "list") return `${i + 1}. list: ${(c.items || []).join(", ")}`;
          return `${i + 1}. ${block.type}: ${JSON.stringify(c)}`;
        })
        .join("\n")}`;
    }

    const baseSystemPrompt =
      template?.systemPrompt || `You are an expert content writer specializing in content creation.`;

    let internalLinksContext = "";
    if (internalLinks && internalLinks.length > 0) {
      internalLinksContext = `\n\nINTERNAL LINKS — where relevant, link to these published pages using their exact URLs. Only link where it adds value; do not force links:\n${internalLinks
        .slice(0, 20)
        .map((l) => `- "${l.title}"${l.keyword ? ` (keyword: ${l.keyword})` : ""} → ${l.url}`)
        .join("\n")}`;
    }

    let shopifyProductsContext = "";
    if (shopifyProducts && shopifyProducts.length > 0) {
      shopifyProductsContext = `\n\nSHOPIFY PRODUCTS — these are real products from the store. Reference them naturally where relevant (e.g. in gift guides or product comparisons). Use their Shopify handle to build URLs like /products/{handle}:\n${shopifyProducts
        .map((p) => `- "${p.title}" (${p.price}) → /products/${p.handle}`)
        .join("\n")}`;
    }

    const systemPrompt = `${baseSystemPrompt} Respond only with valid JSON.

${template?.existingContent ? "Reformat and incorporate the existing content into" : "Create"} high-quality, engaging content for this ${contentType}.

Content Generation Rules:
- Use straight apostrophes (') instead of curly quotes
- Do not use em-dashes (—), use hyphens (-) instead (universal rule)
- Generate content as a JSON array of blocks
- Each block must have: id (string), type (string), order (integer), content (object)
- Available block types: heading, text, list, quote, cta
- heading: content = { "text": "..." }
- text: content = { "text": "..." }
- list: content = { "items": ["..."] }
- quote: content = { "text": "...", "author": "..." }
- cta: content = { "text": "...", "buttonText": "...", "link": "#" }
- NEVER include subscription prompts, newsletter signups, or "follow our blog" calls-to-action

Keywords:
- Primary keyword (optimise H1, meta title, meta description, first paragraph, and key subheadings): ${primaryKeyword || "not specified"}${supportingKeywords ? `\n- Supporting keywords (weave in naturally, do not force): ${supportingKeywords}` : ""}
Meta description context: ${metaDescription || "not specified"}${articleAngle ? `\n\nContent angle / tone direction: ${articleAngle}\nAngle guidance: ${ARTICLE_ANGLE_DEFINITIONS[articleAngle] ?? ""}` : ""}${internalLinksContext}${shopifyProductsContext}${existingContentContext}`;

    const userPrompt = `Create a comprehensive ${contentType} titled "${title}" as a JSON array of blocks.

STRUCTURE — generate one block per section below:
${sectionsToGenerate
  .map(
    (s: any, i: number) =>
      `${i + 1}. Type: "${s.type}" - ${s.label}\n   → ${s.instruction}`
  )
  .join("\n\n")}

REQUIREMENTS:
- Primary keyword (H1, meta title, meta description, first paragraph, key subheadings): ${primaryKeyword || "the main topic"}${supportingKeywords ? `\n- Supporting keywords (weave in naturally, do not force): ${supportingKeywords}` : ""}
- Tone: Professional but accessible
- Text sections: 2-3 substantial paragraphs each
- Lists: 4-6 specific, actionable items
- Return a raw JSON array (no wrapper object)${template?.userPromptAddition ? `\n\nADDITIONAL INSTRUCTIONS: ${template.userPromptAddition}` : ""}${additionalInstructions ? `\n\nADDITIONAL INSTRUCTIONS: ${additionalInstructions}` : ""}${
      template?.existingContent && template.existingContent.length > 0
        ? `\n\nEXISTING CONTENT TO INCORPORATE:${existingContentContext}`
        : `\n\nWrite real, useful information about "${title}". No placeholders.`
    }`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_ARTICLE,
      thinking: { type: "disabled" },
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";

    let parsedBlocks: any[];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
      const parsed = JSON.parse(jsonStr);
      parsedBlocks = Array.isArray(parsed) ? parsed : parsed.blocks || parsed.sections || [];
    } catch {
      throw new Error("Invalid JSON response from Claude");
    }

    const cleanedBlocks = parsedBlocks.map((block: any, index: number) => {
      const b = {
        id: block.id || String(index + 1),
        type: block.type || "text",
        order: block.order !== undefined ? block.order : index,
        content: block.content || {},
      };
      if (b.content.text) b.content.text = cleanAIContent(b.content.text);
      if (b.content.items && Array.isArray(b.content.items)) {
        b.content.items = b.content.items.map((item: string) => cleanAIContent(item));
      }
      return b;
    });

    return { sections: cleanedBlocks };
  } catch (error) {
    console.error("Claude generation error:", error);
    return {
      sections: [
        { id: "1", type: "heading", order: 0, content: { text: title } },
        {
          id: "2",
          type: "text",
          order: 1,
          content: {
            text: `This ${contentType} covers ${primaryKeyword || "the topic"}.${supportingKeywords ? ` Related topics: ${supportingKeywords}.` : ""}`,
          },
        },
        { id: "3", type: "heading", order: 2, content: { text: "Key Points" } },
        {
          id: "4",
          type: "list",
          order: 3,
          content: { items: ["Important benefit", "Practical step", "Valuable tip", "Key consideration"] },
        },
        {
          id: "5",
          type: "cta",
          order: 4,
          content: { text: "Ready to get started?", buttonText: "Get Started", link: "#" },
        },
      ],
    };
  }
}

export interface GenerateWebPageMarkdownParams {
  title: string;
  type: 'blog' | 'landing_page' | 'lead_magnet' | string;
  primaryKeyword?: string;
  supportingKeywords?: string;
  articleAngle?: string | null;
  mood?: string;
  additionalInstructions?: string;
  /** Legacy alias for intent; "primary"/"secondary" values are ignored. */
  keywordType?: string;
  /** Search intent: informational | commercial | transactional. Inferred from the keyword when absent. */
  intent?: string | null;
  /** Force a structure instead of selecting one from intent/keyword. */
  structure?: ArticleStructure;
  /** Legacy editor format picker (A = list, B = editorial, C = professional); mapped to a structure. */
  format?: 'A' | 'B' | 'C';
  productContext?: string;
  siteBaseUrl?: string;
  /** Set when the article targets a specific place (location target). */
  place?: { name: string; kind: string; region?: string | null; notes?: string | null };
  /** Recently generated articles, so the model can deliberately differ from them. */
  recentArticles?: Array<{ title: string; opening: string }>;
  brandContext?: {
    voice_document?: string;
    always_rules?: string[];
    avoid_rules?: string[];
    words_we_use?: string[];
    words_we_avoid?: string[];
  };
}

export async function generateWebPageMarkdownContent(params: GenerateWebPageMarkdownParams): Promise<string> {
  const {
    title,
    type,
    primaryKeyword,
    supportingKeywords,
    articleAngle,
    additionalInstructions,
    brandContext,
    keywordType,
    intent: intentParam,
    structure: structureParam,
    format: legacyFormat,
    productContext,
    siteBaseUrl = "https://welltolddesign.com",
    place,
    recentArticles = [],
  } = params;

  // [1] Brand voice — prefer stored voice doc, fall back to hardcoded constant
  const brandVoice = brandContext?.voice_document || WELL_TOLD_BRAND_VOICE_FALLBACK;
  const brandAlwaysRules = brandContext?.always_rules?.length
    ? brandContext.always_rules.map((r, i) => `${i + 1}. ${r}`).join("\n")
    : "No specific rules set.";
  const brandAvoidRules = brandContext?.avoid_rules?.length
    ? brandContext.avoid_rules.map((r, i) => `${i + 1}. ${r}`).join("\n")
    : "No specific rules set.";
  const brandWordsWeUse = brandContext?.words_we_use?.length
    ? brandContext.words_we_use.join(", ")
    : "Not specified.";
  const brandWordsWeAvoid = brandContext?.words_we_avoid?.length
    ? brandContext.words_we_avoid.join(", ")
    : "Not specified.";

  // [2] Pick the article structure from intent (stored, legacy keywordType, or inferred)
  const legacyIntent = keywordType && !['primary', 'secondary'].includes(keywordType) ? keywordType : null;
  const intent = intentParam || legacyIntent || inferIntent(primaryKeyword || title);
  const LEGACY_FORMATS: Record<string, ArticleStructure> = { A: 'curated_list', B: 'editorial', C: 'professional_landing' };
  const structureOverride = structureParam || (legacyFormat ? LEGACY_FORMATS[legacyFormat] : undefined);
  const structure: ArticleStructure = structureOverride || selectArticleStructure({
    type,
    keyword: primaryKeyword || title,
    intent,
    isPlace: !!place,
    articleAngle,
  });
  const formatInstruction = ARTICLE_STRUCTURES[structure];

  // [3] Persona follows the structure
  const persona = detectPersona(type, structure, primaryKeyword);
  const personaDescription = PERSONA_DEFINITIONS[persona] || PERSONA_DEFINITIONS['Personal Gifter'];
  console.log(`[AI] article structure=${structure} intent=${intent} persona=${persona} for "${primaryKeyword || title}"`);

  // [4] Resolve article angle definition
  const angleKey = articleAngle
    ? Object.keys(ARTICLE_ANGLE_DEFINITIONS).find(k =>
        articleAngle.toLowerCase().includes(k.split('—')[0].trim().toLowerCase())
      )
    : null;
  const angleDefinition = angleKey ? ARTICLE_ANGLE_DEFINITIONS[angleKey] : null;

  // Assemble 8-block system prompt
  const blocks: string[] = [
    // Block 1: Brand Voice
    `[1. BRAND VOICE BLOCK]
${brandVoice}

Always follow these brand-specific rules without exception:
${brandAlwaysRules}

Never do any of the following:
${brandAvoidRules}

Use words that feel like Well Told: ${brandWordsWeUse}

Avoid words that feel generic, hollow, or off-brand: ${brandWordsWeAvoid}`,

    // Block 2: Keyword Context
    [
      '[2. KEYWORD CONTEXT BLOCK]',
      primaryKeyword
        ? `Primary keyword (optimize H1, meta title, meta description, and opening paragraph for this exact term): ${primaryKeyword}`
        : '',
      supportingKeywords
        ? `Supporting keywords (use only the ones that fit naturally - skip any that would need a forced sentence or heading; never more than twice each):\n${supportingKeywords}`
        : '',
      `Search intent: ${intent}`,
      'Scope: this article serves ONE search. Stay on its recipient and occasion. Do not add sections for other occasions or other recipients (for example, no Christmas or Valentine\'s section in a birthday article) unless the primary keyword itself names them.',
      articleAngle
        ? `Article angle / tone direction: ${articleAngle}${angleDefinition ? `\n  → ${angleDefinition}` : ''}`
        : '',
    ].filter(Boolean).join('\n'),

    // Block 3: Format
    `[3. FORMAT BLOCK]\n${formatInstruction}`,

    // Block 4: Persona
    ['[4. PERSONA BLOCK]', `Target reader: ${persona}`, personaDescription].join('\n'),

    // Block 4b: Place (location-targeted articles only)
    place
      ? `[4b. PLACE BLOCK]
This article is about: ${place.name}${place.region ? ` (${place.region})` : ''} - ${place.kind.replace(/_/g, ' ')}.
${place.notes ? `Local detail to draw on: ${place.notes}\n` : ''}Use specific, accurate local detail. If you are not confident a detail is true, leave it out rather than guess.`
      : '',

    // Block 4c: Be different from what's already published
    `[4c. ORIGINALITY BLOCK]
This article joins a library of existing Well Told articles and must not read like them.
- Do not use these stock phrases from earlier articles unless one is part of the primary keyword itself: ${OVERUSED_PHRASES.map((p) => `"${p}"`).join(', ')}.
- Do not open by saying the recipient is hard to shop for, already has everything, or doesn't want anything, and do not open by dismissing candles, gadgets, gift cards or other generic gifts. Open with the most useful or specific thing for this exact search.
- Vary which product you lead with; do not default to the same glass every time.${
      recentArticles.length > 0
        ? `\n- Recently published articles open like this. Your opening must differ in angle, scene and wording:\n${recentArticles
            .map((a) => `  * "${a.title}": ${a.opening.slice(0, 220)}`)
            .join('\n')}`
        : ''
    }`,

    // Block 5: Product Context
    productContext
      ? `[5. PRODUCT CONTEXT BLOCK]
Relevant Well Told products for this article. Each line shows the product link and, where available, its price, a short description and a product image URL. Use the description and price to say something concrete about each pick; never invent prices, sizes or personalization options that aren't listed.

LINKING: When you reference a product inline, use Markdown hyperlink syntax: [Product Name](url). Do not bold the product name. Every link must be written in full, opening and closing parentheses on the same line.

IMAGES: Where a product line includes "— image: <url>", embed the image once in the article at a natural point near where you first mention that product, on its own line, using this syntax:
![Product Name](image-url)
Never put an image inside a link or a sentence. Do not embed the same image twice. Only use image URLs explicitly listed below — do not invent or guess image URLs.

${productContext}`
      : `[5. PRODUCT CONTEXT BLOCK]
No specific product data available. Draw all product references from the Well Told product universe described in Block 1. Do not invent product names or URLs. Where you would link to a product, link to a relevant collection instead using these standard URLs:
- [Map Glassware](${siteBaseUrl}/collections/map-glasses)
- [Constellation Glassware](${siteBaseUrl}/collections/constellation-glasses)
- [Topographic Drinkware](${siteBaseUrl}/collections/topographic-drinkware)
- [Anniversary Gifts](${siteBaseUrl}/collections/anniversary-gifts)

Use Markdown hyperlink syntax: [link text](url). Do not bold product names that should be links.`,

    // Block 6: Content Rules
    `[6. CONTENT RULES BLOCK]
- Do not recommend products outside the Well Told universe (no yoga mats, candles, cable organizers, compression socks, or generic lifestyle items)
- Do not include a year anywhere in the title or article — the copy must stay evergreen
- Never repeat the same paragraph or opening sentence more than once in the article — each paragraph must be distinct. Do not restate the introduction or hook later in the piece.
- Do not use exclamation points
- Do not use the words: amazing, incredible, perfect, stunning, game-changer, must-have, high-quality, affordable luxury
- Describe each product in prose sentences; bullet lists are for checklists and quick comparisons, not product write-ups
- End with one short closing paragraph containing at most one link (the page adds its own call-to-action buttons)
- Do write in second person ("you", "your") for gift guides
- HYPERLINKS: When referencing any Well Told product or collection, always use Markdown link syntax [text](url). Never bold a product name that should be a link. Every product mention should be a clickable hyperlink.
- AMERICAN ENGLISH ONLY: Use American spellings throughout — "specializing" not "specialising", "personalized" not "personalised", "recognizing" not "recognising", etc. The audience is US-based.

ARTICLE STRUCTURE — CRITICAL:
- NEVER write a brand description or company bio paragraph anywhere in the article (no "Well Told Design makes...", "Here's what we believe", or "That's the whole idea behind what we make"). The page already adds a brand note automatically.
- The article must open immediately with content that serves the reader's search intent. The person landing from search is in discovery or buying mode — earn their attention before mentioning the brand.`,

    // Block 7: SEO Rules
    `[7. SEO RULES BLOCK]
These articles are written for SEO. Follow SEO best practices for search-intent-matched content:
- Match reader intent: someone arriving from search is looking for answers, recommendations, or inspiration — serve that need immediately in the opening paragraph
- Include the primary keyword in: H1 and within the first 100 words of body copy
- Include each supporting keyword at least once naturally in the body — spread them across different sections
- NEVER write supporting keywords as a series or list in the same sentence or paragraph (e.g., do NOT write "whether you're looking for X, Y, or Z" or "gifts for mom for Christmas, Mother's Day, birthdays..."). Each keyword belongs in its own sentence, in a different section
- Do not stuff keywords — if it doesn't read naturally, cut it
- H1 should match or closely paraphrase the article title
- Use ## for H2 sections and ### for H3 sub-sections. Headings must read naturally and be useful to someone skimming; never bend a heading to fit a keyword (bad: "A Christmas Gift Idea for Christmas That Starts With a Place")
- Keep the opening paragraph tightly relevant to the search query — Google uses it to confirm topical match
- Return a single complete Markdown document starting with the # H1 title
- Use standard Markdown: **bold**, *italic*, [hyperlinks](url), bullet lists, numbered lists, blockquotes (>), and pipe tables
- Do NOT include JSON, code fences, or any non-Markdown formatting
- Do NOT add subscription CTAs, follow-our-blog links, or placeholder links`,

    // Additional instructions if provided
    additionalInstructions ? `[ADDITIONAL INSTRUCTIONS]\n${additionalInstructions}` : '',
  ].filter(Boolean);

  const systemPrompt = blocks.join('\n\n---\n\n');

  const userPrompt = `[8. WRITING PROMPT]
Now write the article. Follow all instructions above exactly.

Title: ${title}

Write the full document now, starting with the H1 title:`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_ARTICLE,
    thinking: { type: "disabled" },
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return cleanAIContent(text);
}

export function generateWebPageMarkdown(blocks: any[], title?: string): string {
  const lines: string[] = [];

  if (title) {
    lines.push(`# ${title}`);
    lines.push('');
  }

  for (const block of blocks) {
    const c = block.content || {};

    switch (block.type) {
      case 'heading':
        if (c.text) {
          lines.push(`## ${c.text}`);
          lines.push('');
        }
        break;

      case 'text':
        if (c.text) {
          lines.push(c.text);
          lines.push('');
        }
        break;

      case 'list':
        if (c.items && Array.isArray(c.items) && c.items.length > 0) {
          for (const listItem of c.items) {
            lines.push(`- ${listItem}`);
          }
          lines.push('');
        }
        break;

      case 'quote':
        if (c.text) {
          lines.push(`> ${c.text}`);
          if (c.author) {
            lines.push(`> — ${c.author}`);
          }
          lines.push('');
        }
        break;

      case 'cta':
        if (c.text) {
          lines.push(c.text);
          lines.push('');
        }
        if (c.buttonText) {
          const link = c.link && c.link !== '#' ? c.link : '';
          lines.push(link ? `[${c.buttonText}](${link})` : `**${c.buttonText}**`);
          lines.push('');
        }
        break;

      case 'image':
        if (c.url) {
          const alt = c.alt || c.caption || '';
          lines.push(`![${alt}](${c.url})`);
          lines.push('');
        }
        break;

      default:
        // For Shopify blocks and other unrecognised types: emit any text content
        // that is present so the markdown output is not silently incomplete.
        if (c.text && typeof c.text === 'string' && c.text.trim()) {
          lines.push(c.text.trim());
          lines.push('');
        } else if (c.title && typeof c.title === 'string' && c.title.trim()) {
          lines.push(c.title.trim());
          lines.push('');
        }
        break;
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function improveContent(content: string, instructions?: string, type?: string): Promise<string> {
  const context = type ? `${type} ` : "";
  const instructionText = instructions ? ` Apply these specific instructions: ${instructions}.` : "";
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_SHORT,
    thinking: { type: "disabled" },
    system: `You are an expert content editor. Improve the provided ${context}content by making it more engaging, clear, and effective.${instructionText} ${NO_EMDASH} Return only the improved content — no prefixes, labels, or explanations.`,
    messages: [{ role: "user", content: `Improve the following content:\n\n${content}` }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : content;
  return cleanAIContent(text);
}

export async function refineContent(content: string, feedback: string, type?: string): Promise<string> {
  const context = type ? ` ${type}` : "";
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_SHORT,
    thinking: { type: "disabled" },
    system: `You are an expert content editor. Refine the provided${context} content based on specific feedback. Apply the feedback thoughtfully while maintaining the core message. ${NO_EMDASH} Return only the refined content — no prefixes, labels, or explanations.`,
    messages: [
      {
        role: "user",
        content: `Content to refine:\n${content}\n\nFeedback to apply:\n${feedback}`,
      },
    ],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : content;
  return cleanAIContent(text);
}

export async function generateTitle(
  content: string,
  type: string,
  primaryKeyword?: string,
  supportingKeywords?: string,
  metaDescription?: string,
  templateContext?: string,
  /** Existing article titles — the new title must not echo their patterns. */
  avoidTitles?: string[]
): Promise<string> {
  let userPrompt = `Generate an SEO-optimized title for this ${type} content: ${content}`;
  if (templateContext) userPrompt += `\n\nTemplate: ${templateContext}`;
  if (metaDescription) userPrompt += `\n\nMeta description context: ${metaDescription}`;
  if (primaryKeyword)
    userPrompt += `\n\nIMPORTANT: Include the primary keyword "${primaryKeyword}" naturally in the title.`;
  if (supportingKeywords)
    userPrompt += `\n\nConsider these supporting keywords for context: ${supportingKeywords}`;
  if (avoidTitles && avoidTitles.length > 0)
    userPrompt += `\n\nThese titles already exist on the site. Yours must use a different structure and wording, not the same template with new words:\n${avoidTitles.slice(0, 40).map((t) => `- ${t}`).join("\n")}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 120,
    thinking: { type: "disabled" },
    system: `You write article titles for Well Told Design — a New England gift brand. Voice: warm, specific, editorial.

THE KEYWORD IS A SEARCH QUERY — not a phrase to copy verbatim. It tells you what topic people are searching for. Your job is to write a natural, human title about that topic. You do not need to use the exact keyword words in the exact keyword order. Identify the underlying topic and write about it naturally.

CRITICAL — real English only: Every title must sound like something a real person wrote. Ask yourself: "Would I actually say this?" If the answer is no, rewrite it.
- Never use a word as a verb unless it is a common standard English verb.
- Never invent action phrases from keyword strings.
- BAD: "Gifts That Help You Sky the Night" (keyword was "sky the night" — "sky" is not a verb here)
- GOOD: "Gifts for Someone Who Loves the Night Sky" (same topic, real English)

GOALS:
1. SEO: capture the search intent of the keyword topic
2. GEO: specific, human titles get cited by AI search engines; generic ones do not

LEAD WITH THE SEARCH TERM: put the core of the keyword near the start of the title so it isn't cut off in search results, then add one specific hook.

VARY the structure:
- "Gifts for Hikers: 8 Trail Maps Worth Engraving" (topic + specific hook)
- "Night Sky Gifts for an Anniversary, From $40" (topic + price anchor)
- "How to Pick a Hometown Map Gift Someone Will Use" (how-to)
- "What Do You Get Someone Who Loves the Stars?" (question — good for AI answers)
- "Boston Gifts That Locals Would Actually Keep" (place-led)

BANNED:
- "[Keyword]: A Complete Guide" / "The Ultimate Guide to [Keyword]"
- Any year
- Lazy list titles: "10 Best [Keyword] Ideas"
- Vague superlatives with nothing specific: "Amazing", "Perfect", "Incredible"
- Overused patterns from this site: "That Feel X, Not Y", "Who Says He/She Doesn't Need Anything", "Who Has Everything" (unless it is the keyword), "He'll/She'll Actually Love", "Thoughtful", "From Someone Who Gets It"

${primaryKeyword ? `Keyword topic: "${primaryKeyword}"` : ""}

Under 60 characters so it isn't truncated in Google. ${NO_EMDASH} Return only the title — no quotes, no explanation.`,
    messages: [{ role: "user", content: userPrompt }],
  });

  let title = response.content[0].type === "text" ? response.content[0].text.trim() : `${type} Title`;
  title = title.replace(/^["'`]+|["'`]+$/g, "").replace(/—/g, "-").trim();
  return stripYearReferences(title);
}

/** Trim to a word boundary so search results don't cut a description mid-word. */
function clampMetaDescription(text: string, max = 160): string {
  const clean = text.replace(/^["'`]+|["'`]+$/g, "").replace(/—/g, "-").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:\-]+$/, "")}.`;
}

export async function generateMetaDescription(
  title: string,
  type?: string,
  primaryKeyword?: string,
  supportingKeywords?: string,
  templateContext?: string
): Promise<string> {
  let context = "";
  if (type) context += ` This is a ${type}.`;
  if (templateContext) context += ` Template: ${templateContext}.`;
  if (primaryKeyword) context += ` Primary keyword: "${primaryKeyword}".`;
  if (supportingKeywords) context += ` Supporting keywords: ${supportingKeywords}.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 150,
    thinking: { type: "disabled" },
    system: `You are an expert SEO copywriter. Generate compelling meta descriptions that encourage clicks from search results. Keep it between 150-160 characters, include relevant keywords, make it actionable, and end with a concrete reason to click (what the reader will get, not a generic "learn more").${primaryKeyword ? ` Always include the primary keyword "${primaryKeyword}" naturally.` : ""} ${NO_EMDASH} Return only the meta description — no quotes, no explanations.`,
    messages: [
      {
        role: "user",
        content: `Generate an SEO-optimized meta description for: "${title}"${context}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : `Learn more about ${title}`;
  return clampMetaDescription(text);
}

export interface KeywordSuggestion {
  keyword: string;
  type: "primary" | "secondary";
  cluster: string;
  contentTypeTarget: "blog_article" | "landing_page" | "lead_magnet";
  rationale: string;
}

const keywordSuggestionSchema = z.object({
  keyword: z.string().trim().min(1),
  type: z.enum(["primary", "secondary"]).catch("secondary"),
  cluster: z.string().trim().min(1).catch("general"),
  contentTypeTarget: z.enum(["blog_article", "landing_page", "lead_magnet"]).catch("blog_article"),
  rationale: z.string().trim().catch(""),
});

const keywordSuggestionsArraySchema = z.array(keywordSuggestionSchema);

export async function suggestKeywords(
  existingKeywords: Array<{ keyword: string; type: string; cluster: string | null; contentTypeTarget: string | null }>,
  focusCluster?: string
): Promise<KeywordSuggestion[]> {
  const kwList = existingKeywords.length > 0
    ? existingKeywords.map(k => `- "${k.keyword}" (${k.type}, cluster: ${k.cluster || "none"}, target: ${k.contentTypeTarget || "any"})`).join("\n")
    : "No keywords in library yet.";

  const clusterNote = focusCluster ? `Focus suggestions on the cluster: "${focusCluster}".` : "Suggest keywords across different clusters.";

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "disabled" },
    system: `You are an expert SEO strategist specialising in long-tail keyword research. 
Given an existing keyword library, suggest 10-20 new long-tail keyword ideas that would complement and extend the library.
Respond with ONLY a valid JSON array — no preamble, no code fences. Each element must have:
- keyword (string): the full long-tail keyword phrase
- type ("primary" | "secondary"): whether it is a primary focus keyword or supporting/secondary
- cluster (string): a short topic cluster name (e.g. "gift ideas", "sustainability", "home decor")
- contentTypeTarget ("blog_article" | "landing_page" | "lead_magnet"): best content format to target this keyword
- rationale (string): one sentence explaining why this keyword is valuable`,
    messages: [
      {
        role: "user",
        content: `Existing keyword library:\n${kwList}\n\n${clusterNote}\n\nReturn a JSON array of 10-20 suggested long-tail keywords.`,
      },
    ],
  });

  const rawText = response.content[0].type === "text" ? response.content[0].text : "[]";
  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
    const parsed = JSON.parse(jsonStr);
    const validated = keywordSuggestionsArraySchema.parse(parsed);
    return validated.filter((s) => s.keyword.length > 0);
  } catch {
    console.error("Failed to parse keyword suggestions:", rawText);
    return [];
  }
}

export interface GeneratedCTAs {
  inline: { body: string; buttonText: string; url: string };
  bottom: { headline: string; body: string; primaryButtonText: string; primaryUrl: string; secondaryText: string; secondaryUrl: string };
}

export async function generateCTAs(primaryKeyword: string, siteBaseUrl: string): Promise<GeneratedCTAs | null> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_SHORT,
      thinking: { type: "disabled" },
      system: `You are a copywriter for Well Told Design — a Boston-based gift brand known for story-driven objects: glassware, drinkware, and textiles engraved with maps, constellations, and topographic designs. Write in the Well Told brand voice: warm, specific, story-driven — never salesy. Lead with a specific image or place, not a product feature. Never use "shop now", "click here", "amazing", "perfect", exclamation points, or urgency language. ${NO_EMDASH} Respond ONLY with valid JSON — no preamble, no code fences.`,
      messages: [{
        role: "user",
        content: `Article topic: "${primaryKeyword}"

Write two CTAs for this article:

CTA 1 (inline, mid-article): One sentence (max 20 words, lead with a specific image or memory) + one button label (max 8 words). Pick the single most relevant collection URL from: /collections/gifts-for-hikers, /collections/anniversary-gifts, /collections/gifts-for-mom, /collections/wine-glasses, /collections/city-maps, /collections/map-glasses, /collections/constellation-glasses, /collections/topographic-drinkware.

CTA 2 (bottom section): One headline (max 8 words) + one supporting sentence (max 25 words) + one primary button label (max 6 words) + one secondary link label (max 6 words). Pick specific, relevant collection URLs — never use /collections/all.

Choose the URLs that best fit this topic - do not default to the same collections for every article. Do not open the inline sentence with "Think of" or "Picture", and do not reuse "the city where you had your first date" or "the trail he still talks about".

Return JSON in this exact shape (fill in every field; each url is ${siteBaseUrl} followed by one of the collection paths above):
{
  "inline": {
    "body": "...",
    "buttonText": "...",
    "url": "..."
  },
  "bottom": {
    "headline": "...",
    "body": "...",
    "primaryButtonText": "...",
    "primaryUrl": "...",
    "secondaryText": "...",
    "secondaryUrl": "..."
  }
}`,
      }],
    });
    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[AI] CTA response had no JSON object for keyword: ${primaryKeyword} — raw response:`, raw.substring(0, 500));
      return null;
    }
    return JSON.parse(jsonMatch[0]) as GeneratedCTAs;
  } catch (e) {
    console.error('[AI] CTA generation/parsing failed for keyword:', primaryKeyword);
    console.error('[AI] CTA error:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Given a free-form topic/title and a list of keyword strings from the
 * keyword library, asks Claude to identify the single best primary keyword
 * and up to 5 supporting keywords from the list.
 * Returns nulls/empty if no good match is found or the library is empty.
 */
export async function selectKeywordsForTopic(
  topic: string,
  availableKeywords: string[],
): Promise<{ primaryKeyword: string | null; supportingKeywords: string[] }> {
  if (availableKeywords.length === 0) return { primaryKeyword: null, supportingKeywords: [] };
  try {
    // Cap list to avoid oversized prompts; prioritise shorter/more specific keywords
    const kwList = availableKeywords.slice(0, 250).join("\n");
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      thinking: { type: "disabled" },
      system: `You are an SEO strategist. Given a content topic and a list of available target keywords, select the single best primary keyword and up to 5 supporting keywords.

CRITICAL RULES — read these carefully before selecting:
1. The keyword must target the EXACT SAME search intent as the topic. Same audience, same occasion, same purpose.
   - "birthday gifts for travelers" does NOT match "50th birthday gifts for him" — different audience (travelers vs. a specific man), different specificity.
   - "gifts for dad" does NOT match "gifts for grandpa" — different recipient.
   - "anniversary gifts" does NOT match "birthday gifts" — different occasion.
2. Only match if you are at least 80% confident the keyword serves the same searcher with the same need.
3. Only choose keywords that appear verbatim in the provided list — do not invent or paraphrase.
4. If no keyword is a strong match for the exact intent, return null for primary — do NOT pick the closest-sounding option.

Respond with JSON only, no explanation:
{"primary": "exact keyword from list or null", "supporting": ["kw1", "kw2"]}`,
      messages: [{ role: "user", content: `Topic: "${topic}"\n\nAvailable keywords:\n${kwList}` }],
    });
    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { primaryKeyword: null, supportingKeywords: [] };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      primaryKeyword: typeof parsed.primary === "string" ? parsed.primary : null,
      supportingKeywords: Array.isArray(parsed.supporting) ? parsed.supporting.filter((s: any) => typeof s === "string") : [],
    };
  } catch {
    return { primaryKeyword: null, supportingKeywords: [] };
  }
}

// ── Keyword Generator for New Topics ─────────────────────────────────────────
// When a user creates an article from a freeform topic and no existing library
// keyword matches, this generates a proper primary keyword, supporting keywords,
// and a cluster name to add to the keyword library.
export async function generateKeywordsForTopic(topic: string): Promise<{
  primaryKeyword: string;
  supportingKeywords: string[];
  clusterName: string;
}> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    thinking: { type: "disabled" },
    system: `You are an SEO strategist for Well Told Design, a New England gift brand selling map glassware, constellation gifts, topographic drinkware, and story-driven keepsakes. You specialise in gift-focused, occasion-based, and recipient-based keyword research.

Given a content topic or article title, return the most appropriate SEO keywords and a cluster name. Respond with JSON only — no preamble, no explanation:

{
  "primaryKeyword": "the single best target keyword phrase (3-6 words, high intent, exactly what this article should rank for)",
  "supportingKeywords": ["3 to 5 long-tail variants or related phrases that support the same intent"],
  "clusterName": "a short 2-4 word cluster label grouping these keywords (e.g. '50th birthday gifts', 'gifts for dad', 'anniversary gifts')"
}

Rules:
- The primary keyword should be the most specific, high-intent phrase — not too broad, not too narrow
- Supporting keywords should be real search variants (different phrasing, related facets)
- The cluster name should be a short, human-readable label for this topic group
- All keywords should be lowercase, no quotation marks`,
    messages: [{ role: "user", content: `Topic: "${topic}"` }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // Fallback: use the topic itself as a keyword
    return { primaryKeyword: topic.toLowerCase(), supportingKeywords: [], clusterName: topic.toLowerCase() };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      primaryKeyword: typeof parsed.primaryKeyword === "string" ? parsed.primaryKeyword : topic.toLowerCase(),
      supportingKeywords: Array.isArray(parsed.supportingKeywords)
        ? parsed.supportingKeywords.filter((s: any) => typeof s === "string")
        : [],
      clusterName: typeof parsed.clusterName === "string" ? parsed.clusterName : topic.toLowerCase(),
    };
  } catch {
    return { primaryKeyword: topic.toLowerCase(), supportingKeywords: [], clusterName: topic.toLowerCase() };
  }
}

// ── Philosophy Intro Generator ───────────────────────────────────────────────
// Generates a 150–200 word Well Told voice intro for gift guide pages.
// Runs in parallel with the main markdown generation — does not block it.
export async function generatePhilosophyIntro(
  keyword: string,
  title: string,
  brandContext?: {
    voice_document?: string;
    always_rules?: string[];
    avoid_rules?: string[];
    words_we_use?: string[];
    words_we_avoid?: string[];
  },
): Promise<string> {
  const voiceGuidance = brandContext?.voice_document
    ? `\n\nBrand voice guidance:\n${brandContext.voice_document}`
    : "";
  const alwaysRules = brandContext?.always_rules?.length
    ? `\n\nAlways:\n${brandContext.always_rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    : "";
  const avoidRules = brandContext?.avoid_rules?.length
    ? `\n\nAvoid:\n${brandContext.avoid_rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    : "";
  const wordsWeUse = brandContext?.words_we_use?.length
    ? `\n\nWords that feel like Well Told: ${brandContext.words_we_use.join(", ")}`
    : "";
  const wordsWeAvoid = brandContext?.words_we_avoid?.length
    ? `\n\nWords to avoid — generic, hollow, or off-brand: ${brandContext.words_we_avoid.join(", ")}`
    : "";

  const systemPrompt = `You write the opening philosophy section for Well Told gift guide pages. Well Told makes personalized gifts built around places, moments, and memories — custom hometown map glassware, topographic designs, night sky pieces, and other story-driven keepsakes. Every piece is made to order and tied to something specific: a city, a trail, a date, a constellation.${voiceGuidance}${alwaysRules}${avoidRules}${wordsWeUse}${wordsWeAvoid}\n\n${NO_EMDASH}`;

  const userPrompt = `Write a 2–3 paragraph opening section (150–200 words) for a Well Told gift guide page titled: "${title}"
Primary keyword/topic: ${keyword}

This section should:
- Open with a specific, emotionally resonant observation about why this kind of gift is hard to get right — the reader should immediately feel seen
- Share Well Told's genuine philosophy on what makes a great gift for this specific person or occasion — not generic advice, but the Well Told lens: gifts tied to real places, real moments, real stories
- NOT mention any specific products by name
- Sound like a thoughtful Well Told team member speaking directly to a gift-giver who cares about getting it right
- End naturally so the product content that follows feels like a direct answer to the philosophy you've set up

Tone: warm, direct, a little literary. Confident without being salesy. Like a wise gift shop owner giving real advice to a friend.

Return only the paragraph text — no heading, no markdown formatting, no preamble.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  return text;
}

export async function generateSection(topic: string, sectionType: string, context?: string): Promise<string> {
  const contextText = context ? ` Additional context: ${context}.` : "";
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    thinking: { type: "disabled" },
    system: `You are an expert content writer. Generate high-quality ${sectionType} content about the given topic. Make it engaging, informative, and well-structured.${contextText} ${NO_EMDASH} Return only the content — no prefixes, labels, or explanations.`,
    messages: [{ role: "user", content: `Write a ${sectionType} section about: ${topic}` }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text.trim() : `Content about ${topic}`;
  return cleanAIContent(text);
}
