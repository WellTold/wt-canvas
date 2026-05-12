import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS_ARTICLE = 8192;
const MAX_TOKENS_SHORT = 1024;

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
  // Strip year from H1 title line — titles should be evergreen
  cleaned = cleaned.replace(/^(#\s+[^\n]*?)\s*\b20\d{2}\b\s*([^\n]*)/m, (_, before, after) => {
    console.warn(`[AI] Stripped year reference from generated title`);
    return after.trim() ? `${before} ${after.trim()}` : before;
  });
  return cleaned.trim();
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

const FORMAT_A_INSTRUCTIONS = `FORMAT: Well Told Gift Guide
Write a focused gift guide of 5-7 items maximum. Every recommendation must come from the Well Told product universe defined above. Give each item 2-4 sentences of story context — why this specific object works for this specific person or moment. Do not use bullet points for product descriptions; write in prose. Aim for 700-950 words total including intro and CTA paragraph. End with a single CTA paragraph linking to the collection. Do not pad with generic lifestyle products outside Well Told's world.`;

const FORMAT_B_INSTRUCTIONS = `FORMAT: Brand Editorial Guide
Write this as an opinionated essay, not a product list. The goal is to help the reader think differently about gifting in this context. Reference Well Told products 2-3 times as concrete examples, but do not make this a roundup. Write 600-900 words. End with a single understated CTA paragraph.`;

const FORMAT_C_INSTRUCTIONS = `FORMAT: Professional Landing Page
Write for a professional buyer (realtor, HR director, financial advisor, etc.) who needs a gift that reflects well on them. Lead with their challenge, not our products. Speak peer-to-peer. Include practical context about how Well Told products can be personalized for this professional context. End with both a shop CTA and a volume inquiry CTA.`;

const PERSONA_DEFINITIONS: Record<string, string> = {
  "Personal Gifter": "Individual buying for someone they love. They want emotional permission and confidence they've found the right thing.",
  "Professional Gifter": "Service professional (realtor, advisor, planner) buying for a client. They need the gift to reflect well on them.",
  "Institutional Buyer": "HR director, hospital, school buying in volume. They need process clarity, reliability, and scale confidence.",
  "Brand / Editorial": "Discovery-phase reader. Not yet buying. Give generously — earn trust, not just a click.",
};

function detectFormat(type: string, articleAngle?: string | null, keywordType?: string): 'A' | 'B' | 'C' {
  if (articleAngle) {
    const angle = articleAngle.toLowerCase();
    if (angle.includes('contrarian') || angle.includes('reframe')) return 'A';
  }
  if (type === 'landing_page' || type === 'landing') return 'C';
  if (keywordType === 'informational') return 'B';
  return 'A';
}

function detectPersona(type: string, keywordType?: string, primaryKeyword?: string): string {
  const kw = (primaryKeyword || '').toLowerCase();
  if (type === 'landing_page' || type === 'landing') {
    if (kw.includes('corporate') || kw.includes('hospital') || kw.includes('employee') || kw.includes('school') || kw.includes('company') || kw.includes('volume') || kw.includes('bulk')) {
      return 'Institutional Buyer';
    }
    return 'Professional Gifter';
  }
  if (keywordType === 'informational') return 'Brand / Editorial';
  return 'Personal Gifter';
}

export interface FAQItem {
  question: string;
  answer: string;
}

