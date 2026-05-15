import Anthropic from "@anthropic-ai/sdk";
import { higgsfield, config as higgsfieldConfig } from "@higgsfield/client/v2";
import type { V2Response } from "@higgsfield/client/v2";
import { v2 as cloudinaryV2 } from "cloudinary";

// Configure Higgsfield credentials at module load time
higgsfieldConfig({ credentials: process.env.HIGGSFIELD_CREDENTIALS });

// Cloudinary is configured globally in cloudinary.ts; we configure it here
// as well so this service works standalone without the main app import order.
cloudinaryV2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ---------------------------------------------------------------------------
// Higgsfield model endpoint slugs
// Sources: official Higgsfield CLI (higgsfield model list), JS SDK v2, Python SDK.
// Base URL: https://platform.higgsfield.ai  Auth: Key ID:SECRET
// If generation fails with NotEnoughCreditsError, top up credits at cloud.higgsfield.ai.
// ---------------------------------------------------------------------------
export const HIGGSFIELD_MODELS = {
  /** FLUX Pro Kontext Max — high quality, context-aware. */
  FLUX_KONTEXT_MAX: "flux-pro/kontext/max/text-to-image",
  /** Nano Banana 2 — Higgsfield's own fast, high-quality model. */
  NANO_BANANA: "nano_banana_2",
  /** Bytedance Seedream v4 — high quality, supports 2K resolution. */
  SEEDREAM: "bytedance/seedream/v4/text-to-image",
  /** GPT Image 2 — OpenAI image model via Higgsfield. */
  GPT_IMAGE: "gpt_image_2",
  /** Reve — fast text-to-image. */
  REVE: "reve/text-to-image",
  /** Higgsfield Soul V2 — character-consistent model. */
  SOUL: "text2image_soul_v2",
} as const;

export type HiggsfieldModelSlug = typeof HIGGSFIELD_MODELS[keyof typeof HIGGSFIELD_MODELS];

const DEFAULT_MODEL: HiggsfieldModelSlug = HIGGSFIELD_MODELS.FLUX_KONTEXT_MAX;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandContext {
  voice?: string;
  keywords?: string[];
}

export type GenerateImageRequest =
  | { mode: "prompt-only"; prompt: string; model?: string }
  | { mode: "ai-prompt"; topic: string; keyword?: string; brandContext?: BrandContext; model?: string }
  | { mode: "reference-modify"; prompt: string; referenceImageUrl: string; model?: string }
  | { mode: "reference-lifestyle"; prompt: string; referenceImageUrl: string; model?: string };

