import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ShopifyResourcePicker } from "@/components/ShopifyResourcePicker";
import { WTProductRenderPicker } from "@/components/WTProductRenderPicker";
import { Loader2, Upload, X, Download, CloudUpload, Image, Package } from "lucide-react";
import type { ImageTemplate } from "@shared/schema";
import { SiShopify as SiShopifyIcon } from "react-icons/si";

const MODELS = [
  { value: "nano_banana_2",                       label: "Nano Banana Pro" },
  { value: "gpt_image_2",                         label: "GPT Image 2" },
  { value: "cinematic_studio_2_5",                label: "Cinematic Studio 2.5" },
  { value: "flux_2",                              label: "FLUX.2" },
  { value: "flux_kontext",                        label: "Flux Kontext" },
  { value: "flux-pro/kontext/max/text-to-image",  label: "FLUX Kontext Max" },
  { value: "grok_image",                          label: "Grok Image" },
  { value: "image_auto",                          label: "Image Auto" },
  { value: "kling_omni_image",                    label: "Kling O1 Image" },
  { value: "marketing_studio_image",              label: "Marketing Studio Image" },
  { value: "ms_image",                            label: "MS Image" },
  { value: "nano_banana",                         label: "Nano Banana" },
  { value: "nano_banana_flash",                   label: "Nano Banana 2" },
  { value: "openai_hazel",                        label: "OpenAI Hazel" },
  { value: "reve/text-to-image",                  label: "Reve" },
  { value: "seedream_v4_5",                       label: "Seedream 4.5" },
  { value: "seedream_v5_lite",                    label: "Seedream V5 Lite" },
  { value: "soul_cinematic",                      label: "Soul Cinematic" },
  { value: "soul_location",                       label: "Soul Location" },
  { value: "text2image_soul_v2",                  label: "Soul V2" },
  { value: "z_image",                             label: "Z Image" },
];

const ASPECT_RATIOS = ["1:1", "9:16", "4:3", "3:4"] as const;
type AspectRatio = typeof ASPECT_RATIOS[number];

const QUICK_STYLES = ["Studio Shot", "Lifestyle", "Editorial", "Flat Lay", "Outdoor"];

type ImageSourceTab = "url" | "upload" | "shopify" | "aws";

interface GeneratedImage {
  aspectRatio: string;
  url: string;
}

