import Anthropic from "@anthropic-ai/sdk";
import { higgsfield, config as higgsfieldConfig } from "@higgsfield/client/v2";
import type { V2Response } from "@higgsfield/client/v2";
import { fal } from "@fal-ai/client";
import { v2 as cloudinaryV2 } from "cloudinary";

// Configure Higgsfield (platform.higgsfield.ai — path-style slugs only)
higgsfieldConfig({ credentials: process.env.HIGGSFIELD_CREDENTIALS });

// Configure fal.ai (Nano Banana Pro and other models)
fal.config({ credentials: process.env.FAL_KEY });

// Cloudinary
cloudinaryV2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------
// FAL models use "fal-ai/..." IDs and are routed through fal.ai.
// Higgsfield models use path-style slugs and go through platform.higgsfield.ai.
// ---------------------------------------------------------------------------

export const FAL_MODELS = {
  NANO_BANANA_PRO:   "fal-ai/nano-banana-pro",  // Nano Banana Pro (best quality)
  NANO_BANANA:       "fal-ai/nano-banana",       // Nano Banana (standard)
} as const;

export const HIGGSFIELD_MODELS = {
  FLUX_KONTEXT_MAX:  "flux-pro/kontext/max/text-to-image",
  REVE:              "reve/text-to-image",
} as const;

export type FalModelId = typeof FAL_MODELS[keyof typeof FAL_MODELS];
export type HiggsfieldModelSlug = typeof HIGGSFIELD_MODELS[keyof typeof HIGGSFIELD_MODELS];
export type ModelId = FalModelId | HiggsfieldModelSlug;

const DEFAULT_MODEL: ModelId = FAL_MODELS.NANO_BANANA_PRO;

function isFalModel(model: string): boolean {
  return model.startsWith("fal-ai/");
}

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
    system: `You write image generation prompts for FLUX/Nano Banana. Output ONLY the prompt — no explanation, no quotes, no preamble. Keep it under 120 words.

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

// ---------------------------------------------------------------------------
// fal.ai generation
// ---------------------------------------------------------------------------
async function callFal(modelId: string, input: Record<string, unknown>): Promise<string> {
  const result = await fal.subscribe(modelId, {
    input,
    logs: false,
  }) as { data?: { images?: Array<{ url: string }> }; images?: Array<{ url: string }> };

  // fal.ai wraps the response in a `data` envelope; fall back to top-level for older models
  const imageUrl = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error(`fal.ai returned no image URL for ${modelId}. Response: ${JSON.stringify(result)}`);
  }
  return imageUrl;
}

// ---------------------------------------------------------------------------
// Higgsfield generation (path-style slugs only — platform.higgsfield.ai)
// ---------------------------------------------------------------------------
async function callHiggsfield(modelSlug: string, input: Record<string, unknown>): Promise<string> {
  const response: V2Response = await higgsfield.subscribe(modelSlug, {
    input,
    withPolling: true,
  });

  const imageUrl = response?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error(`Higgsfield returned no image URL. Response: ${JSON.stringify(response)}`);
  }
  return imageUrl;
}

// ---------------------------------------------------------------------------
// Unified generation dispatcher
// ---------------------------------------------------------------------------
async function callModel(modelId: string, input: Record<string, unknown>): Promise<string> {
  if (isFalModel(modelId)) {
    return callFal(modelId, input);
  }
  return callHiggsfield(modelId, input);
}

// ---------------------------------------------------------------------------
// Cloudinary upload
// ---------------------------------------------------------------------------
async function downloadAndUploadToCloudinary(sourceUrl: string, folder = "wt-generated"): Promise<string> {
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

// Fal.ai uses "aspect_ratio" string directly (e.g. "16:9") but some models
// may also accept width/height. We send both to be safe.
function buildDimInput(aspectRatio: string): Record<string, unknown> {
  const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio] ?? { width: 1024, height: 1024 };
  return { aspect_ratio: aspectRatio, image_size: { width: dims.width, height: dims.height } };
}

// ---------------------------------------------------------------------------
// Image Studio
// ---------------------------------------------------------------------------
export async function generateStudioImage(params: {
  prompt: string;
  model: string;
  aspectRatio: string;
  referenceImageUrls: string[];
}): Promise<string> {
  const { prompt, model, aspectRatio, referenceImageUrls } = params;

  const input: Record<string, unknown> = {
    prompt,
    ...buildDimInput(aspectRatio),
    safety_tolerance: 2,
  };

  if (referenceImageUrls.length > 0) {
    input.image_url = referenceImageUrls[0];
  }

  console.log(`[imageGeneration] studio model=${model} ratio=${aspectRatio} prompt="${prompt.substring(0, 60)}…"`);
  const providerUrl = await callModel(model, input);
  const cloudinaryUrl = await downloadAndUploadToCloudinary(providerUrl, "wt-generated");
  return cloudinaryUrl;
}

// ---------------------------------------------------------------------------
// Image expand/resize (always uses FLUX Kontext Max via Higgsfield)
// ---------------------------------------------------------------------------
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

  console.log(`[imageGeneration] expand to ${targetAspectRatio} using ${HIGGSFIELD_MODELS.FLUX_KONTEXT_MAX}`);
  const providerUrl = await callHiggsfield(HIGGSFIELD_MODELS.FLUX_KONTEXT_MAX, input);
  const cloudinaryUrl = await downloadAndUploadToCloudinary(providerUrl, "wt-generated");
  return cloudinaryUrl;
}

// ---------------------------------------------------------------------------
// Article featured image
// ---------------------------------------------------------------------------
async function buildArticleImagePrompt(
  title: string,
  primaryKeyword: string,
  articleContent: string,
): Promise<string> {
  const truncatedContent = articleContent.slice(0, 8000);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: `You write image generation prompts for FLUX/Nano Banana. Output ONLY the prompt — no explanation, no quotes, no preamble. Keep it under 130 words.

