import Anthropic from "@anthropic-ai/sdk";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ---------------------------------------------------------------------------
// Higgsfield model endpoint slugs
// Verify these against https://console.higgsfield.ai after credential setup.
// To swap the default model, update DEFAULT_MODEL below.
// ---------------------------------------------------------------------------
export const HIGGSFIELD_MODELS = {
  FLUX_PRO: "flux-pro/text-to-image",
  FLUX_KONTEXT_MAX: "flux-pro/kontext/max/text-to-image",
  BANA_PRO: "bana-pro/text-to-image",
  NANO: "nano/text-to-image",
} as const;

const DEFAULT_MODEL = HIGGSFIELD_MODELS.FLUX_PRO;

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
    : `\n\nBrand context: Well Told Design — a gift brand specialising in story-driven objects: map glassware, constellation gifts, topographic drinkware, and throws. Warm photography, real places, physical objects with meaning. Earthy tones, natural light, emotional resonance.`;

  const keywordLine = keyword ? `\nSEO keyword: ${keyword}` : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    system: `You write image generation prompts for Higgsfield/FLUX. Output ONLY the prompt — no explanation, no quotes, no preamble. Keep it under 120 words. Focus on: warm natural photography, specific real-world setting, beautiful physical objects, soft earthy tones, emotional resonance. Avoid text overlays, faces, logos.`,
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
  const { higgsfield, config } = await import("@higgsfield/client/v2") as any;
  config({ credentials: process.env.HIGGSFIELD_CREDENTIALS });

  const jobSet = await higgsfield.subscribe(modelSlug, {
    input,
    withPolling: true,
  });

  const url = jobSet?.jobs?.[0]?.results?.raw?.url;
  if (!url) {
    throw new Error(`Higgsfield returned no image URL. Job set: ${JSON.stringify(jobSet)}`);
  }
  return url as string;
}

async function uploadToCloudinary(sourceUrl: string, folder = "wt-generated"): Promise<string> {
  const result = await cloudinary.uploader.upload(sourceUrl, {
    folder,
    resource_type: "image",
    fetch_format: "auto",
    quality: "auto:best",
  });
  return result.secure_url;
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
    safety_tolerance: 2,
    ...extraInput,
  };

  const providerUrl = await callHiggsfield(modelSlug, higgsInput);
  console.log(`[imageGeneration] Higgsfield URL: ${providerUrl}`);

  const cloudinaryUrl = await uploadToCloudinary(providerUrl);
  console.log(`[imageGeneration] Cloudinary URL: ${cloudinaryUrl}`);

  return { cloudinaryUrl, providerUrl, model: modelSlug };
}
