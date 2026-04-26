import React, { useState, type ReactNode } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useImproveContent, useRefineContent } from "@/lib/ai";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GripVertical, Trash2, Wand2, Edit3, Plus, X, Bookmark, ShoppingBag, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentBlock as ContentBlockType } from "@shared/schema";
import { CloudinaryAssetSelector } from "@/components/CloudinaryAssetSelector";
import { ShopifyResourcePicker } from "@/components/ShopifyResourcePicker";
import type { ShopifyResource } from "@/components/ShopifyResourcePicker";
import { FontPicker } from "@/components/content/FontPicker";
import { RichTextEditor } from "@/components/content/RichTextEditor";

// ── Shopify preview data types ────────────────────────────────────────────────
interface ShopifyVariantPreview {
  id: string;
  title: string;
  available: boolean;
  options?: Array<{ name: string; value: string }>;
}
interface ShopifyProductPreview {
  id: string;
  title: string;
  handle: string;
  description?: string;
  price: string;
  currencyCode: string;
  imageUrl?: string;
  imageAlt?: string;
  variants: ShopifyVariantPreview[];
}
interface ShopifyCollectionPreview {
  id: string;
  title: string;
  handle: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  products: Array<{
    id: string;
    title: string;
    handle: string;
    price: string;
    currencyCode: string;
    imageUrl?: string;
  }>;
}

// Type guards for narrowing Shopify preview union
function isProductPreview(d: ShopifyProductPreview | ShopifyCollectionPreview | null): d is ShopifyProductPreview {
  return d !== null && "variants" in d;
}
function isCollectionPreview(d: ShopifyProductPreview | ShopifyCollectionPreview | null): d is ShopifyCollectionPreview {
  return d !== null && "products" in d;
}

// ── App Block registry types ───────────────────────────────────────────────────
interface ComponentSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  default?: string;
  enum?: string[];
}
interface ComponentConfig {
  name: string;
  label: string;
  description: string;
  assetUrl: string;
  schema: {
    type: "object";
    properties: Record<string, ComponentSchemaProperty>;
    required?: string[];
  };
}