export default function ImageStudio() {
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("flux-pro/kontext/max/text-to-image");
  const [selectedRatios, setSelectedRatios] = useState<AspectRatio[]>(["1:1"]);
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [imageSourceTab, setImageSourceTab] = useState<ImageSourceTab>("url");
  const [urlInput, setUrlInput] = useState("");
  const [isShopifyOpen, setIsShopifyOpen] = useState(false);
  const [isAwsOpen, setIsAwsOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: templates = [] } = useQuery<ImageTemplate[]>({
    queryKey: ["/api/image-templates"],
  });

  const generateMutation = useMutation({
    mutationFn: (body: { prompt: string; model: string; aspectRatios: string[]; referenceImageUrls: string[] }) =>
      apiRequest("POST", "/api/image-studio/generate", body).then((r) => r.json()),
    onSuccess: (data: { images: GeneratedImage[] }) => {
      setGeneratedImages(data.images);
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const toggleRatio = (ratio: AspectRatio) => {
    setSelectedRatios((prev) =>
      prev.includes(ratio) ? (prev.length > 1 ? prev.filter((r) => r !== ratio) : prev) : [...prev, ratio]
    );
  };

  const appendStyle = (style: string) => {
    setPrompt((p) => (p.trim() ? `${p.trim()}, ${style}` : style));
  };

  const addReferenceUrl = (url: string) => {
    if (url && !referenceUrls.includes(url)) {
      setReferenceUrls((prev) => [...prev, url]);
    }
  };

  const removeReferenceUrl = (i: number) => {
    setReferenceUrls((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleUrlAdd = () => {
    if (urlInput.trim()) {
      addReferenceUrl(urlInput.trim());
      setUrlInput("");
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      addReferenceUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({ title: "Please enter a prompt", variant: "destructive" });
      return;
    }
    // Spec: 1:1 must be primary if selected; otherwise keep selection order
    const orderedRatios = selectedRatios.includes("1:1")
      ? ["1:1", ...selectedRatios.filter((r) => r !== "1:1")]
      : [...selectedRatios];
    generateMutation.mutate({
      prompt: prompt.trim(),
      model,
      aspectRatios: orderedRatios,
      referenceImageUrls: referenceUrls,
    });
  };

  const handleSaveToCloudinary = async (url: string, index: number) => {
    setSavingIndex(index);
    try {
      const res = await apiRequest("POST", "/api/image-studio/save-to-cloudinary", { url });
      const data = await res.json();
      toast({ title: "Saved to Cloudinary", description: data.url });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingIndex(null);
    }
  };

  const handleDownload = (url: string, aspectRatio: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated-${aspectRatio.replace(":", "x")}-${Date.now()}.jpg`;
    a.target = "_blank";
    a.click();
  };

  const applyTemplate = (t: ImageTemplate) => {
    setPrompt(t.prompt);
    setModel(t.model);
    if (t.referenceImageUrls?.length) setReferenceUrls(t.referenceImageUrls);
    setIsTemplatePickerOpen(false);
    toast({ title: `Template "${t.name}" applied` });
  };

  return (
    <div className="space-y-6">
      <div className="wt-page-header">
        <h1 className="wt-page-title">Image Studio</h1>
        <p className="text-muted-foreground">Generate AI images with Higgsfield across multiple aspect ratios.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-5">
          {/* Template picker */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsTemplatePickerOpen(true)}>
              Use Template
            </Button>
          </div>

          {/* Prompt */}
          <div>
            <Label>Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              rows={4}
              className="mt-1"
            />
          </div>

          {/* Quick styles */}
          <div>
            <Label className="text-xs text-muted-foreground">Quick Styles</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {QUICK_STYLES.map((style) => (
                <button
                  key={style}
                  onClick={() => appendStyle(style)}
                  className="px-3 py-1 text-xs border border-black hover:bg-black hover:text-white transition-colors"
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div>
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aspect ratios */}
          <div>
            <Label>Aspect Ratios</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => toggleRatio(ratio)}
                  className={`px-4 py-2 text-sm border transition-colors ${
                    selectedRatios.includes(ratio)
                      ? "border-black bg-black text-white"
                      : "border-black hover:bg-gray-100"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
            {selectedRatios.length > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                Primary ratio: {selectedRatios[0]} — others will be generated via expand.
              </p>
            )}
          </div>

          {/* Reference images */}
          <div>
            <Label>Reference Images (optional)</Label>
            <div className="mt-2 space-y-3">
              {/* Source tabs */}
              <div className="flex gap-1 border border-black p-0.5 w-fit">
                {(["url", "upload", "shopify", "aws"] as ImageSourceTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setImageSourceTab(tab)}
                    className={`px-3 py-1 text-xs transition-colors ${
                      imageSourceTab === tab ? "bg-black text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    {tab === "url" ? "URL" : tab === "upload" ? "Upload" : tab === "shopify" ? "Shopify" : "AWS Render"}
                  </button>
                ))}
              </div>

              {imageSourceTab === "url" && (
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://..."
                    onKeyDown={(e) => e.key === "Enter" && handleUrlAdd()}
                  />
                  <Button size="sm" variant="outline" onClick={handleUrlAdd}>Add</Button>
                </div>
              )}

              {imageSourceTab === "upload" && (
                <div
                  className="border-2 border-dashed border-black p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
                >
                  <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-muted-foreground">Drop image here or click to upload</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                </div>
              )}

              {imageSourceTab === "shopify" && (
                <Button variant="outline" onClick={() => setIsShopifyOpen(true)}>
                  <SiShopifyIcon size={14} className="mr-2" />
                  Browse Shopify Images
                </Button>
              )}

              {imageSourceTab === "aws" && (
                <Button variant="outline" onClick={() => setIsAwsOpen(true)}>
                  <Package size={14} className="mr-2" />
                  Pick Product Render
                </Button>
              )}

              {/* Reference URL list */}
              {referenceUrls.length > 0 && (
                <div className="space-y-2">
                  {referenceUrls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#f0ebe7] border border-black p-2">
                      <img src={url} alt={`ref-${i}`} className="w-10 h-10 object-cover border border-gray-300 flex-shrink-0" />
                      <span className="text-xs flex-1 truncate text-muted-foreground">{url.substring(0, 60)}...</span>
                      <button onClick={() => removeReferenceUrl(i)} className="text-gray-400 hover:text-black">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !prompt.trim()}
            className="w-full"
            size="lg"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Images"
            )}
          </Button>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          <Label>Results</Label>

          {generateMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-black">
              <Loader2 size={32} className="animate-spin text-gray-400 mb-3" />
              <p className="text-sm text-muted-foreground">Generating {selectedRatios.length} image{selectedRatios.length > 1 ? "s" : ""}...</p>
              <p className="text-xs text-muted-foreground mt-1">This may take a minute</p>
            </div>
          )}

          {!generateMutation.isPending && generatedImages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-300">
              <Image size={32} className="text-gray-300 mb-3" />
              <p className="text-sm text-muted-foreground">Generated images will appear here</p>
            </div>
          )}

          {generatedImages.map((img, i) => (
            <div key={i} className="border border-black bg-[#f0ebe7]">
              <div className="px-3 py-2 border-b border-black flex items-center justify-between">
                <span className="text-sm font-medium">{img.aspectRatio}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(img.url, img.aspectRatio)}
                    className="text-xs"
                  >
                    <Download size={12} className="mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveToCloudinary(img.url, i)}
                    disabled={savingIndex === i}
                    className="text-xs"
                  >
                    {savingIndex === i ? (
                      <Loader2 size={12} className="mr-1 animate-spin" />
                    ) : (
                      <CloudUpload size={12} className="mr-1" />
                    )}
                    Save to Cloudinary
                  </Button>
                </div>
              </div>
              <div className="p-2">
                <img
                  src={img.url}
                  alt={`Generated ${img.aspectRatio}`}
                  className="w-full object-contain max-h-80"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shopify Picker */}
      <ShopifyResourcePicker
        isOpen={isShopifyOpen}
        onClose={() => setIsShopifyOpen(false)}
        allowedTabs={["images", "products"]}
        title="Pick Shopify Image"
        onSelect={(resource) => {
          if (resource.type === "image") addReferenceUrl(resource.url);
          else if (resource.type === "product" && resource.imageUrl) addReferenceUrl(resource.imageUrl);
        }}
      />

      {/* AWS Product Render Picker */}
      <WTProductRenderPicker
        isOpen={isAwsOpen}
        onClose={() => setIsAwsOpen(false)}
        onConfirm={addReferenceUrl}
      />

      {/* Template Picker */}
      <Dialog open={isTemplatePickerOpen} onOpenChange={(open) => !open && setIsTemplatePickerOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select a Template</DialogTitle>
          </DialogHeader>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No templates saved yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="text-left border border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow bg-[#f0ebe7]"
                >
                  {t.thumbnailUrl ? (
                    <img src={t.thumbnailUrl} alt={t.name} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
                      <Image size={24} className="text-gray-400" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.prompt}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
