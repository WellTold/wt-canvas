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
