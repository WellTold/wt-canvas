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
  "Gift Guide — Standard": "Curated roundup, warm but straightforward",
  "Gift Guide — Passion-Led": "Enthusiast tone, respect the interest, gifts that honor the lifestyle",
  "Story-Led — Mark the Moment": "Intimate, quiet, product as vessel for a memory or place",
  "Personal — The Gift That Actually Means Something": "Emotional, for someone hard to buy for",
  "Contrarian — Why These Gifts Are Always Boring": "Call out the tired category, then solve it",
  "Reframe — Gifts for the Parents, Not the Baby": "Shift the recipient framing entirely",
  "Informational — Build Authority": "Answer the question fully, bridge naturally to product",
};

export interface GenerateArticleParams {
  title: string;
  type: string;
  primaryKeyword?: string;
  supportingKeywords?: string;
  articleAngle?: string | null;
  metaDescription?: string;
  additionalInstructions?: string;
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
Meta description context: ${metaDescription || "not specified"}${articleAngle ? `\n\nContent angle / tone direction: ${articleAngle}\nAngle guidance: ${ARTICLE_ANGLE_DEFINITIONS[articleAngle] ?? ""}` : ""}${existingContentContext}`;

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