// ── AppBlockEditor ─────────────────────────────────────────────────────────────
function AppBlockEditor({ safeContent, onUpdate }: { safeContent: any; onUpdate: (c: any) => void }) {
  const { data: components = [] } = useQuery<ComponentConfig[]>({
    queryKey: ["/api/components"],
    staleTime: 5 * 60 * 1000,
  });

  const selectedName: string = safeContent?.componentName || "";
  const currentComponent = components.find((c) => c.name === selectedName);

  const handleComponentChange = (name: string) => {
    const comp = components.find((c) => c.name === name);
    if (!comp) return;
    const defaults: Record<string, string> = {};
    for (const [k, v] of Object.entries(comp.schema.properties)) {
      defaults[k] = v.default ?? "";
    }
    onUpdate({ componentName: comp.name, config: defaults });
  };

  const handleConfigChange = (key: string, value: string) => {
    onUpdate({ ...safeContent, config: { ...(safeContent?.config || {}), [key]: value } });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium">Component</Label>
        <Select value={selectedName} onValueChange={handleComponentChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a component…" />
          </SelectTrigger>
          <SelectContent>
            {components.map((comp) => (
              <SelectItem key={comp.name} value={comp.name}>
                {comp.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentComponent && (
          <p className="text-xs text-muted-foreground">{currentComponent.description}</p>
        )}
      </div>

      {currentComponent && Object.entries(currentComponent.schema.properties).map(([key, prop]) => {
        const value = safeContent?.config?.[key] ?? prop.default ?? "";
        return (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{prop.title || key}</Label>
            {prop.enum ? (
              <Select value={value} onValueChange={(v) => handleConfigChange(key, v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {prop.enum.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={value}
                onChange={(e) => handleConfigChange(key, e.target.value)}
                placeholder={prop.description || prop.title || key}
                className="text-sm"
              />
            )}
            {prop.description && !prop.enum && (
              <p className="text-xs text-muted-foreground">{prop.description}</p>
            )}
          </div>
        );
      })}

      {!selectedName && (
        <p className="text-xs text-muted-foreground italic">Select a component above to configure it.</p>
      )}

      {selectedName && (
        <div className="p-2 bg-muted/30 border rounded text-xs font-mono break-all text-muted-foreground">
          data-wt-component="{selectedName}"
        </div>
      )}
    </div>
  );
}

export type BlockState = "ai_generated" | "needs_input" | "manual" | null;

export interface ImageSuggestion {
  url: string;
  displayName: string;
  source: string;
  publicId?: string;
  folder?: string | null;
}

interface ContentBlockProps {
  block: any;
  onChange?: (blockId: string, content: any) => void;
  onBlockUpdate?: (blockId: string, patch: Record<string, any>) => void;
  onDelete?: (blockId: string) => void;
  onSaveAsPreset?: (block: any) => void;
  contentItemId?: number;
  onImageSelect?: (blockId: string) => void;
  blockState?: BlockState;
  onStateChange?: (state: BlockState) => void;
  activeMood?: string;
  siblingContext?: Record<string, string>;
  contentDescription?: string;
  templateType?: string;
  imageSuggestion?: ImageSuggestion;
  onAcceptSuggestion?: (blockId: string, url: string, displayName: string) => void;
}

export function ContentBlock({
  block,
  onChange,
  onBlockUpdate,
  onDelete,
  onSaveAsPreset,
  contentItemId,
  onImageSelect,
  blockState,
  onStateChange,
  activeMood,
  siblingContext,
  contentDescription,
  templateType,
  imageSuggestion,
  onAcceptSuggestion,
}: ContentBlockProps): React.ReactElement {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState(() => {
    // Clean content extraction to avoid prototype pollution
    if (typeof block.content === 'object' && block.content !== null) {
      // Create a clean object with only own properties
      const cleanContent: any = {};
      Object.keys(block.content).forEach(key => {
        if (block.content.hasOwnProperty(key)) {
          cleanContent[key] = block.content[key];
        }
      });
      return cleanContent;
    }
    return block.content || {};
  });
  const [feedback, setFeedback] = useState("");
  const [showRefineDialog, setShowRefineDialog] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<string | null>(null);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [blockBg, setBlockBg] = useState<{ color?: string; imageUrl?: string; imageSize?: 'cover' | 'contain'; fallbackColor?: string; paddingTop?: number; paddingRight?: number; paddingBottom?: number; paddingLeft?: number }>(() => block._bg || {});
  const improveContent = useImproveContent();
  const refineContent = useRefineContent();

  // Check if Shopify is configured — reads from integrations table (DB-backed) with env var fallback
  const { data: shopifyStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/integrations/shopify-status"],
    staleTime: 60_000,
  });
  const shopifyConfigured = shopifyStatus?.configured !== false;

  // Shopify live preview state (for Shopify block types)
  const [shopifyData, setShopifyData] = useState<ShopifyProductPreview | ShopifyCollectionPreview | null>(null);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyError, setShopifyError] = useState<string | null>(null);

  const fetchShopifyProduct = async (productId: string) => {
    if (!productId?.trim()) return;
    setShopifyLoading(true); setShopifyError(null); setShopifyData(null);
    try {
      const res = await apiRequest("GET", `/api/shopify/product/${encodeURIComponent(productId.trim())}`);
      if (!res.ok) { const t = await res.text(); throw new Error(t || `HTTP ${res.status}`); }
      setShopifyData(await res.json());
    } catch (err) { setShopifyError((err as Error).message); }
    finally { setShopifyLoading(false); }
  };

  const fetchShopifyCollection = async (collectionId: string, count?: number) => {
    if (!collectionId?.trim()) return;
    setShopifyLoading(true); setShopifyError(null); setShopifyData(null);
    try {
      const countParam = count ? `?count=${Math.min(count, 24)}` : "";
      const res = await apiRequest("GET", `/api/shopify/collection/${encodeURIComponent(collectionId.trim())}${countParam}`);
      if (!res.ok) { const t = await res.text(); throw new Error(t || `HTTP ${res.status}`); }
      setShopifyData(await res.json());
    } catch (err) { setShopifyError((err as Error).message); }
    finally { setShopifyLoading(false); }
  };

  // Update block-level _bg field
  const handleBgUpdate = (patch: Partial<typeof blockBg>) => {
    const newBg = { ...blockBg, ...patch };
    setBlockBg(newBg);
    if (onBlockUpdate) {
      onBlockUpdate(block.id, { _bg: newBg });
    }
  };

  // Update block using local callback if provided, otherwise use API
  const handleUpdate = (newContent: any) => {
    setContent(newContent);
    if (onChange) {
      onChange(block.id, newContent);
    } else if (contentItemId) {
      updateMutation.mutate(newContent);
    }
  };

  // Delete block using local callback if provided, otherwise use API
  const handleDelete = () => {
    if (onDelete) {
      onDelete(block.id);
    } else if (contentItemId) {
      deleteMutation.mutate();
    }
  };

  // Update block mutation (for database operations)
  const updateMutation = useMutation({
    mutationFn: async (newContent: any) => {
      const response = await apiRequest("PUT", `/api/content-blocks/${block.id}`, {
        content: newContent,
      });
      return response.json();
    },
    onSuccess: () => {
      if (contentItemId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/content-items", contentItemId, "blocks"]
        });
      }
    },
  });

  // Delete block mutation (for database operations)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/content-blocks/${block.id}`);
    },
    onSuccess: () => {
      if (contentItemId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/content-items", contentItemId, "blocks"]
        });
      }
      toast({
        title: "Success",
        description: "Content block deleted",
      });
    },
  });

  const handleContentChange = (field: string, value: any) => {
    console.log(`🔧 handleContentChange: ${field} =`, value);
    console.log('🔧 Current content before update:', content);

    // Ensure we always work with clean objects without prototype pollution
    const safeContent = content && typeof content === 'object' ?
      JSON.parse(JSON.stringify(content)) : {};

    const newContent = { ...safeContent, [field]: value };
    console.log('🔧 New content after update:', newContent);

    setContent(newContent); // Update local state immediately
    handleUpdate(newContent);
  };

  const handleImproveContent = async () => {
    try {
      const textToImprove = typeof content === 'object' && content !== null
        ? Object.values(content).join(' ')
        : String(content);

      const result = await improveContent.mutateAsync({
        content: textToImprove,
        sectionType: block.type,
      });

      const improvedContent = typeof content === 'object' && content !== null ? { ...content } : { text: result.content };
      if (block.type === 'text' || block.type === 'heading') {
        improvedContent.text = result.content;
      }

      handleUpdate(improvedContent);

      toast({
        title: "Success",
        description: "Your content has been enhanced",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to improve content",
        variant: "destructive",
      });
    }
  };

  const handleRefineContent = async () => {
    try {
      const textToRefine = typeof content === 'object' && content !== null
        ? Object.values(content).join(' ')
        : String(content);

      const result = await refineContent.mutateAsync({
        content: textToRefine,
        feedback: feedback,
      });

      const refinedContent = typeof content === 'object' && content !== null ? { ...content } : { text: result.content };
      if (block.type === 'text' || block.type === 'heading') {
        refinedContent.text = result.content;
      }

      handleUpdate(refinedContent);
      setShowRefineDialog(false);
      setFeedback("");

      toast({
        title: "Success",
        description: "Your content has been refined",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refine content",
        variant: "destructive",
      });
    }
  };

  const handleUserEdit = () => {
    if (blockState === "ai_generated") {
      onStateChange?.("manual");
    }
  };

  const generateBlock = async () => {
    setIsGenerating(true);
    try {
      const response = await apiRequest("POST", "/api/ai/generate-block", {
        block_id: block.id || block.type + "_" + Date.now(),
        block_type: block.type,
        block_notes: block.notes || "",
        mood: activeMood || "conversational",
        description: contentDescription || "",
        template_type: templateType || "email",
        sibling_context: siblingContext || {},
      });

      const data = await response.json();
      if (data.success && data.content) {
        // Find which field to update based on block type
        let fieldToUpdate = "text";
        if (block.type === "heading") fieldToUpdate = "text";
        else if (block.type === "paragraph") fieldToUpdate = "text";
        else if (block.type === "quote") fieldToUpdate = "text";
        else if (block.type === "cta") fieldToUpdate = "text";

        // Handle case where content might be just a string
        const updatedContent = typeof content === "object" && content !== null
          ? { ...content, [fieldToUpdate]: data.content }
          : { [fieldToUpdate]: data.content };

        handleUpdate(updatedContent);
        onStateChange?.("ai_generated");
        toast({
          title: "Success",
          description: "Content generated successfully",
        });
      }
    } catch (err) {
      console.error("Block generation error:", err);
      toast({
        title: "Error",
        description: "Failed to generate block content",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const renderBlockEditor = () => {
    // Clean content extraction to avoid prototype pollution
    let safeContent: any = {};
    if (content && typeof content === 'object') {
      Object.keys(content).forEach(key => {
        if (content.hasOwnProperty(key)) {
          safeContent[key] = content[key];
        }
      });
    } else {
      safeContent = content;
    }

    console.log(`🔍 Rendering ${block.type} block:`, block);
    console.log(`🔍 Raw content:`, content);
    console.log(`🔍 Safe content:`, safeContent);
    console.log(`🔍 Content type:`, typeof content);
    console.log(`🔍 Content keys:`, content ? Object.keys(content) : 'no content');

    const onUpdate = (newBlockContent: any) => {
      setContent(newBlockContent);
      handleUpdate(newBlockContent);
    };

    // Shared style fields for all text-bearing blocks — compact icon toolbar
    const renderTextStyleFields = (c: any, update: (c: any) => void, blockType = 'text') => {
      const o = typeof c === 'string' ? { text: c } : (c || {});
      const isHeading = blockType === 'heading';

      const Btn = ({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
        <button
          type="button"
          title={title}
          onClick={onClick}
          className={cn(
            "h-7 w-7 flex items-center justify-center border border-gray-300 transition-colors shrink-0",
            active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 hover:bg-gray-100"
          )}
        >
          {children}
        </button>
      );

      return (
        <div className="space-y-2 pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Text Styling</p>

          {/* Colors row — not shown for banner, which manages colours inline per-style */}
          {blockType !== 'banner' && (
            <div className="flex gap-2">
              <div className="flex gap-1 items-center flex-1 min-w-0">
                <input
                  type="color"
                  value={o.textColor || '#1a1a1a'}
                  onChange={(e) => update({ ...o, textColor: e.target.value })}
                  title="Text color"
                  className="h-7 w-7 cursor-pointer border border-gray-300 p-0.5 shrink-0"
                />
                <Input
                  value={o.textColor || ''}
                  onChange={(e) => update({ ...o, textColor: e.target.value })}
                  placeholder="Text color"
                  className="h-7 text-xs min-w-0"
                />
              </div>
              <div className="flex gap-1 items-center flex-1 min-w-0">
                <input
                  type="color"
                  value={o.backgroundColor || '#ffffff'}
                  onChange={(e) => update({ ...o, backgroundColor: e.target.value })}
                  title="Background color"
                  className="h-7 w-7 cursor-pointer border border-gray-300 p-0.5 shrink-0"
                />
                <Input
                  value={o.backgroundColor || ''}
                  onChange={(e) => update({ ...o, backgroundColor: e.target.value })}
                  placeholder="BG color"
                  className="h-7 text-xs min-w-0"
                />
              </div>
            </div>
          )}

          {/* Font family — not shown for banner (renderer hardcodes the font) */}
          {blockType !== 'banner' && (
            <FontPicker
              value={o.fontFamily}
              onChange={(css) => update({ ...o, fontFamily: css })}
            />
          )}

          {/* Size + icon toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(() => {
              const PRESET_SIZES = ['sm','md','lg','xl','2xl','3xl','4xl'];
              const PRESET_LABELS: Record<string,string> = { sm:'12px', md:'14px', lg:'16px', xl:'20px', '2xl':'24px', '3xl':'32px', '4xl':'40px' };
              const currentSize = o.fontSize || (isHeading ? '4xl' : 'md');
              const isCustom = !!currentSize && !PRESET_SIZES.includes(currentSize);
              return (
                <>
                  <Select
                    value={isCustom ? '__custom__' : currentSize}
                    onValueChange={(v) => {
                      if (v === '__custom__') update({ ...o, fontSize: isCustom ? currentSize : '10' });
                      else update({ ...o, fontSize: v });
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs w-24 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRESET_SIZES.map((v) => (
                        <SelectItem key={v} value={v} className="text-xs">{v} — {PRESET_LABELS[v]}</SelectItem>
                      ))}
                      <SelectItem value="__custom__" className="text-xs">Custom…</SelectItem>
                    </SelectContent>
                  </Select>
                  {isCustom && (
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        min={6}
                        max={120}
                        value={parseFloat(String(currentSize).replace(/px$/i,'')) || ''}
                        onChange={(e) => {
                          const n = parseFloat(e.target.value);
                          if (!isNaN(n) && n >= 1) update({ ...o, fontSize: String(n) });
                        }}
                        className="h-7 w-14 rounded border border-input bg-background px-1.5 text-xs text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-xs text-muted-foreground">px</span>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="w-px h-5 bg-gray-300 shrink-0" />

            {/* Font weight select */}
            <Select
              value={(() => { const w = o.fontWeight; if (!w || w === 'normal') return '400'; if (w === 'bold') return '700'; return w; })()}
              onValueChange={(v) => update({ ...o, fontWeight: v })}
            >
              <SelectTrigger className="h-7 text-xs w-[90px] shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[['300','Light'],['400','Regular'],['500','Medium'],['600','SemiBold'],['700','Bold'],['800','ExtraBold']].map(([v,l]) => (
                  <SelectItem key={v} value={v} className="text-xs">{v} · {l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Btn active={o.fontStyle === 'italic'} onClick={() => update({ ...o, fontStyle: o.fontStyle === 'italic' ? 'normal' : 'italic' })} title="Italic">
              <Italic className="h-3.5 w-3.5" />
            </Btn>
            <Btn active={o.textDecoration === 'underline'} onClick={() => update({ ...o, textDecoration: o.textDecoration === 'underline' ? 'none' : 'underline' })} title="Underline">
              <Underline className="h-3.5 w-3.5" />
            </Btn>
            <Btn active={o.textDecoration === 'line-through'} onClick={() => update({ ...o, textDecoration: o.textDecoration === 'line-through' ? 'none' : 'line-through' })} title="Strikethrough">
              <Strikethrough className="h-3.5 w-3.5" />
            </Btn>

            <div className="w-px h-5 bg-gray-300 shrink-0" />

            <Btn active={!o.textAlign || o.textAlign === 'left'} onClick={() => update({ ...o, textAlign: 'left' })} title="Align left">
              <AlignLeft className="h-3.5 w-3.5" />
            </Btn>
            <Btn active={o.textAlign === 'center'} onClick={() => update({ ...o, textAlign: 'center' })} title="Align center">
              <AlignCenter className="h-3.5 w-3.5" />
            </Btn>
            <Btn active={o.textAlign === 'right'} onClick={() => update({ ...o, textAlign: 'right' })} title="Align right">
              <AlignRight className="h-3.5 w-3.5" />
            </Btn>

            <div className="w-px h-5 bg-gray-300 shrink-0" />

            <Btn active={!o.textTransform || o.textTransform === 'none'} onClick={() => update({ ...o, textTransform: 'none' })} title="Default casing">
              <span className="text-[10px]">Aa</span>
            </Btn>
            <Btn active={o.textTransform === 'uppercase'} onClick={() => update({ ...o, textTransform: 'uppercase' })} title="Uppercase">
              <span className="text-[10px] font-bold">AA</span>
            </Btn>
            <Btn active={o.textTransform === 'lowercase'} onClick={() => update({ ...o, textTransform: 'lowercase' })} title="Lowercase">
              <span className="text-[10px]">aa</span>
            </Btn>
            <Btn active={o.textTransform === 'capitalize'} onClick={() => update({ ...o, textTransform: 'capitalize' })} title="Capitalize words">
              <span className="text-[10px]">Tt</span>
            </Btn>

            <div className="w-px h-5 bg-gray-300 shrink-0" />

            {/* Opacity */}
            <div className="flex items-center gap-1.5 shrink-0" title="Opacity">
              <span className="text-[10px] text-gray-500 select-none">Opacity</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={o.opacity !== undefined ? o.opacity : 100}
                onChange={(e) => update({ ...o, opacity: Number(e.target.value) })}
                className="h-1.5 w-20 accent-gray-700"
              />
              <span className="text-[10px] text-gray-500 w-8 text-right tabular-nums">
                {o.opacity !== undefined ? o.opacity : 100}%
              </span>
            </div>
          </div>
        </div>
      );
    };

    switch (block.type) {
      case 'heading': {
        const o = typeof safeContent === 'string' ? { text: safeContent } : (safeContent || {});
        const initHtml = o.html || (o.text ? `<p>${o.text.replace(/\n/g, '<br>')}</p>` : '');
        return (
          <div className="space-y-2">
            <RichTextEditor
              value={initHtml}
              onChange={(html) => onUpdate({ ...o, html, text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() })}
              onFocus={handleUserEdit}
              placeholder="Enter heading text…"
              minHeight="40px"
              className="font-semibold text-lg"
            />
            {renderTextStyleFields(o, onUpdate, 'heading')}
          </div>
        );
      }

      case 'text':
      case 'paragraph': {
        const o = typeof safeContent === 'string' ? { text: safeContent } : (safeContent || {});
        const initHtml = o.html || (o.text ? o.text.split(/\n\n+/).map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('') : '');
        return (
          <div className="space-y-2">
            <RichTextEditor
              value={initHtml}
              onChange={(html) => onUpdate({ ...o, html, text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() })}
              onFocus={handleUserEdit}
              placeholder="Enter your text content…"
              minHeight="100px"
            />
            {renderTextStyleFields(o, onUpdate, 'text')}
            {/* Width control */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Width</p>
              <Select
                value={o.widthMode || 'full'}
                onValueChange={(v) => onUpdate({ ...o, widthMode: v })}
              >
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full width</SelectItem>
                  <SelectItem value="px">Custom px — inset box</SelectItem>
                  <SelectItem value="percent">Custom % — inset box</SelectItem>
                </SelectContent>
              </Select>
              {(o.widthMode === 'px' || o.widthMode === 'percent') && (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={o.widthMode === 'px' ? 552 : 100}
                      value={o.customWidth || ''}
                      onChange={(e) => onUpdate({ ...o, customWidth: parseInt(e.target.value) || undefined })}
                      placeholder={o.widthMode === 'px' ? 'e.g. 400' : 'e.g. 75'}
                      className="text-sm"
                    />
                    <span className="text-xs text-muted-foreground">{o.widthMode === 'px' ? 'px (max 552)' : '%'}</span>
                  </div>
                  <p className="text-xs text-gray-400">The text box floats inside the block. Set the outer band colour via "Block Background" below.</p>
                </>
              )}
            </div>

            {/* Link style */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Links</p>
              <div className="flex border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onUpdate({ ...o, linkStyle: 'underline' })}
                  className={`flex-1 py-1 text-xs transition-colors ${(!o.linkStyle || o.linkStyle === 'underline') ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >Underline</button>
                <button
                  type="button"
                  onClick={() => onUpdate({ ...o, linkStyle: 'button' })}
                  className={`flex-1 py-1 text-xs transition-colors ${o.linkStyle === 'button' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >Button</button>
              </div>
              {o.linkStyle === 'button' && (
                <div className="space-y-2">
                  {/* Corner radius stays separate — not part of text styling */}
                  <div className="space-y-1">
                    <Label className="text-xs">Corner Radius</Label>
                    <Select value={o.linkButtonRadius || 'sharp'} onValueChange={(v) => onUpdate({ ...o, linkButtonRadius: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sharp" className="text-xs">Sharp</SelectItem>
                        <SelectItem value="rounded" className="text-xs">Rounded (4px)</SelectItem>
                        <SelectItem value="pill" className="text-xs">Pill</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Full independent text + colour + font styling for the button */}
                  {renderTextStyleFields(
                    {
                      textColor:      o.linkButtonColor,
                      backgroundColor: o.linkButtonBg,
                      fontFamily:      o.linkButtonFontFamily,
                      fontSize:        o.linkButtonFontSize,
                      fontWeight:      o.linkButtonFontWeight,
                      fontStyle:       o.linkButtonFontStyle,
                      textDecoration:  o.linkButtonTextDecoration,
                      textAlign:       o.linkButtonTextAlign,
                      textTransform:   o.linkButtonTextTransform,
                      opacity:         o.linkButtonOpacity,
                    },
                    (updated) => onUpdate({
                      ...o,
                      linkButtonColor:         updated.textColor,
                      linkButtonBg:            updated.backgroundColor,
                      linkButtonFontFamily:    updated.fontFamily,
                      linkButtonFontSize:      updated.fontSize,
                      linkButtonFontWeight:    updated.fontWeight,
                      linkButtonFontStyle:     updated.fontStyle,
                      linkButtonTextDecoration: updated.textDecoration,
                      linkButtonTextAlign:     updated.textAlign,
                      linkButtonTextTransform: updated.textTransform,
                      linkButtonOpacity:       updated.opacity,
                    }),
                    'text'
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'image':
        return (
          <div className="space-y-3">
            {/* Suggested image (shown when there's a suggestion but no confirmed URL) */}
            {imageSuggestion && !(safeContent as any)?.url && (
              <div className="border border-black bg-[#f0ebe7] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="relative">
                  <img
                    src={imageSuggestion.url}
                    alt={imageSuggestion.displayName}
                    className="w-full h-40 object-cover opacity-80"
                  />
                  <span className="absolute top-2 left-2 text-[10px] bg-black text-white px-2 py-0.5 font-mono uppercase tracking-wide">
                    Suggested
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="text-xs text-muted-foreground truncate flex-1">{imageSuggestion.displayName}</p>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-black"
                      onClick={() => onImageSelect?.(block.id)}
                    >
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-black text-white hover:bg-gray-800"
                      onClick={() => {
                        onAcceptSuggestion?.(block.id, imageSuggestion.url, imageSuggestion.displayName);
                        onUpdate({ ...(safeContent as any), url: imageSuggestion.url, alt: imageSuggestion.displayName });
                      }}
                    >
                      Use this image
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {/* Confirmed image preview */}
            {(safeContent as any)?.url ? (
              <div className="relative">
                <img
                  src={(safeContent as any).url}
                  alt={(safeContent as any)?.alt || "Content image"}
                  className="w-full h-40 object-cover"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => onImageSelect?.(block.id)}
                >
                  Change
                </Button>
              </div>
            ) : null}
            {/* URL input + browse button */}
            <div className="flex gap-2">
              <Input
                value={(safeContent as any)?.url || ''}
                onChange={(e) => onUpdate({ ...(safeContent as any), url: e.target.value })}
                placeholder="Image URL (paste or select below)"
                className="text-sm flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => onImageSelect?.(block.id)}
              >
                Browse
              </Button>
            </div>
            <Input
              value={(safeContent as any)?.alt || ''}
              onChange={(e) => onUpdate({ ...(safeContent as any), alt: e.target.value })}
              placeholder="Alt text"
              className="text-sm"
            />
            <Input
              value={(safeContent as any)?.caption || ''}
              onChange={(e) => onUpdate({ ...(safeContent as any), caption: e.target.value })}
              placeholder="Caption (optional)"
            />
            {/* Width control */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Width</Label>
              <Select
                value={(safeContent as any)?.widthMode || 'full'}
                onValueChange={(v) => onUpdate({ ...(safeContent as any), widthMode: v })}
              >
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full width (552px)</SelectItem>
                  <SelectItem value="px">Custom px</SelectItem>
                  <SelectItem value="percent">Custom %</SelectItem>
                </SelectContent>
              </Select>
              {((safeContent as any)?.widthMode === 'px' || (safeContent as any)?.widthMode === 'percent') && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={(safeContent as any)?.widthMode === 'px' ? 552 : 100}
                    value={(safeContent as any)?.customWidth || ''}
                    onChange={(e) => onUpdate({ ...(safeContent as any), customWidth: parseInt(e.target.value) || undefined })}
                    placeholder={(safeContent as any)?.widthMode === 'px' ? 'e.g. 300' : 'e.g. 50'}
                    className="text-sm"
                  />
                  <span className="text-xs text-muted-foreground">{(safeContent as any)?.widthMode === 'px' ? 'px (max 552)' : '%'}</span>
                </div>
              )}
            </div>
            {/* Height control */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Height</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={1200}
                  value={(safeContent as any)?.customHeight || ''}
                  onChange={(e) => onUpdate({ ...(safeContent as any), customHeight: parseInt(e.target.value) || undefined })}
                  placeholder="Auto"
                  className="text-sm"
                />
                <span className="text-xs text-muted-foreground">px (leave blank for auto)</span>
              </div>
            </div>
            {/* Alignment control */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Alignment</Label>
              <Select
                value={(safeContent as any)?.align || 'center'}
                onValueChange={(v) => onUpdate({ ...(safeContent as any), align: v })}
              >
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'quote': {
        const o = typeof safeContent === 'string' ? { text: safeContent } : (safeContent || {});
        const initHtml = o.html || (o.text ? `<p>${o.text.replace(/\n/g, '<br>')}</p>` : '');
        return (
          <div className="space-y-2">
            <RichTextEditor
              value={initHtml}
              onChange={(html) => onUpdate({ ...o, html, text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() })}
              onFocus={handleUserEdit}
              placeholder="Enter quote text…"
              minHeight="80px"
            />
            <Input
              value={o.author || o.attribution || ''}
              onChange={(e) => onUpdate({ ...o, author: e.target.value })}
              onFocus={handleUserEdit}
              placeholder="Quote author..."
              className="text-sm"
            />
            {renderTextStyleFields(o, onUpdate, 'quote')}
          </div>
        );
      }

      case 'list': {
        const items = Array.isArray(safeContent) ? safeContent : (safeContent?.items || []);
        const listStyle = safeContent?.style || 'bullet';
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">List Style</Label>
              <Select
                value={listStyle}
                onValueChange={(val) => onUpdate({ ...safeContent, style: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bullet">Bullet (•)</SelectItem>
                  <SelectItem value="numbered">Numbered (1.)</SelectItem>
                  <SelectItem value="check">Check (✓)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Items</Label>
              {items.map((item: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={typeof item === 'string' ? item : String(item)}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[index] = e.target.value;
                      onUpdate({ ...safeContent, items: newItems });
                    }}
                    placeholder={`List item ${index + 1}...`}
                  />
                  <Button
                    onClick={() => {
                      const newItems = items.filter((_: any, i: number) => i !== index);
                      onUpdate({ ...safeContent, items: newItems });
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => {
                  const newItems = [...items, ''];
                  onUpdate({ ...safeContent, items: newItems });
                }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </div>
            {renderTextStyleFields(safeContent, onUpdate, 'list')}
          </div>
        );
      }

      case 'cta': {
        const o = typeof safeContent === 'string' ? { text: safeContent } : (safeContent || {});
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Button Label</Label>
              <Input
                value={o.text || ''}
                onChange={(e) => onUpdate({ ...o, text: e.target.value })}
                onFocus={handleUserEdit}
                placeholder="Call-to-action text…"
                className="font-medium"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body Text</Label>
                <div className="flex border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...o, bodyTextPosition: 'above' })}
                    className={`px-2 py-0.5 text-xs transition-colors ${(!o.bodyTextPosition || o.bodyTextPosition === 'above') ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                  >Above</button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...o, bodyTextPosition: 'below' })}
                    className={`px-2 py-0.5 text-xs transition-colors ${o.bodyTextPosition === 'below' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                  >Below</button>
                </div>
              </div>
              <Textarea
                value={o.bodyText || ''}
                onChange={(e) => onUpdate({ ...o, bodyText: e.target.value })}
                placeholder="Optional paragraph…"
                className="min-h-[60px] resize-none text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link URL</Label>
              <Input
                value={o.link || ''}
                onChange={(e) => onUpdate({ ...o, link: e.target.value })}
                onFocus={handleUserEdit}
                placeholder="https://…"
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Button Style</Label>
                <Select value={o.buttonStyle || 'filled'} onValueChange={(v) => onUpdate({ ...o, buttonStyle: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filled" className="text-xs">Filled</SelectItem>
                    <SelectItem value="outline" className="text-xs">Outline</SelectItem>
                    <SelectItem value="ghost" className="text-xs">Ghost (link)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Corner Radius</Label>
                <Select value={o.borderRadius || 'rounded'} onValueChange={(v) => onUpdate({ ...o, borderRadius: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sharp" className="text-xs">Sharp</SelectItem>
                    <SelectItem value="rounded" className="text-xs">Rounded</SelectItem>
                    <SelectItem value="pill" className="text-xs">Pill</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Size</Label>
                <Select value={o.buttonSize || 'md'} onValueChange={(v) => onUpdate({ ...o, buttonSize: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm" className="text-xs">Small</SelectItem>
                    <SelectItem value="md" className="text-xs">Medium</SelectItem>
                    <SelectItem value="lg" className="text-xs">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex flex-col justify-end">
                <Label className="text-xs">Drop Shadow</Label>
                <div className="flex items-center gap-2 h-8">
                  <input
                    type="checkbox"
                    checked={!!o.dropShadow}
                    onChange={(e) => onUpdate({ ...o, dropShadow: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-gray-600">Enable shadow</span>
                </div>
              </div>
              <div className="space-y-1 flex flex-col justify-end col-span-2">
                <Label className="text-xs">Dotted Border</Label>
                <div className="flex items-center gap-2 h-8">
                  <input
                    type="checkbox"
                    checked={!!o.dottedBorder}
                    onChange={(e) => onUpdate({ ...o, dottedBorder: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-gray-600">Show ring outside button</span>
                  {o.dottedBorder && (
                    <>
                      <input
                        type="color"
                        value={o.dottedBorderColor || o.buttonColor || '#f15822'}
                        onChange={(e) => onUpdate({ ...o, dottedBorderColor: e.target.value })}
                        className="h-7 w-7 cursor-pointer border border-gray-300 p-0.5 shrink-0 ml-2"
                        title="Dotted border color"
                      />
                      <Input
                        value={o.dottedBorderColor || ''}
                        onChange={(e) => onUpdate({ ...o, dottedBorderColor: e.target.value })}
                        placeholder={o.buttonColor || '#f15822'}
                        className="h-7 text-xs w-24"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Button Color</Label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="color"
                    value={o.buttonColor || '#f15822'}
                    onChange={(e) => onUpdate({ ...o, buttonColor: e.target.value })}
                    className="h-8 w-8 cursor-pointer rounded border p-0.5 shrink-0"
                  />
                  <Input
                    value={o.buttonColor || ''}
                    onChange={(e) => onUpdate({ ...o, buttonColor: e.target.value })}
                    placeholder="#f15822"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Button Text Color</Label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="color"
                    value={o.buttonTextColor || '#ffffff'}
                    onChange={(e) => onUpdate({ ...o, buttonTextColor: e.target.value })}
                    className="h-8 w-8 cursor-pointer rounded border p-0.5 shrink-0"
                  />
                  <Input
                    value={o.buttonTextColor || ''}
                    onChange={(e) => onUpdate({ ...o, buttonTextColor: e.target.value })}
                    placeholder="#ffffff"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
            {renderTextStyleFields(o, onUpdate, 'cta')}
          </div>
        );
      }

      case 'divider':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Style</Label>
              <Select
                value={safeContent?.style || 'line'}
                onValueChange={(val) => onUpdate({ ...safeContent, style: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">Line — horizontal rule</SelectItem>
                  <SelectItem value="space">Space — blank gap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {safeContent?.style === 'space' ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Height (px)</Label>
                <Input
                  type="number"
                  value={safeContent?.height || 24}
                  onChange={(e) => onUpdate({ ...safeContent, height: parseInt(e.target.value) || 24 })}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Color</Label>
                <Input
                  type="text"
                  value={safeContent?.color || '#e0d8d2'}
                  onChange={(e) => onUpdate({ ...safeContent, color: e.target.value })}
                  placeholder="#e0d8d2"
                />
              </div>
            )}
          </div>
        );

      case 'promo_code':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Promo Code</Label>
              <Input
                value={safeContent?.code || ''}
                onChange={(e) => onUpdate({ ...safeContent, code: e.target.value })}
                placeholder="SAVE20"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Headline (optional)</Label>
              <Input
                value={safeContent?.headline || ''}
                onChange={(e) => onUpdate({ ...safeContent, headline: e.target.value })}
                placeholder="Exclusive Offer"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Expires text (optional)</Label>
              <Input
                value={safeContent?.expires || ''}
                onChange={(e) => onUpdate({ ...safeContent, expires: e.target.value })}
                placeholder="Offer ends Sunday"
              />
            </div>
          </div>
        );

      case 'countdown_timer':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Deadline</Label>
              <Input
                type="datetime-local"
                value={safeContent?.deadline || ''}
                onChange={(e) => onUpdate({ ...safeContent, deadline: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fallback Text (when expired)</Label>
              <Input
                value={safeContent?.fallback_text || ''}
                onChange={(e) => onUpdate({ ...safeContent, fallback_text: e.target.value })}
                placeholder="This offer has ended."
              />
            </div>
          </div>
        );

      case 'testimonial':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quote</Label>
              <Textarea
                value={safeContent?.quote || ''}
                onChange={(e) => onUpdate({ ...safeContent, quote: e.target.value })}
                placeholder="Best product ever!"
                className="italic"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Author</Label>
              <Input
                value={safeContent?.author || ''}
                onChange={(e) => onUpdate({ ...safeContent, author: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Rating (1-5)</Label>
              <Select
                value={String(safeContent?.rating || 5)}
                onValueChange={(val) => onUpdate({ ...safeContent, rating: parseInt(val) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Star</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Avatar URL (optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={safeContent?.avatar_url || ''}
                  onChange={(e) => onUpdate({ ...safeContent, avatar_url: e.target.value })}
                  placeholder="https://..."
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setImagePickerTarget('avatar_url');
                  }}
                >
                  Browse
                </Button>
              </div>
            </div>
          </div>
        );

      case 'spacer':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Height (px)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="8"
                  max="400"
                  step="8"
                  value={safeContent?.height || 40}
                  onChange={(e) => onUpdate({ ...safeContent, height: Number(e.target.value) })}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">px</span>
              </div>
            </div>
            <div
              className="bg-gray-100 rounded border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400"
              style={{ height: Math.min(safeContent?.height || 40, 120) }}
            >
              {safeContent?.height || 40}px spacer
            </div>
          </div>
        );

      // ── Web-only blocks (Tier 2) ──────────────────────────────────────────

      case 'hero': {
        const hs = safeContent?.headlineStyle || {};
        const ss = safeContent?.subtextStyle  || {};
        const textPos = safeContent?.textPosition || 'below';
        return (
          <div className="space-y-3">
            {/* Image position toggle */}
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Text position</Label>
              <div className="flex border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onUpdate({ ...safeContent, textPosition: 'below' })}
                  className={`px-3 py-1 text-xs transition-colors ${textPos === 'below' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >
                  Below image
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ ...safeContent, textPosition: 'above' })}
                  className={`px-3 py-1 text-xs transition-colors ${textPos === 'above' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >
                  Above image
                </button>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Headline</Label>
              <Input
                value={safeContent?.headline || ''}
                onChange={(e) => onUpdate({ ...safeContent, headline: e.target.value })}
                placeholder="Hero headline…"
                className="font-semibold text-lg"
              />
              {renderTextStyleFields(hs, (updated) => onUpdate({ ...safeContent, headlineStyle: updated }), 'heading')}
            </div>

            {/* Subtext */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subtext</Label>
              <Textarea
                value={safeContent?.subtext || ''}
                onChange={(e) => onUpdate({ ...safeContent, subtext: e.target.value })}
                placeholder="Short supporting text…"
                rows={2}
              />
              {renderTextStyleFields(ss, (updated) => onUpdate({ ...safeContent, subtextStyle: updated }), 'text')}
            </div>

            {/* Image */}
            <div>
              <Label className="text-xs">Image</Label>
              <div className="flex gap-2 mt-1">
                <Input value={safeContent?.imageUrl || ''} onChange={(e) => onUpdate({ ...safeContent, imageUrl: e.target.value })} placeholder="Image URL" className="flex-1 text-sm" />
                <Button variant="outline" size="sm" onClick={() => setImagePickerTarget('heroImage')}>Select</Button>
              </div>
              <Input value={safeContent?.imageAlt || ''} onChange={(e) => onUpdate({ ...safeContent, imageAlt: e.target.value })} placeholder="Alt text" className="mt-1 text-sm" />
            </div>

            {/* CTA */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">CTA Text</Label>
                <Input value={safeContent?.ctaText || ''} onChange={(e) => onUpdate({ ...safeContent, ctaText: e.target.value })} placeholder="Button label" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">CTA Link</Label>
                <Input value={safeContent?.ctaLink || ''} onChange={(e) => onUpdate({ ...safeContent, ctaLink: e.target.value })} placeholder="https://…" className="mt-1 text-sm" />
              </div>
            </div>

            {safeContent?.imageUrl && (
              <img src={safeContent.imageUrl} alt={safeContent.imageAlt || ''} className="w-full h-32 object-cover rounded border" />
            )}
            <CloudinaryAssetSelector
              isOpen={imagePickerTarget === 'heroImage'}
              onClose={() => setImagePickerTarget(null)}
              onSelect={(asset) => { onUpdate({ ...safeContent, imageUrl: asset.secure_url }); setImagePickerTarget(null); }}
              title="Select Hero Image"
              context="hero"
            />
          </div>
        );
      }

      case 'two_column': {
        const leftBlocks: any[] = Array.isArray(safeContent?.leftBlocks)  ? safeContent.leftBlocks  : [];
        const rightBlocks: any[] = Array.isArray(safeContent?.rightBlocks) ? safeContent.rightBlocks : [];

        const SIMPLE_TYPES = ['heading', 'paragraph', 'image', 'list'];
        const renderSimpleSubBlock = (subBlock: any, side: 'left' | 'right', idx: number) => {
          const update = (newContent: any) => {
            const arr = side === 'left' ? [...leftBlocks] : [...rightBlocks];
            arr[idx] = { ...arr[idx], content: newContent };
            onUpdate(side === 'left' ? { ...safeContent, leftBlocks: arr } : { ...safeContent, rightBlocks: arr });
          };
          const remove = () => {
            const arr = (side === 'left' ? [...leftBlocks] : [...rightBlocks]).filter((_, i) => i !== idx);
            onUpdate(side === 'left' ? { ...safeContent, leftBlocks: arr } : { ...safeContent, rightBlocks: arr });
          };
          return (
            <div key={subBlock.id} className="border border-gray-200 rounded p-2 space-y-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-500 capitalize">{subBlock.type}</span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={remove}><X className="h-3 w-3" /></Button>
              </div>
              {(subBlock.type === 'heading' || subBlock.type === 'paragraph') && (
                <Textarea value={subBlock.content?.text || ''} onChange={(e) => update({ ...subBlock.content, text: e.target.value })} rows={2} className="text-sm" />
              )}
              {subBlock.type === 'image' && (
                <Input value={subBlock.content?.url || ''} onChange={(e) => update({ ...subBlock.content, url: e.target.value })} placeholder="Image URL" className="text-sm" />
              )}
              {subBlock.type === 'list' && (
                <Textarea value={(subBlock.content?.items || []).join('\n')} onChange={(e) => update({ ...subBlock.content, items: e.target.value.split('\n') })} placeholder="One item per line" rows={3} className="text-sm" />
              )}
            </div>
          );
        };

        const addSub = (side: 'left' | 'right', type: string) => {
          const newSub = { id: Date.now().toString(), type, content: type === 'list' ? { items: [''] } : { text: '' }, order: side === 'left' ? leftBlocks.length : rightBlocks.length };
          const arr = side === 'left' ? [...leftBlocks, newSub] : [...rightBlocks, newSub];
          onUpdate(side === 'left' ? { ...safeContent, leftBlocks: arr } : { ...safeContent, rightBlocks: arr });
        };

        return (
          <div className="grid grid-cols-2 gap-4">
            {(['left', 'right'] as const).map((side) => {
              const blocks = side === 'left' ? leftBlocks : rightBlocks;
              return (
                <div key={side} className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">{side} column</p>
                  {blocks.map((sb: any, i: number) => renderSimpleSubBlock(sb, side, i))}
                  <div className="flex flex-wrap gap-1">
                    {SIMPLE_TYPES.map((t) => (
                      <Button key={t} variant="outline" size="sm" className="text-xs h-6 px-2" onClick={() => addSub(side, t)}>
                        <Plus className="h-3 w-3 mr-1" />{t}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      case 'accordion': {
        const items: Array<{ question: string; answer: string }> = Array.isArray(safeContent?.items) ? safeContent.items : [];
        return (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded p-2 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <Input value={item.question} onChange={(e) => { const arr = [...items]; arr[i] = { ...arr[i], question: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="Question…" className="text-sm font-medium" />
                    <Textarea value={item.answer} onChange={(e) => { const arr = [...items]; arr[i] = { ...arr[i], answer: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="Answer…" rows={2} className="text-sm" />
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mt-1" onClick={() => { const arr = items.filter((_, j) => j !== i); onUpdate({ ...safeContent, items: arr }); }}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => onUpdate({ ...safeContent, items: [...items, { question: '', answer: '' }] })}>
              <Plus className="h-3 w-3 mr-1" />Add Q&A
            </Button>
          </div>
        );
      }

      case 'banner': {
        const bannerInitHtml = safeContent?.html || (safeContent?.text ? `<p>${safeContent.text}</p>` : '');
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Banner Text</Label>
              <RichTextEditor
                value={bannerInitHtml}
                onChange={(html) => onUpdate({ ...safeContent, html, text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() })}
                placeholder="Announcement text…"
                minHeight="40px"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Style</Label>
              <Select value={safeContent?.style || 'info'} onValueChange={(v) => onUpdate({ ...safeContent, style: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info (blue)</SelectItem>
                  <SelectItem value="sale">Sale (yellow)</SelectItem>
                  <SelectItem value="warning">Warning (red)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {safeContent?.style === 'custom' && (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs">Text colour</Label>
                    <div className="flex gap-1 items-center mt-1">
                      <input
                        type="color"
                        value={safeContent?.textColor || '#1a1a1a'}
                        onChange={(e) => onUpdate({ ...safeContent, style: 'custom', textColor: e.target.value })}
                        title="Text colour"
                        className="h-7 w-7 cursor-pointer border border-gray-300 p-0.5 shrink-0"
                      />
                      <Input
                        value={safeContent?.textColor || ''}
                        onChange={(e) => onUpdate({ ...safeContent, style: 'custom', textColor: e.target.value })}
                        placeholder="#1a1a1a"
                        className="h-7 text-xs min-w-0"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs">Background colour</Label>
                    <div className="flex gap-1 items-center mt-1">
                      <input
                        type="color"
                        value={safeContent?.backgroundColor || '#f0ebe7'}
                        onChange={(e) => onUpdate({ ...safeContent, style: 'custom', backgroundColor: e.target.value })}
                        title="Background colour"
                        className="h-7 w-7 cursor-pointer border border-gray-300 p-0.5 shrink-0"
                      />
                      <Input
                        value={safeContent?.backgroundColor || ''}
                        onChange={(e) => onUpdate({ ...safeContent, style: 'custom', backgroundColor: e.target.value })}
                        placeholder="#f0ebe7"
                        className="h-7 text-xs min-w-0"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <Label className="text-xs">Border colour <span className="text-gray-400 font-normal">(optional — leave blank for no border)</span></Label>
                  <div className="flex gap-1 items-center mt-1">
                    <input
                      type="color"
                      value={safeContent?.bannerBorderColor || '#1a1a1a'}
                      onChange={(e) => onUpdate({ ...safeContent, style: 'custom', bannerBorderColor: e.target.value })}
                      title="Border colour"
                      className="h-7 w-7 cursor-pointer border border-gray-300 p-0.5 shrink-0"
                    />
                    <Input
                      value={safeContent?.bannerBorderColor || ''}
                      onChange={(e) => onUpdate({ ...safeContent, style: 'custom', bannerBorderColor: e.target.value || undefined })}
                      placeholder="none"
                      className="h-7 text-xs min-w-0"
                    />
                    {safeContent?.bannerBorderColor && (
                      <button
                        type="button"
                        onClick={() => onUpdate({ ...safeContent, bannerBorderColor: undefined })}
                        className="h-7 px-2 text-xs border border-gray-300 bg-white hover:bg-gray-50 shrink-0"
                      >✕</button>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Link URL (optional)</Label>
                <Input value={safeContent?.link || ''} onChange={(e) => onUpdate({ ...safeContent, link: e.target.value })} placeholder="https://…" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Link Text</Label>
                <Input value={safeContent?.linkText || ''} onChange={(e) => onUpdate({ ...safeContent, linkText: e.target.value })} placeholder="Learn more" className="mt-1 text-sm" />
              </div>
            </div>
            {renderTextStyleFields(safeContent, onUpdate, 'banner')}
          </div>
        );
      }

      case 'icon_text_row': {
        const iconItems: Array<{ icon: string; headline: string; body: string }> = Array.isArray(safeContent?.items) ? safeContent.items : [];
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="text-xs">Columns</Label>
              <Select value={String(safeContent?.columns || 3)} onValueChange={(v) => onUpdate({ ...safeContent, columns: Number(v) })}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3-up</SelectItem>
                  <SelectItem value="4">4-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {iconItems.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded p-2 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <Input value={item.icon} onChange={(e) => { const arr = [...iconItems]; arr[i] = { ...arr[i], icon: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="Icon URL or emoji" className="text-sm" />
                    <Input value={item.headline} onChange={(e) => { const arr = [...iconItems]; arr[i] = { ...arr[i], headline: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="Headline" className="text-sm font-medium" />
                    <Textarea value={item.body} onChange={(e) => { const arr = [...iconItems]; arr[i] = { ...arr[i], body: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="Body text" rows={2} className="text-sm" />
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mt-1" onClick={() => onUpdate({ ...safeContent, items: iconItems.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => onUpdate({ ...safeContent, items: [...iconItems, { icon: '', headline: '', body: '' }] })}>
              <Plus className="h-3 w-3 mr-1" />Add Item
            </Button>
          </div>
        );
      }

      case 'author_bio':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Author Name</Label>
              <Input value={safeContent?.name || ''} onChange={(e) => onUpdate({ ...safeContent, name: e.target.value })} placeholder="Full name" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Avatar Image</Label>
              <div className="flex gap-2 mt-1">
                <Input value={safeContent?.avatarUrl || ''} onChange={(e) => onUpdate({ ...safeContent, avatarUrl: e.target.value })} placeholder="Avatar URL" className="flex-1 text-sm" />
                <Button variant="outline" size="sm" onClick={() => setImagePickerTarget('authorAvatar')}>Select</Button>
              </div>
              {safeContent?.avatarUrl && (
                <img src={safeContent.avatarUrl} alt="Avatar preview" className="w-12 h-12 rounded-full object-cover mt-1 border" />
              )}
            </div>
            <div>
              <Label className="text-xs">Bio</Label>
              <Textarea value={safeContent?.bio || ''} onChange={(e) => onUpdate({ ...safeContent, bio: e.target.value })} placeholder="Short author bio…" rows={3} className="mt-1" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Links</Label>
              {(safeContent?.links || []).map((link: { label: string; url: string }, i: number) => (
                <div key={i} className="flex gap-2">
                  <Input value={link.label} onChange={(e) => { const arr = [...(safeContent?.links || [])]; arr[i] = { ...arr[i], label: e.target.value }; onUpdate({ ...safeContent, links: arr }); }} placeholder="Label" className="text-sm flex-1" />
                  <Input value={link.url} onChange={(e) => { const arr = [...(safeContent?.links || [])]; arr[i] = { ...arr[i], url: e.target.value }; onUpdate({ ...safeContent, links: arr }); }} placeholder="https://…" className="text-sm flex-1" />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onUpdate({ ...safeContent, links: (safeContent?.links || []).filter((_: any, j: number) => j !== i) })}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => onUpdate({ ...safeContent, links: [...(safeContent?.links || []), { label: '', url: '' }] })}>
                <Plus className="h-3 w-3 mr-1" />Add Link
              </Button>
            </div>
            <CloudinaryAssetSelector
              isOpen={imagePickerTarget === 'authorAvatar'}
              onClose={() => setImagePickerTarget(null)}
              onSelect={(asset) => { onUpdate({ ...safeContent, avatarUrl: asset.secure_url }); setImagePickerTarget(null); }}
              title="Select Author Avatar"
              context="thumbnail"
            />
          </div>
        );

      case 'breadcrumb': {
        const bcItems: Array<{ label: string; url: string }> = Array.isArray(safeContent?.items) ? safeContent.items : [];
        return (
          <div className="space-y-2">
            {bcItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={item.label} onChange={(e) => { const arr = [...bcItems]; arr[i] = { ...arr[i], label: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="Label" className="text-sm flex-1" />
                <Input value={item.url} onChange={(e) => { const arr = [...bcItems]; arr[i] = { ...arr[i], url: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="/path" className="text-sm flex-1" />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onUpdate({ ...safeContent, items: bcItems.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => onUpdate({ ...safeContent, items: [...bcItems, { label: '', url: '' }] })}>
              <Plus className="h-3 w-3 mr-1" />Add Crumb
            </Button>
            <p className="text-xs text-muted-foreground">Items render as a breadcrumb nav with JSON-LD structured data.</p>
          </div>
        );
      }

      case 'related_content': {
        const relItems: Array<{ title: string; url: string; image: string; contentType: string }> = Array.isArray(safeContent?.items) ? safeContent.items : [];
        return (
          <div className="space-y-3">
            {relItems.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded p-2 space-y-1">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <Input value={item.title} onChange={(e) => { const arr = [...relItems]; arr[i] = { ...arr[i], title: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="Article title" className="text-sm font-medium" />
                    <Input value={item.url} onChange={(e) => { const arr = [...relItems]; arr[i] = { ...arr[i], url: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="/slug or https://…" className="text-sm" />
                    <div className="grid grid-cols-2 gap-1">
                      <Input value={item.image || ''} onChange={(e) => { const arr = [...relItems]; arr[i] = { ...arr[i], image: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="Image URL (optional)" className="text-sm" />
                      <Input value={item.contentType || ''} onChange={(e) => { const arr = [...relItems]; arr[i] = { ...arr[i], contentType: e.target.value }; onUpdate({ ...safeContent, items: arr }); }} placeholder="Type label e.g. Article" className="text-sm" />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mt-1" onClick={() => onUpdate({ ...safeContent, items: relItems.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => onUpdate({ ...safeContent, items: [...relItems, { title: '', url: '', image: '', contentType: '' }] })}>
              <Plus className="h-3 w-3 mr-1" />Add Item
            </Button>
          </div>
        );
      }

      // ── Email-only blocks (Tier 3) ──────────────────────────────────────────

      case 'product_feature':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Product Name</Label>
              <Input value={safeContent?.name || ''} onChange={(e) => onUpdate({ ...safeContent, name: e.target.value })} placeholder="Product name" className="mt-1 font-medium" />
            </div>
            <div>
              <Label className="text-xs">Product Image</Label>
              <div className="flex gap-2 mt-1">
                <Input value={safeContent?.imageUrl || ''} onChange={(e) => onUpdate({ ...safeContent, imageUrl: e.target.value })} placeholder="Image URL" className="flex-1 text-sm" />
                <Button variant="outline" size="sm" onClick={() => setImagePickerTarget('productImage')}>Select</Button>
              </div>
              <Input value={safeContent?.imageAlt || ''} onChange={(e) => onUpdate({ ...safeContent, imageAlt: e.target.value })} placeholder="Alt text" className="mt-1 text-sm" />
            </div>
            {safeContent?.imageUrl && (
              <img src={safeContent.imageUrl} alt={safeContent.imageAlt || ''} className="w-full h-32 object-cover rounded border" />
            )}
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={safeContent?.description || ''} onChange={(e) => onUpdate({ ...safeContent, description: e.target.value })} placeholder="Short product description…" rows={2} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Price</Label>
              <Input value={safeContent?.price || ''} onChange={(e) => onUpdate({ ...safeContent, price: e.target.value })} placeholder="e.g. $49.00" className="mt-1 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">CTA Text</Label>
                <Input value={safeContent?.ctaText || ''} onChange={(e) => onUpdate({ ...safeContent, ctaText: e.target.value })} placeholder="Shop Now" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">CTA Link</Label>
                <Input value={safeContent?.ctaLink || ''} onChange={(e) => onUpdate({ ...safeContent, ctaLink: e.target.value })} placeholder="https://…" className="mt-1 text-sm" />
              </div>
            </div>
            <CloudinaryAssetSelector
              isOpen={imagePickerTarget === 'productImage'}
              onClose={() => setImagePickerTarget(null)}
              onSelect={(asset) => { onUpdate({ ...safeContent, imageUrl: asset.secure_url }); setImagePickerTarget(null); }}
              title="Select Product Image"
              context="thumbnail"
            />
          </div>
        );

      case 'product_row': {
        const products: any[] = Array.isArray(safeContent?.products) ? safeContent.products : [];
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Up to 3 products displayed side-by-side.</p>
            {products.map((p, i) => (
              <div key={i} className="border border-gray-200 rounded p-2 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <Input value={p.name || ''} onChange={(e) => { const arr = [...products]; arr[i] = { ...arr[i], name: e.target.value }; onUpdate({ ...safeContent, products: arr }); }} placeholder="Product name" className="text-sm font-medium" />
                    <Input value={p.price || ''} onChange={(e) => { const arr = [...products]; arr[i] = { ...arr[i], price: e.target.value }; onUpdate({ ...safeContent, products: arr }); }} placeholder="Price e.g. $29" className="text-sm" />
                    <Input value={p.imageUrl || ''} onChange={(e) => { const arr = [...products]; arr[i] = { ...arr[i], imageUrl: e.target.value }; onUpdate({ ...safeContent, products: arr }); }} placeholder="Image URL" className="text-sm" />
                    <div className="grid grid-cols-2 gap-1">
                      <Input value={p.ctaText || ''} onChange={(e) => { const arr = [...products]; arr[i] = { ...arr[i], ctaText: e.target.value }; onUpdate({ ...safeContent, products: arr }); }} placeholder="CTA text" className="text-sm" />
                      <Input value={p.ctaLink || ''} onChange={(e) => { const arr = [...products]; arr[i] = { ...arr[i], ctaLink: e.target.value }; onUpdate({ ...safeContent, products: arr }); }} placeholder="https://…" className="text-sm" />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mt-1" onClick={() => onUpdate({ ...safeContent, products: products.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            {products.length < 3 && (
              <Button variant="outline" size="sm" onClick={() => onUpdate({ ...safeContent, products: [...products, { name: '', price: '', imageUrl: '', ctaText: '', ctaLink: '' }] })}>
                <Plus className="h-3 w-3 mr-1" />Add Product
              </Button>
            )}
          </div>
        );
      }

      case 'email_promo_code':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">GIF URL <span className="text-red-500">*</span></Label>
              <Input value={safeContent?.url || ''} onChange={(e) => onUpdate({ ...safeContent, url: e.target.value })} placeholder="https://…/animation.gif" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Fallback Image URL (for Outlook)</Label>
              <Input value={safeContent?.fallbackUrl || ''} onChange={(e) => onUpdate({ ...safeContent, fallbackUrl: e.target.value })} placeholder="https://…/static-frame.jpg" className="mt-1 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Alt Text</Label>
                <Input value={safeContent?.alt || ''} onChange={(e) => onUpdate({ ...safeContent, alt: e.target.value })} placeholder="Animated banner" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Width (px, max 552)</Label>
                <Input type="number" min={100} max={552} value={safeContent?.width || 552} onChange={(e) => onUpdate({ ...safeContent, width: Number(e.target.value) })} className="mt-1 text-sm" />
              </div>
            </div>
            {safeContent?.url && (
              <img src={safeContent.url} alt={safeContent.alt || ''} className="w-full max-h-40 object-cover rounded border" />
            )}
          </div>
        );

      case 'email_countdown_timer_old':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">End Date &amp; Time <span className="text-red-500">*</span></Label>
              <Input type="datetime-local" value={safeContent?.endDatetime || ''} onChange={(e) => onUpdate({ ...safeContent, endDatetime: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Label (optional)</Label>
              <Input value={safeContent?.label || ''} onChange={(e) => onUpdate({ ...safeContent, label: e.target.value })} placeholder="Offer ends in" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Style</Label>
              <Select value={safeContent?.style || 'light'} onValueChange={(v) => onUpdate({ ...safeContent, style: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light (cream background)</SelectItem>
                  <SelectItem value="dark">Dark (black background)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Renders as an animated GIF countdown (timer.email). Outlook shows a static time fallback.</p>
          </div>
        );

      case 'progress_loyalty':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={safeContent?.label || ''} onChange={(e) => onUpdate({ ...safeContent, label: e.target.value })} placeholder="Your loyalty progress" className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Current</Label>
                <Input type="number" min={0} value={safeContent?.current ?? 0} onChange={(e) => onUpdate({ ...safeContent, current: Number(e.target.value) })} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Goal</Label>
                <Input type="number" min={1} value={safeContent?.goal ?? 100} onChange={(e) => onUpdate({ ...safeContent, goal: Number(e.target.value) })} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Input value={safeContent?.unit || ''} onChange={(e) => onUpdate({ ...safeContent, unit: e.target.value })} placeholder="pts" className="mt-1 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Bar Colour</Label>
              <div className="flex gap-2 mt-1 items-center">
                <input type="color" value={safeContent?.color || '#c9a227'} onChange={(e) => onUpdate({ ...safeContent, color: e.target.value })} className="h-8 w-8 cursor-pointer rounded border" />
                <Input value={safeContent?.color || '#c9a227'} onChange={(e) => onUpdate({ ...safeContent, color: e.target.value })} placeholder="#c9a227" className="text-sm flex-1" />
              </div>
            </div>
            <div className="h-6 rounded overflow-hidden border" style={{ background: '#f4f1ef' }}>
              <div
                className="h-full flex items-center px-2 text-white text-xs font-bold"
                style={{ width: `${Math.round(Math.min(100, ((safeContent?.current ?? 0) / Math.max(1, safeContent?.goal ?? 100)) * 100))}%`, background: safeContent?.color || '#c9a227' }}
              >
                {Math.round(Math.min(100, ((safeContent?.current ?? 0) / Math.max(1, safeContent?.goal ?? 100)) * 100))}%
              </div>
            </div>
          </div>
        );

      // ── Shopify blocks (Tier 4) ──────────────────────────────────────────
      case 'shopify_product_card':
        return (
          <div className="space-y-3">
            {!shopifyConfigured && (
              <div className="text-xs bg-yellow-50 border border-yellow-400 text-yellow-800 px-3 py-2">
                Shopify is not configured. Add <code>SHOPIFY_STOREFRONT_TOKEN</code> and <code>SHOPIFY_STORE_DOMAIN</code> to environment variables to enable live fetch.
              </div>
            )}
            <div>
              <Label className="text-xs">Shopify Product ID or GID</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={safeContent?.productId || ''}
                  onChange={(e) => onUpdate({ ...safeContent, productId: e.target.value })}
                  placeholder="12345678 or gid://shopify/Product/…"
                  className="text-sm flex-1"
                />
                <Button size="sm" variant="outline" onClick={() => setShowResourcePicker(true)}>
                  <ShoppingBag className="h-3 w-3 mr-1" />Browse
                </Button>
                <Button size="sm" variant="outline" onClick={() => fetchShopifyProduct(safeContent?.productId || '')} disabled={shopifyLoading}>
                  {shopifyLoading ? "…" : "Fetch"}
                </Button>
              </div>
              {shopifyError && <p className="text-xs text-red-500 mt-1">{shopifyError}</p>}
            </div>
            {isProductPreview(shopifyData) && (
              <div className="flex gap-3 p-2 border rounded bg-muted/30 text-xs">
                {shopifyData.imageUrl && <img src={shopifyData.imageUrl} alt={shopifyData.title} className="w-14 h-14 object-cover rounded border" />}
                <div>
                  <p className="font-semibold">{shopifyData.title}</p>
                  <p className="text-muted-foreground">{shopifyData.currencyCode === "GBP" ? "£" : shopifyData.currencyCode === "EUR" ? "€" : "$"}{parseFloat(shopifyData.price || "0").toFixed(2)}</p>
                  <p className="text-muted-foreground">handle: {shopifyData.handle}</p>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">CTA Text</Label>
              <Input value={safeContent?.ctaText || ''} onChange={(e) => onUpdate({ ...safeContent, ctaText: e.target.value })} placeholder="Shop Now" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">CTA Link Override (optional)</Label>
              <Input value={safeContent?.ctaLink || ''} onChange={(e) => onUpdate({ ...safeContent, ctaLink: e.target.value })} placeholder="Leave blank to use /products/{handle}" className="mt-1 text-sm" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={safeContent?.showDescription !== false} onChange={(e) => onUpdate({ ...safeContent, showDescription: e.target.checked })} />
                Show description
              </label>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={safeContent?.showPrice !== false} onChange={(e) => onUpdate({ ...safeContent, showPrice: e.target.checked })} />
                Show price
              </label>
            </div>
            <ShopifyResourcePicker
              isOpen={showResourcePicker}
              onClose={() => setShowResourcePicker(false)}
              allowedTabs={["products"]}
              title="Select Product"
              onSelect={(resource) => {
                if (resource.type === "product") {
                  onUpdate({ ...safeContent, productId: resource.id });
                  fetchShopifyProduct(resource.id);
                }
              }}
            />
          </div>
        );

      case 'shopify_product_grid':
        return (
          <div className="space-y-3">
            {!shopifyConfigured && (
              <div className="text-xs bg-yellow-50 border border-yellow-400 text-yellow-800 px-3 py-2">
                Shopify is not configured. Add <code>SHOPIFY_STOREFRONT_TOKEN</code> and <code>SHOPIFY_STORE_DOMAIN</code> to environment variables to enable live fetch.
              </div>
            )}
            <div>
              <Label className="text-xs">Shopify Collection ID or GID</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={safeContent?.collectionId || ''}
                  onChange={(e) => onUpdate({ ...safeContent, collectionId: e.target.value })}
                  placeholder="12345678 or gid://shopify/Collection/…"
                  className="text-sm flex-1"
                />
                <Button size="sm" variant="outline" onClick={() => setShowResourcePicker(true)}>
                  <ShoppingBag className="h-3 w-3 mr-1" />Browse
                </Button>
                <Button size="sm" variant="outline" onClick={() => fetchShopifyCollection(safeContent?.collectionId || '', safeContent?.itemCount || 8)} disabled={shopifyLoading}>
                  {shopifyLoading ? "…" : "Fetch"}
                </Button>
              </div>
              {shopifyError && <p className="text-xs text-red-500 mt-1">{shopifyError}</p>}
            </div>
            <ShopifyResourcePicker
              isOpen={showResourcePicker}
              onClose={() => setShowResourcePicker(false)}
              allowedTabs={["collections"]}
              title="Select Collection"
              onSelect={(resource) => {
                if (resource.type === "collection") {
                  onUpdate({ ...safeContent, collectionId: resource.id });
                  fetchShopifyCollection(resource.id, safeContent?.itemCount || 8);
                }
              }}
            />
            {isCollectionPreview(shopifyData) && (
              <div className="p-2 border rounded bg-muted/30 text-xs">
                <p className="font-semibold">{shopifyData.title}</p>
                <p className="text-muted-foreground">{shopifyData.products.length} product(s) found</p>
              </div>
            )}
            <div>
              <Label className="text-xs">Item Count (max 24)</Label>
              <Input type="number" min={2} max={24} value={safeContent?.itemCount ?? 8} onChange={(e) => onUpdate({ ...safeContent, itemCount: parseInt(e.target.value) || 8 })} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Sort Order</Label>
              <Select value={safeContent?.sortOrder || 'default'} onValueChange={(v) => onUpdate({ ...safeContent, sortOrder: v })}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="price_asc">Price (low to high)</SelectItem>
                  <SelectItem value="price_desc">Price (high to low)</SelectItem>
                  <SelectItem value="title">Title A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'shopify_collection_feature':
        return (
          <div className="space-y-3">
            {!shopifyConfigured && (
              <div className="text-xs bg-yellow-50 border border-yellow-400 text-yellow-800 px-3 py-2">
                Shopify is not configured. Add <code>SHOPIFY_STOREFRONT_TOKEN</code> and <code>SHOPIFY_STORE_DOMAIN</code> to environment variables to enable live fetch.
              </div>
            )}
            <div>
              <Label className="text-xs">Shopify Collection ID or GID</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={safeContent?.collectionId || ''}
                  onChange={(e) => onUpdate({ ...safeContent, collectionId: e.target.value })}
                  placeholder="12345678 or gid://shopify/Collection/…"
                  className="text-sm flex-1"
                />
                <Button size="sm" variant="outline" onClick={() => setShowResourcePicker(true)}>
                  <ShoppingBag className="h-3 w-3 mr-1" />Browse
                </Button>
                <Button size="sm" variant="outline" onClick={() => fetchShopifyCollection(safeContent?.collectionId || '')} disabled={shopifyLoading}>
                  {shopifyLoading ? "…" : "Fetch"}
                </Button>
              </div>
              {shopifyError && <p className="text-xs text-red-500 mt-1">{shopifyError}</p>}
            </div>
            <ShopifyResourcePicker
              isOpen={showResourcePicker}
              onClose={() => setShowResourcePicker(false)}
              allowedTabs={["collections"]}
              title="Select Collection"
              onSelect={(resource) => {
                if (resource.type === "collection") {
                  onUpdate({ ...safeContent, collectionId: resource.id });
                  fetchShopifyCollection(resource.id);
                }
              }}
            />
            {isCollectionPreview(shopifyData) && (
              <div className="flex gap-3 p-2 border rounded bg-muted/30 text-xs">
                {shopifyData.imageUrl && <img src={shopifyData.imageUrl} alt={shopifyData.title} className="w-14 h-14 object-cover rounded border" />}
                <div>
                  <p className="font-semibold">{shopifyData.title}</p>
                  <p className="text-muted-foreground">{shopifyData.products.length} product(s)</p>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">Headline Override (optional)</Label>
              <Input value={safeContent?.headline || ''} onChange={(e) => onUpdate({ ...safeContent, headline: e.target.value })} placeholder="Defaults to collection title" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Subtext Override (optional)</Label>
              <Textarea value={safeContent?.subtext || ''} onChange={(e) => onUpdate({ ...safeContent, subtext: e.target.value })} placeholder="Defaults to collection description" className="mt-1 text-sm" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">CTA Text</Label>
                <Input value={safeContent?.ctaText || ''} onChange={(e) => onUpdate({ ...safeContent, ctaText: e.target.value })} placeholder="Shop the Collection" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">CTA Link</Label>
                <Input value={safeContent?.ctaLink || ''} onChange={(e) => onUpdate({ ...safeContent, ctaLink: e.target.value })} placeholder="/collections/…" className="mt-1 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Image URL Override (optional)</Label>
              <Input value={safeContent?.imageUrl || ''} onChange={(e) => onUpdate({ ...safeContent, imageUrl: e.target.value })} placeholder="Defaults to collection image" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Style</Label>
              <Select value={safeContent?.style || 'light'} onValueChange={(v) => onUpdate({ ...safeContent, style: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light (cream background)</SelectItem>
                  <SelectItem value="dark">Dark (black background)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'shopify_variant_selector':
        return (
          <div className="space-y-3">
            {!shopifyConfigured && (
              <div className="text-xs bg-yellow-50 border border-yellow-400 text-yellow-800 px-3 py-2">
                Shopify is not configured. Add <code>SHOPIFY_STOREFRONT_TOKEN</code> and <code>SHOPIFY_STORE_DOMAIN</code> to environment variables to enable live fetch.
              </div>
            )}
            <div>
              <Label className="text-xs">Shopify Product ID or GID</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={safeContent?.productId || ''}
                  onChange={(e) => onUpdate({ ...safeContent, productId: e.target.value })}
                  placeholder="12345678 or gid://shopify/Product/…"
                  className="text-sm flex-1"
                />
                <Button size="sm" variant="outline" onClick={() => setShowResourcePicker(true)}>
                  <ShoppingBag className="h-3 w-3 mr-1" />Browse
                </Button>
                <Button size="sm" variant="outline" onClick={() => fetchShopifyProduct(safeContent?.productId || '')} disabled={shopifyLoading}>
                  {shopifyLoading ? "…" : "Fetch"}
                </Button>
              </div>
              {shopifyError && <p className="text-xs text-red-500 mt-1">{shopifyError}</p>}
            </div>
            <ShopifyResourcePicker
              isOpen={showResourcePicker}
              onClose={() => setShowResourcePicker(false)}
              allowedTabs={["products"]}
              title="Select Product"
              onSelect={(resource) => {
                if (resource.type === "product") {
                  onUpdate({ ...safeContent, productId: resource.id });
                  fetchShopifyProduct(resource.id);
                }
              }}
            />
            {isProductPreview(shopifyData) && (
              <div className="p-2 border rounded bg-muted/30 text-xs">
                <p className="font-semibold">{shopifyData.title}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {shopifyData.variants.map((v, i) => (
                    <span key={i} className={`px-2 py-0.5 border text-xs rounded ${!v.available ? 'opacity-50 line-through' : ''}`}>{v.title}</span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">Selector Type</Label>
              <Select value={safeContent?.selectorType || 'all'} onValueChange={(v) => onUpdate({ ...safeContent, selectorType: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All variants</SelectItem>
                  <SelectItem value="colour">Colour variants</SelectItem>
                  <SelectItem value="size">Size variants</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">CTA Button Text</Label>
              <Input value={safeContent?.ctaText || ''} onChange={(e) => onUpdate({ ...safeContent, ctaText: e.target.value })} placeholder="Add to Bag" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">CTA Link Override (optional)</Label>
              <Input value={safeContent?.ctaLink || ''} onChange={(e) => onUpdate({ ...safeContent, ctaLink: e.target.value })} placeholder="Leave blank to use /products/{handle}" className="mt-1 text-sm" />
            </div>
            <p className="text-xs text-muted-foreground">Renders interactive variant buttons. Clicking a variant updates the CTA link with ?variant=ID.</p>
          </div>
        );

      case 'shopify_page':
        return (
          <div className="space-y-3">
            {!shopifyConfigured && (
              <div className="text-xs bg-yellow-50 border border-yellow-400 text-yellow-800 px-3 py-2">
                Shopify is not configured. Add <code>SHOPIFY_STOREFRONT_TOKEN</code> and <code>SHOPIFY_STORE_DOMAIN</code> to enable live browse.
              </div>
            )}
            <div>
              <Label className="text-xs">Shopify Page</Label>
              <div className="flex gap-2 mt-1">
                <Input value={safeContent?.title || ''} readOnly placeholder="Select a page using Browse" className="text-sm flex-1 bg-muted/30" />
                <Button size="sm" variant="outline" onClick={() => setShowResourcePicker(true)}>
                  <ShoppingBag className="h-3 w-3 mr-1" />Browse
                </Button>
              </div>
              {safeContent?.handle && <p className="text-xs text-muted-foreground mt-1">handle: {safeContent.handle}</p>}
            </div>
            <div>
              <Label className="text-xs">Title Override (optional)</Label>
              <Input value={safeContent?.titleOverride || ''} onChange={(e) => onUpdate({ ...safeContent, titleOverride: e.target.value })} placeholder="Defaults to page title" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Excerpt Override (optional)</Label>
              <Textarea value={safeContent?.excerptOverride || ''} onChange={(e) => onUpdate({ ...safeContent, excerptOverride: e.target.value })} placeholder="Defaults to page body summary" rows={2} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">CTA Text</Label>
              <Input value={safeContent?.ctaText || ''} onChange={(e) => onUpdate({ ...safeContent, ctaText: e.target.value })} placeholder="Read More" className="mt-1 text-sm" />
            </div>
            {safeContent?.title && (
              <div className="p-2 border rounded bg-muted/30 text-xs">
                <p className="font-semibold">{safeContent.titleOverride || safeContent.title}</p>
                {(safeContent.excerptOverride || safeContent.bodySummary) && (
                  <p className="text-muted-foreground mt-1 line-clamp-2">{safeContent.excerptOverride || safeContent.bodySummary}</p>
                )}
              </div>
            )}
            <ShopifyResourcePicker
              isOpen={showResourcePicker}
              onClose={() => setShowResourcePicker(false)}
              allowedTabs={["pages"]}
              title="Select Shopify Page"
              onSelect={(resource) => {
                if (resource.type === "page") {
                  onUpdate({ ...safeContent, pageId: resource.id, title: resource.title, handle: resource.handle, bodySummary: resource.bodySummary, url: resource.url });
                }
              }}
            />
          </div>
        );

      case 'shopify_image':
        return (
          <div className="space-y-3">
            {!shopifyConfigured && (
              <div className="text-xs bg-yellow-50 border border-yellow-400 text-yellow-800 px-3 py-2">
                Shopify is not configured. Add <code>SHOPIFY_STOREFRONT_TOKEN</code> and <code>SHOPIFY_STORE_DOMAIN</code> to enable live browse.
              </div>
            )}
            <div>
              <Label className="text-xs">Shopify Image</Label>
              <div className="flex gap-2 mt-1">
                <Input value={safeContent?.url || ''} onChange={(e) => onUpdate({ ...safeContent, url: e.target.value })} placeholder="Image URL or browse to select" className="text-sm flex-1" />
                <Button size="sm" variant="outline" onClick={() => setShowResourcePicker(true)}>
                  <ShoppingBag className="h-3 w-3 mr-1" />Browse
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Alt Text</Label>
              <Input value={safeContent?.alt || ''} onChange={(e) => onUpdate({ ...safeContent, alt: e.target.value })} placeholder="Describe the image for accessibility" className="mt-1 text-sm" />
            </div>
            {safeContent?.url && (
              <img src={safeContent.url} alt={safeContent.alt || ''} className="w-full max-h-48 object-cover rounded border" />
            )}
            <ShopifyResourcePicker
              isOpen={showResourcePicker}
              onClose={() => setShowResourcePicker(false)}
              allowedTabs={["images"]}
              title="Select Shopify Image"
              onSelect={(resource) => {
                if (resource.type === "image") {
                  onUpdate({ ...safeContent, url: resource.url, alt: resource.altText || safeContent?.alt || '' });
                }
              }}
            />
          </div>
        );

      case 'html_block':
        return (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Snippet</Label>
              <Select
                value={safeContent?.snippetName || '_custom_'}
                onValueChange={(v) => onUpdate({ ...safeContent, snippetName: v === '_custom_' ? undefined : v })}
              >
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_custom_" className="text-xs">Custom HTML</SelectItem>
                  <SelectItem value="email_header_standard" className="text-xs">Email Header — Standard</SelectItem>
                  <SelectItem value="email_footer_standard" className="text-xs">Email Footer — Standard</SelectItem>
                  <SelectItem value="wt_footer" className="text-xs">WT Footer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(!safeContent?.snippetName || safeContent?.snippetName === '_custom_') && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Raw HTML</Label>
                <Textarea
                  value={safeContent?.html || ''}
                  onChange={(e) => onUpdate({ ...safeContent, html: e.target.value })}
                  placeholder="Enter raw HTML…"
                  className="min-h-[120px] font-mono text-xs"
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        );

      case 'app_block':
        return <AppBlockEditor safeContent={safeContent} onUpdate={onUpdate} />;

      default:
        return (
          <Textarea
            value={JSON.stringify(content, null, 2)}
            onChange={(e) => {
              try {
                setContent(JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, don't update
              }
            }}
            placeholder="Enter content..."
            className="min-h-24 font-mono text-sm"
          />
        );
    }
  };

  return (
    <div className={`relative transition-all mb-4 ${
      blockState === "ai_generated" ? "border-l-4 border-green-500 pl-3" :
      blockState === "needs_input" ? "border-l-4 border-amber-400 pl-3" :
      "border-l-4 border-transparent pl-3"
    }`}>
      {/* AI badge */}
      {blockState === "ai_generated" && (
        <div className="absolute top-0 right-0 z-10">
          <span className="text-[10px] bg-green-100 text-green-700 border border-green-300 px-1.5 py-0.5 font-mono leading-none">
            AI ✦
          </span>
        </div>
      )}

      {blockState === "needs_input" && block.type === 'image' && !(content as any)?.url && (
        <div className="mb-2 border-2 border-dashed border-amber-400 bg-amber-50 rounded p-4 text-center text-sm text-amber-700">
          Add image — open Cloudinary picker
        </div>
      )}

      <Card className="wt-content-block">
        <div className="wt-content-block-header">
          <div className="wt-content-block-type">
            <span className="flex items-center gap-2">
              {block.type.charAt(0).toUpperCase() + block.type.slice(1)} Block
              {block.notes && (
                <span className="text-[10px] italic text-muted-foreground font-normal">
                  ({block.notes})
                </span>
              )}
            </span>
          </div>
          <div className="wt-content-block-actions">
            <Button
              onClick={generateBlock}
              disabled={isGenerating}
              size="sm"
              variant="outline"
              className="h-8 border-black hover:bg-black hover:text-white transition-colors"
            >
              {isGenerating ? (
                <span className="flex items-center gap-1.5">
                  <span className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
                  Generating...
                </span>
              ) : blockState === "ai_generated" ? "Regenerate ✦" : "Generate ✦"}
            </Button>
            {(block.type === 'text' || block.type === 'heading') && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImproveContent}
                  disabled={improveContent.isPending}
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
                <Dialog open={showRefineDialog} onOpenChange={setShowRefineDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={refineContent.isPending}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Refine Content</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <label htmlFor="feedback" className="text-sm font-medium">
                          Feedback for AI refinement:
                        </label>
                        <Textarea
                          id="feedback"
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Tell the AI how you'd like to improve this content..."
                          className="min-h-24"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowRefineDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleRefineContent}
                        disabled={refineContent.isPending || !feedback.trim()}
                      >
                        {refineContent.isPending ? "Refining..." : "Refine Content"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
            {onSaveAsPreset && (
              <Button
                variant="outline"
                size="sm"
                title="Save as preset"
                onClick={() => onSaveAsPreset(block)}
              >
                <Bookmark className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="sm">
              <GripVertical className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardContent className="pt-4">
          {renderBlockEditor()}

          {/* Block Background section (email only) */}
          <div className="mt-6 pt-4 border-t border-dashed border-muted-foreground/20">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Block Background <span className="text-[10px] normal-case font-normal">(email only)</span></Label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs w-20 shrink-0">Color</Label>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="color"
                    value={blockBg.color || '#ffffff'}
                    onChange={(e) => handleBgUpdate({ color: e.target.value === '#ffffff' ? undefined : e.target.value })}
                    className="h-7 w-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={blockBg.color || ''}
                    onChange={(e) => handleBgUpdate({ color: e.target.value || undefined })}
                    placeholder="#ffffff"
                    className="text-xs h-7 flex-1"
                  />
                  {blockBg.color && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleBgUpdate({ color: undefined })}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs w-20 shrink-0">Image URL</Label>
                <Input
                  value={blockBg.imageUrl || ''}
                  onChange={(e) => handleBgUpdate({ imageUrl: e.target.value || undefined })}
                  placeholder="https://example.com/bg.jpg"
                  className="text-xs h-7 flex-1"
                />
              </div>
              {blockBg.imageUrl && (
                <>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-20 shrink-0">Size</Label>
                    <Select value={blockBg.imageSize || 'cover'} onValueChange={(v) => handleBgUpdate({ imageSize: v as 'cover' | 'contain' })}>
                      <SelectTrigger className="text-xs h-7 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cover">Cover</SelectItem>
                        <SelectItem value="contain">Contain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-20 shrink-0">Fallback color</Label>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="color"
                        value={blockBg.fallbackColor || '#ffffff'}
                        onChange={(e) => handleBgUpdate({ fallbackColor: e.target.value })}
                        className="h-7 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={blockBg.fallbackColor || ''}
                        onChange={(e) => handleBgUpdate({ fallbackColor: e.target.value || undefined })}
                        placeholder="#ffffff"
                        className="text-xs h-7 flex-1"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                    Outlook shows the fallback color instead of the background image.
                  </p>
                </>
              )}
            </div>

          {/* Block Padding */}
          <div className="mt-4 pt-3 border-t border-dashed border-muted-foreground/20">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Block Padding <span className="text-[10px] normal-case font-normal">(email only)</span></Label>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {([['paddingTop','T'],['paddingRight','R'],['paddingBottom','B'],['paddingLeft','L']] as const).map(([field, label]) => (
                <div key={field} className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={blockBg[field] ?? ''}
                    placeholder={field === 'paddingTop' || field === 'paddingBottom' ? '20' : '24'}
                    onChange={(e) => {
                      const v = e.target.value === '' ? undefined : Number(e.target.value);
                      handleBgUpdate({ [field]: v });
                    }}
                    className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Leave blank to use defaults (20px top/bottom, 24px left/right)</p>
          </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
