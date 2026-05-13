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
// Source: https://console.higgsfield.ai — verify/update after dashboard login.
// To change the default model, update DEFAULT_MODEL below.
// ---------------------------------------------------------------------------
export const HIGGSFIELD_MODELS = {
  /** FLUX Pro — high quality text-to-image */
  FLUX_PRO: "flux-pro/text-to-image",
  /** FLUX Pro Kontext Max — highest quality, slower */
  FLUX_KONTEXT_MAX: "flux-pro/kontext/max/text-to-image",
  /** Bana Pro — stylised text-to-image */
  BANA_PRO: "bana-pro/text-to-image",
  /** Nano Bana Pro — Bana Pro at nano speed tier (default — often in unlimited mode) */
  NANO_BANA_PRO: "bana-pro/nano/text-to-image",
  /** Nano — fast, lower cost text-to-image */
  NANO: "nano/text-to-image",
  /** ChatGPT Image 2 — OpenAI-backed generation via Higgsfield */
  CHATGPT_IMAGE_2: "chatgpt-image-2/text-to-image",
} as const;

export type HiggsfieldModelSlug = typeof HIGGSFIELD_MODELS[keyof typeof HIGGSFIELD_MODELS];

const DEFAULT_MODEL: HiggsfieldModelSlug = HIGGSFIELD_MODELS.NANO_BANA_PRO;

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