Style: photojournalistic editorial photography. Shallow depth of field. Available light only — whatever light naturally exists in the scene. Do NOT specify lighting direction (no "window light from the left", no "golden hour", no studio softboxes, no "soft shadows"). Let the scene and moment dictate how the light falls.

Human presence is encouraged — hands holding a gift, someone's back or side profile, hands around a drink, a person at a table. No frontal faces. A moment with a person in it is almost always better than a table arrangement of objects.

AVOID flatlay / object arrangements — do NOT pile up books, journals, maps, compasses, and props on a table. These produce AI-artifact slop. One or two simple props max, or a person in a moment. Never render objects with fine surface detail, embossing, printed text on surfaces, or engraved patterns.

Brand context: Well Told Design is a New England gift brand. Photography should feel real, unposed, and emotionally honest. Earthy, warm tones. No studio setups.

Composition should match the article topic and occasion — birthday or celebration topics get social moments; outdoor and active topics get outdoor settings; sentimental or family topics get warm interior moments. Let the topic, occasion, and recipient drive the scene. Be specific about the moment, not the objects.

Always end with: No frontal faces, no legible text, no logos.`,
    messages: [
      {
        role: "user",
        content: `Here is the article. Write an image generation prompt for its hero image. The prompt should be grounded in the actual content, tone, and subject matter of this article — not just its title. Be specific: prefer a real moment over a generic setting.

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
  const model = DEFAULT_MODEL;

  console.log(`[generateArticleFeaturedImage] model=${model} prompt: "${prompt.substring(0, 100)}…"`);

  const input: Record<string, unknown> = {
    prompt,
    ...buildDimInput("16:9"),
    safety_tolerance: 2,
  };

  const providerUrl = await callModel(model, input);
  const cloudinaryUrl = await downloadAndUploadToCloudinary(providerUrl, "wt-article-hero");

  console.log(`[generateArticleFeaturedImage] Cloudinary URL: ${cloudinaryUrl}`);
  return { cloudinaryUrl, providerUrl, model };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function generateImage(request: GenerateImageRequest): Promise<GenerateImageResult> {
  const modelId = request.model ?? DEFAULT_MODEL;

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

  console.log(`[imageGeneration] mode=${request.mode} model=${modelId} prompt="${prompt.substring(0, 80)}…"`);

  const input: Record<string, unknown> = {
    prompt,
    ...buildDimInput("16:9"),
    safety_tolerance: 2,
    ...extraInput,
  };

  const providerUrl = await callModel(modelId, input);
  console.log(`[imageGeneration] provider URL: ${providerUrl}`);

  const cloudinaryUrl = await downloadAndUploadToCloudinary(providerUrl);
  console.log(`[imageGeneration] Cloudinary URL: ${cloudinaryUrl}`);

  return { cloudinaryUrl, providerUrl, model: modelId };
}