export async function generateFAQ(primaryKeyword: string, supportingKeywords?: string): Promise<FAQItem[]> {
  const systemPrompt = `You generate FAQ content for Well Told Design, a Boston-based gift brand making story-driven objects — map glassware, constellation gifts, and topographic drinkware.

Rules:
- Questions should mirror how a real person searches Google (e.g. "What is a good gift for a hiker who has everything?")
- Answers should be 2-4 sentences, direct, and specific
- At least 2 answers should naturally mention a Well Told product type (map glassware, constellation gifts, personalized drinkware, throws, etc.)
- Do not be salesy — answer the question genuinely first, then mention the product as a concrete example
- Questions should cover: what to give, how to choose, what makes a good gift, and at least one specific Well Told angle
- Do not use exclamation points
- Do not use: amazing, incredible, perfect, stunning, game-changer, must-have

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
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    rawText = response.content[0].type === 'text' ? response.content[0].text : '[]';
    // Strip any markdown code fences the model might add
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) {
      console.log(`[AI] FAQ generated ${parsed.length} items for keyword: ${primaryKeyword}`);
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
- Do not use em-dashes (—), use hyphens (-) instead
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
  keywordType?: string;
  format?: 'A' | 'B' | 'C';
  productContext?: string;
  siteBaseUrl?: string;
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
    format: formatOverride,
    productContext,
    siteBaseUrl = "https://welltolddesign.com",
  } = params;

  // [1] Brand voice — prefer stored voice doc, fall back to hardcoded constant
  const brandVoice = brandContext?.voice_document || WELL_TOLD_BRAND_VOICE_FALLBACK;

  // [2] Auto-detect format (A/B/C) unless overridden
  const format = formatOverride || detectFormat(type, articleAngle, keywordType);
  const formatInstruction =
    format === 'C' ? FORMAT_C_INSTRUCTIONS :
    format === 'B' ? FORMAT_B_INSTRUCTIONS :
    FORMAT_A_INSTRUCTIONS;

  // [3] Auto-detect persona
  const persona = detectPersona(type, keywordType, primaryKeyword);
  const personaDescription = PERSONA_DEFINITIONS[persona] || PERSONA_DEFINITIONS['Personal Gifter'];

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
    `[1. BRAND VOICE BLOCK]\n${brandVoice}`,

    // Block 2: Keyword Context
    [
      '[2. KEYWORD CONTEXT BLOCK]',
      primaryKeyword
        ? `Primary keyword (optimize H1, meta title, meta description, and opening paragraph for this exact term): ${primaryKeyword}`
        : '',
      supportingKeywords
        ? `Supporting keywords (weave naturally throughout body — do not force, do not repeat more than twice each):\n${supportingKeywords}`
        : '',
      keywordType ? `Keyword intent: ${keywordType}` : '',
      articleAngle
        ? `Article angle / tone direction: ${articleAngle}${angleDefinition ? `\n  → ${angleDefinition}` : ''}`
        : '',
      '',
      'Angle definitions for reference:',
      Object.entries(ARTICLE_ANGLE_DEFINITIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n'),
    ].filter(Boolean).join('\n'),

    // Block 3: Format
    `[3. FORMAT BLOCK]\n${formatInstruction}`,

    // Block 4: Persona
    [
      '[4. PERSONA BLOCK]',
      `Target reader persona: ${persona}`,
      personaDescription,
      '',
      'Persona reference:',
      Object.entries(PERSONA_DEFINITIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n'),
    ].join('\n'),

    // Block 5: Product Context
    productContext
      ? `[5. PRODUCT CONTEXT BLOCK]
Relevant Well Told products for this article. Each line shows the product link and, where available, a product image URL.

LINKING: When you reference a product inline, use Markdown hyperlink syntax: [Product Name](url). Do not bold the product name.

IMAGES: Where a product line includes "— image: <url>", embed the image once in the article at a natural point near where you first mention that product, using this syntax:
![Product Name](image-url)
Place the image directly after the paragraph that mentions the product. Do not embed the same image twice. Only use image URLs explicitly listed below — do not invent or guess image URLs.

${productContext}

Standard Well Told collection links you may also use where natural:
- [Map Glassware](${siteBaseUrl}/collections/map-glasses)
- [Constellation Glassware](${siteBaseUrl}/collections/constellation-glasses)
- [Topographic Drinkware](${siteBaseUrl}/collections/topographic-drinkware)`
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
- Do not include a year in the title or article — titles should be evergreen
- Do not use exclamation points
- Do not use the words: amazing, incredible, perfect, stunning, game-changer, must-have, high-quality, affordable luxury
- Do not write bullet-point product descriptions — use prose
- Do end with exactly one CTA — not multiple competing calls to action
- Do write in second person ("you", "your") for gift guides
- HYPERLINKS: When referencing any Well Told product or collection, always use Markdown link syntax [text](url). Never bold a product name that should be a link. Every product mention should be a clickable hyperlink.
- AMERICAN ENGLISH ONLY: Use American spellings throughout — "specializing" not "specialising", "personalized" not "personalised", "recognizing" not "recognising", etc. The audience is US-based.

ARTICLE STRUCTURE — CRITICAL:
- NEVER open with a brand description or company bio paragraph. Do NOT write "Well Told Design is a [city]-based brand..." or any sentence that introduces the company at the top. This interrupts reader momentum and hurts SEO by placing off-topic content before the article body.
- The article must open immediately with story, hook, or content that serves the reader's search intent. The person landing from search is in discovery or buying mode — earn their attention before mentioning the brand.
- If brand context belongs anywhere, place a brief 2-sentence brand note AFTER the final CTA at the very end of the article, as a closing trust signal. Keep it factual and American English. Omit city/location references (do not say "Boston-based" or name a specific city).`,

    // Block 7: SEO Rules
    `[7. SEO RULES BLOCK]
These articles are written for SEO. Follow SEO best practices for search-intent-matched content:
- Match reader intent: someone arriving from search is looking for answers, recommendations, or inspiration — serve that need immediately in the opening paragraph
- Include the primary keyword in: H1 and within the first 100 words of body copy
- Include each supporting keyword at least once naturally in the body — spread them across different sections
- NEVER write supporting keywords as a series or list in the same sentence or paragraph (e.g., do NOT write "whether you're looking for X, Y, or Z" or "gifts for mom for Christmas, Mother's Day, birthdays..."). Each keyword belongs in its own sentence, in a different section
- Do not stuff keywords — if it doesn't read naturally, cut it
- H1 should match or closely paraphrase the article title
- Use ## for H2 section headers — each should naturally include a supporting keyword where possible
- Keep the opening paragraph tightly relevant to the search query — Google uses it to confirm topical match
- Return a single complete Markdown document starting with the # H1 title
- Use standard Markdown: **bold**, *italic*, [hyperlinks](url), bullet lists, numbered lists, blockquotes (>)
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
    system: `You are an expert content editor. Improve the provided ${context}content by making it more engaging, clear, and effective.${instructionText} Return only the improved content — no prefixes, labels, or explanations.`,
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
    system: `You are an expert content editor. Refine the provided${context} content based on specific feedback. Apply the feedback thoughtfully while maintaining the core message. Return only the refined content — no prefixes, labels, or explanations.`,
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
  templateContext?: string
): Promise<string> {
  let userPrompt = `Generate an SEO-optimized title for this ${type} content: ${content}`;
  if (templateContext) userPrompt += `\n\nTemplate: ${templateContext}`;
  if (metaDescription) userPrompt += `\n\nMeta description context: ${metaDescription}`;
  if (primaryKeyword)
    userPrompt += `\n\nIMPORTANT: Include the primary keyword "${primaryKeyword}" naturally in the title.`;
  if (supportingKeywords)
    userPrompt += `\n\nConsider these supporting keywords for context: ${supportingKeywords}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 100,
    system: `You are an expert SEO copywriter. Generate compelling, SEO-optimized titles for ${type} content. Keep it under 60 characters when possible.${primaryKeyword ? ` Always include the primary keyword "${primaryKeyword}" naturally.` : ""} Return only the title text — no quotation marks, no explanations.`,
    messages: [{ role: "user", content: userPrompt }],
  });

  let title = response.content[0].type === "text" ? response.content[0].text.trim() : `${type} Title`;
  title = title.replace(/^["'`]+|["'`]+$/g, "").trim();
  return title;
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
    system: `You are an expert SEO copywriter. Generate compelling meta descriptions that encourage clicks from search results. Keep it between 150-160 characters, include relevant keywords, make it actionable.${primaryKeyword ? ` Always include the primary keyword "${primaryKeyword}" naturally.` : ""} Return only the meta description — no quotes, no explanations.`,
    messages: [
      {
        role: "user",
        content: `Generate an SEO-optimized meta description for: "${title}"${context}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : `Learn more about ${title}`;
  return text;
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
      system: `You are a copywriter for Well Told Design — a Boston-based gift brand known for story-driven objects: glassware, drinkware, and textiles engraved with maps, constellations, and topographic designs. Write in the Well Told brand voice: warm, specific, story-driven — never salesy. Lead with a specific image or place, not a product feature. Never use "shop now", "click here", "amazing", "perfect", exclamation points, or urgency language. Respond ONLY with valid JSON — no preamble, no code fences.`,
      messages: [{
        role: "user",
        content: `Article topic: "${primaryKeyword}"

Write two CTAs for this article:

CTA 1 (inline, mid-article): One sentence (max 20 words, lead with a specific image or memory) + one button label (max 8 words). Pick the single most relevant collection URL from: /collections/gifts-for-hikers, /collections/anniversary-gifts, /collections/gifts-for-mom, /collections/wine-glasses, /collections/city-maps, /collections/map-glasses, /collections/constellation-glasses, /collections/topographic-drinkware.

CTA 2 (bottom section): One headline (max 8 words) + one supporting sentence (max 25 words) + one primary button label (max 6 words) + one secondary link label (max 6 words). Pick specific, relevant collection URLs — never use /collections/all.

Return JSON in this exact shape (fill in all fields):
{
  "inline": {
    "body": "...",
    "buttonText": "...",
    "url": "${siteBaseUrl}/collections/anniversary-gifts"
  },
  "bottom": {
    "headline": "...",
    "body": "...",
    "primaryButtonText": "...",
    "primaryUrl": "${siteBaseUrl}/collections/map-glasses",
    "secondaryText": "Explore More Gifts",
    "secondaryUrl": "${siteBaseUrl}/collections/constellation-glasses"
  }
}`,
      }],
    });
    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as GeneratedCTAs;
  } catch {
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
      system: `You are an SEO strategist. Given a content topic and a list of available target keywords, select the single best primary keyword and up to 5 supporting keywords that are semantically relevant to the topic. Only choose keywords that genuinely appear in the provided list — do not invent or paraphrase. If no keyword is a good match, return null for primary. Respond with JSON only, no explanation:\n{"primary": "exact keyword from list or null", "supporting": ["kw1", "kw2"]}`,
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

export async function generateSection(topic: string, sectionType: string, context?: string): Promise<string> {
  const contextText = context ? ` Additional context: ${context}.` : "";
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: `You are an expert content writer. Generate high-quality ${sectionType} content about the given topic. Make it engaging, informative, and well-structured.${contextText} Return only the content — no prefixes, labels, or explanations.`,
    messages: [{ role: "user", content: `Write a ${sectionType} section about: ${topic}` }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text.trim() : `Content about ${topic}`;
  return cleanAIContent(text);
}