export interface GenerateImageResult {
  cloudinaryUrl: string;
  providerUrl: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function buildImagePrompt(topic: string, keyword?: string, brandContext?: BrandContext): Promise<string> {
  const brandHint = brandContext?.voice
    ? `\n\nBrand context: ${brandContext.voice}`
    : `\n\nBrand context: Well Told Design — a gift brand specialising in story-driven objects: map glassware, constellation gifts, topographic drinkware, and throws. Real places, physical objects with meaning. Earthy tones, emotional resonance.`;

  const keywordLine = keyword ? `\nSEO keyword: ${keyword}` : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    system: `You write image generation prompts for Higgsfield/FLUX. Output ONLY the prompt — no explanation, no quotes, no preamble. Keep it under 120 words.

Style: photojournalistic editorial photography. Shallow depth of field. Available light — whatever light naturally exists in the scene. Do NOT specify lighting direction, do NOT add window light, do NOT add studio softboxes. Let the scene dictate the light.

Human presence is encouraged — hands wrapping a gift, someone's back as they open a box, a person gesturing at a table, hands around a drink. No frontal faces. A moment with a person in it beats a table arrangement every time.

AVOID flatlay / object arrangements — do NOT pile up books, maps, compasses, journals, and props on a table. These produce AI-artifact slop. Prefer one or two simple props max, or a moment with a person. Never render objects with fine surface detail, embossing, printed maps, or engraved text.

Focus on: the occasion or feeling behind the topic, a specific real setting, emotional resonance. Avoid logos, legible text.`,
    messages: [
      {
        role: "user",
        content: `Write an image generation prompt for a hero/featured image for an article about: "${topic}"${keywordLine}${brandHint}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : topic;
  return text;
}

async function callHiggsfield(modelSlug: string, input: Record<string, unknown>): Promise<string> {
  const response: V2Response = await higgsfield.subscribe(modelSlug, {
    input,
    withPolling: true,
  });

  // V2Response exposes images[] for image generation endpoints
  const imageUrl = response?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error(`Higgsfield returned no image URL. Response: ${JSON.stringify(response)}`);
  }
  return imageUrl;
}

async function downloadAndUploadToCloudinary(sourceUrl: string, folder = "wt-generated"): Promise<string> {
  // Explicitly fetch the image bytes from the provider URL before uploading,
  // so we are not reliant on Cloudinary's remote-fetch behaviour (which may
  // fail for short-lived signed provider URLs).
  const fetched = await fetch(sourceUrl);
  if (!fetched.ok) {
    throw new Error(`Failed to download generated image from provider (${fetched.status}): ${sourceUrl}`);
  }
  const buffer = Buffer.from(await fetched.arrayBuffer());

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const uploadStream = cloudinaryV2.uploader.upload_stream(
      { folder, resource_type: "image", fetch_format: "auto", quality: "auto:best" },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Cloudinary upload_stream returned no result"));
        else resolve(result);
      },
    );
    uploadStream.end(buffer);
  });

  return result.secure_url;
}

// ---------------------------------------------------------------------------
// Aspect ratio → width/height map
// ---------------------------------------------------------------------------
const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1":  { width: 1024, height: 1024 },
  "9:16": { width: 576,  height: 1024 },
  "4:3":  { width: 1024, height: 768  },
  "3:4":  { width: 768,  height: 1024 },
  "16:9": { width: 2048, height: 1152 },
};

// ---------------------------------------------------------------------------
// Image Studio — generate a single image for a given aspect ratio
// ---------------------------------------------------------------------------
export async function generateStudioImage(params: {
  prompt: string;
  model: string;
  aspectRatio: string;
  referenceImageUrls: string[];
}): Promise<string> {
  const { prompt, model, aspectRatio, referenceImageUrls } = params;
  const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio] ?? { width: 1024, height: 1024 };

  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    width: dims.width,
    height: dims.height,
    safety_tolerance: 2,
  };

  // Higgsfield's image_url field accepts a single conditioning URL.
  // If multiple reference images are provided, only the first is used for
  // composition conditioning — multi-image conditioning is not supported by
  // the current Higgsfield API.
  if (referenceImageUrls.length > 0) {
    input.image_url = referenceImageUrls[0];
  }

  console.log(`[imageGeneration] studio mode=${model} ratio=${aspectRatio} prompt="${prompt.substring(0, 60)}…"`);
  const providerUrl = await callHiggsfield(model, input);
  const cloudinaryUrl = await downloadAndUploadToCloudinary(providerUrl, "wt-generated");
  return cloudinaryUrl;
}

// ---------------------------------------------------------------------------
// Expand/resize an existing image to a different aspect ratio.
// Uses the FLUX Kontext Max model (context-aware image-conditioned generation)
// which accepts image_url as a conditioning input and re-renders it at a new
// aspect ratio while preserving composition.  The expand_image_url parameter
// is sent when the endpoint supports explicit outpainting; image_url is the
// standard field and provides visual context for composition consistency.
// ---------------------------------------------------------------------------
const EXPAND_MODEL = HIGGSFIELD_MODELS.FLUX_KONTEXT_MAX;

export async function expandImage(params: {
  sourceUrl: string;
  targetAspectRatio: string;
}): Promise<string> {
  const { sourceUrl, targetAspectRatio } = params;
  const dims = ASPECT_RATIO_DIMENSIONS[targetAspectRatio] ?? { width: 1024, height: 1024 };

  const input: Record<string, unknown> = {
    image_url: sourceUrl,
    aspect_ratio: targetAspectRatio,
    width: dims.width,
    height: dims.height,
    safety_tolerance: 2,
    prompt: "expand the image to fill the new aspect ratio, preserving the original composition and style",
  };

  console.log(`[imageGeneration] expand to ${targetAspectRatio} using ${EXPAND_MODEL}`);
  const providerUrl = await callHiggsfield(EXPAND_MODEL, input);
  const cloudinaryUrl = await downloadAndUploadToCloudinary(providerUrl, "wt-generated");
  return cloudinaryUrl;
}

// ---------------------------------------------------------------------------
// Article featured image — full-content prompt builder
// ---------------------------------------------------------------------------

async function buildArticleImagePrompt(
  title: string,
  primaryKeyword: string,
  articleContent: string,
): Promise<string> {
  // Truncate article content to ~2,000 tokens to keep cost-controlled.
  // The opening of an article carries the most relevant context.
  const truncatedContent = articleContent.slice(0, 8000);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: `You write image generation prompts for Higgsfield/FLUX. Output ONLY the prompt — no explanation, no quotes, no preamble. Keep it under 130 words.

Style: photojournalistic editorial photography. Shallow depth of field. Available light only — whatever light naturally exists in the scene. Do NOT specify lighting direction (no "window light from the left", no "golden hour", no studio softboxes, no "soft shadows"). Let the scene and moment dictate how the light falls.

Human presence is encouraged — hands holding a gift, someone's back or side profile, hands around a drink, a person at a table. No frontal faces. A moment with a person in it is almost always better than a table arrangement of objects.

AVOID flatlay / object arrangements — do NOT pile up books, journals, maps, compasses, and props on a table. These produce AI-artifact slop. One or two simple props max, or a person in a moment. Never render objects with fine surface detail, embossing, printed text on surfaces, or engraved patterns — FLUX renders these badly.

Brand context: Well Told Design is a New England gift brand. Photography should feel real, unposed, and emotionally honest. Earthy, warm tones. No studio setups.

Composition should match the article topic and occasion — birthday or celebration topics get social moments; outdoor and active topics get outdoor settings; sentimental or family topics get warm interior moments. Let the topic, occasion, and recipient drive the scene. Be specific about the moment, not the objects.

Always end with: No frontal faces, no legible text, no logos.`,
    messages: [
      {
        role: "user",
        content: `Here is the article. Write a Higgsfield image generation prompt for its hero image. The prompt should be grounded in the actual content, tone, and subject matter of this article — not just its title. Be specific: prefer a real moment over a generic setting.

Title: ${title}
Primary keyword: ${primaryKeyword}

Article:
${truncatedContent}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : null;

  if (!text) {
    console.warn("[buildArticleImagePrompt] Claude returned no text, using fallback prompt.");
    return "Photojournalistic editorial photograph. A kraft-wrapped gift with a natural twine bow resting on a worn oak surface beside a ceramic mug. Available light, earthy tones, unposed. No text, no people, no faces, no legible writing.";
  }

  return text;
}

export async function generateArticleFeaturedImage(
  title: string,
  primaryKeyword: string,
  articleContent: string,
): Promise<GenerateImageResult> {
  const prompt = await buildArticleImagePrompt(title, primaryKeyword, articleContent);

  console.log(`[generateArticleFeaturedImage] prompt: "${prompt.substring(0, 100)}…"`);

  const higgsInput: Record<string, unknown> = {
    prompt,
    aspect_ratio: "16:9",
    width: 2048,
    height: 1152,
    safety_tolerance: 2,
  };

  const providerUrl = await callHiggsfield(HIGGSFIELD_MODELS.FLUX_KONTEXT_MAX, higgsInput);
  const cloudinaryUrl = await downloadAndUploadToCloudinary(providerUrl, "wt-article-hero");

  console.log(`[generateArticleFeaturedImage] Cloudinary URL: ${cloudinaryUrl}`);
  return { cloudinaryUrl, providerUrl, model: HIGGSFIELD_MODELS.FLUX_KONTEXT_MAX };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function generateImage(request: GenerateImageRequest): Promise<GenerateImageResult> {
  const modelSlug = request.model ?? DEFAULT_MODEL;

  let prompt: string;
  let extraInput: Record<string, unknown> = {};

  switch (request.mode) {
    case "ai-prompt":
      prompt = await buildImagePrompt(request.topic, request.keyword, request.brandContext);
      break;

    case "prompt-only":
      prompt = request.prompt;
      break;

    case "reference-modify":
      prompt = request.prompt;
      extraInput = { image_url: request.referenceImageUrl };
      break;

    case "reference-lifestyle":
      prompt = request.prompt;
      extraInput = { image_url: request.referenceImageUrl };
      break;
  }

  console.log(`[imageGeneration] mode=${request.mode} model=${modelSlug} prompt="${prompt.substring(0, 80)}…"`);

  const higgsInput: Record<string, unknown> = {
    prompt,
    aspect_ratio: "16:9",
    width: 2048,
    height: 1152,
    safety_tolerance: 2,
    ...extraInput,
  };

  const providerUrl = await callHiggsfield(modelSlug, higgsInput);
  console.log(`[imageGeneration] provider URL: ${providerUrl}`);

  const cloudinaryUrl = await downloadAndUploadToCloudinary(providerUrl);
  console.log(`[imageGeneration] Cloudinary URL: ${cloudinaryUrl}`);

  return { cloudinaryUrl, providerUrl, model: modelSlug };
}
