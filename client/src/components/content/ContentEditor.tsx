import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentBlock, type BlockState, type ImageSuggestion } from "./ContentBlock";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Wand2, Save, Plus, Mail, ExternalLink, Bookmark, BookMarked, ShoppingBag, ChevronUp, ChevronDown, Eye, Settings2, Upload, Megaphone, RefreshCw, ImageIcon, Loader2, Globe, Pencil } from "lucide-react";
import { EmailPreviewModal } from "./EmailPreviewModal";
import { Badge } from "@/components/ui/badge";
import { DialogFooter } from "@/components/ui/dialog";
import { CloudinaryAssetSelector } from "../CloudinaryAssetSelector";
import { ShopifyResourcePicker } from "@/components/ShopifyResourcePicker";
import type { ShopifyResource } from "@/components/ShopifyResourcePicker";

interface ContentEditorProps {
  contentItem?: any;
  contentItemId?: number | string;
  type?: string;
  onSave?: (data: any) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export function ContentEditor({ contentItem, contentItemId, type: typeProp, onSave, onCancel, onClose }: ContentEditorProps) {
  const [, setLocation] = useLocation();

  // Read URL query params for template-launch flow
  const urlParams = new URLSearchParams(window.location.search);
  const urlTemplateId = urlParams.get("templateId") || null;
  const urlType = urlParams.get("type") || null;
  const urlKeywordId = urlParams.get("keywordId") || null;

  // Effective type: URL param takes priority over prop
  const type = urlType || typeProp;

  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [supportingKeywords, setSupportingKeywords] = useState("");
  const [articleAngle, setArticleAngle] = useState<string | null>(null);
  const [keywordType, setKeywordType] = useState<string>("");
  const [contentFormat, setContentFormat] = useState<'auto' | 'A' | 'B' | 'C'>('auto');
  const [featuredImage, setFeaturedImage] = useState("");
  const [status, setStatus] = useState("draft");
  const [scheduledDate, setScheduledDate] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("default");
  const [localBlocks, setLocalBlocks] = useState<any[]>([]);
  const [markdownContent, setMarkdownContent] = useState("");
  const [markdownPreviewHtml, setMarkdownPreviewHtml] = useState("");
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [imageBlockId, setImageBlockId] = useState<string | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showPagePreview, setShowPagePreview] = useState(false);
  const [pushKlaviyoLoading, setPushKlaviyoLoading] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [campaignAudiences, setCampaignAudiences] = useState<Array<{ id: string; name: string; kind: "list" | "segment" }>>([]);
  const [campaignAudiencesLoading, setCampaignAudiencesLoading] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignFromName, setCampaignFromName] = useState("Well Told");
  const [campaignFromEmail, setCampaignFromEmail] = useState("help@welltolddesign.com");
  const [campaignAudienceId, setCampaignAudienceId] = useState("");
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [pagePreviewHtml, setPagePreviewHtml] = useState<string | null>(null);
  const [pagePreviewLoading, setPagePreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSeoPanel, setShowSeoPanel] = useState(false);
  const [ogTitle, setOgTitle] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [redirectFrom, setRedirectFrom] = useState("");
  const [pageTemplate, setPageTemplate] = useState("default");
  const [structuredDataType, setStructuredDataType] = useState("None");
  const [generatedStructuredData, setGeneratedStructuredData] = useState<object | null>(null);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showShopifyPicker, setShowShopifyPicker] = useState(false);
  const [presetBlock, setPresetBlock] = useState<any>(null);
  const [presetName, setPresetName] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<number | null>(null);
  const [editPresetDraft, setEditPresetDraft] = useState("");
  const [blockStates, setBlockStates] = useState<Record<string, BlockState>>({});
  const [imageSuggestions, setImageSuggestions] = useState<Record<string, ImageSuggestion>>({});
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [activeMood, setActiveMood] = useState("conversational");
  const [contentDescription, setContentDescription] = useState("");
  const [pickerProduct, setPickerProduct] = useState<{ handle: string; title: string; currentImageUrl: string } | null>(null);
  const [pickerImages, setPickerImages] = useState<{ src: string; alt: string }[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerTab, setPickerTab] = useState<'url' | 'upload' | 'cloudinary'>('url');
  const [pickerUrlInput, setPickerUrlInput] = useState('');
  const [pickerUploadLoading, setPickerUploadLoading] = useState(false);

  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [heroPickerTab, setHeroPickerTab] = useState<'url' | 'upload' | 'cloudinary'>('url');
  const [heroUrlInput, setHeroUrlInput] = useState('');
  const [heroUploadLoading, setHeroUploadLoading] = useState(false);
  const [cloudinaryTarget, setCloudinaryTarget] = useState<'hero' | 'product'>('hero');

  const heroFileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useAuth();

  // Site settings (used to build the live URL from the configured domain)
  const { data: siteSettings } = useQuery<any>({
    queryKey: ["/api/site-settings"],
  });

  // Block presets
  const { data: blockPresetsData = [] } = useQuery<any[]>({
    queryKey: ["/api/block-presets"],
  });

  const savePresetMutation = useMutation({
    mutationFn: async ({ name, block }: { name: string; block: any }) => {
      const res = await apiRequest("POST", "/api/block-presets", {
        name,
        blockType: block.type,
        channel: null,
        content: block.content,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/block-presets"] });
      setShowPresetDialog(false);
      setPresetName("");
      setPresetBlock(null);
      toast({ title: "Preset saved", description: "You can now reuse this block from the presets section." });
    },
    onError: () => toast({ title: "Failed to save preset", variant: "destructive" }),
  });

  const deletePresetMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/block-presets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/block-presets"] });
      toast({ title: "Preset deleted" });
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: any }) => {
      const res = await apiRequest("PUT", `/api/block-presets/${id}`, { content });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/block-presets"] });
      // Update any locally-open blocks linked to this preset
      setLocalBlocks(prev => prev.map((b: any) =>
        b.content?._presetId === data.id
          ? { ...b, content: { ...data.content, _presetId: data.id, _presetName: data.name } }
          : b
      ));
      setEditingPresetId(null);
      setHasUnsavedChanges(true);
      const count = data.updatedBlockCount ?? 0;
      toast({
        title: "Preset updated",
        description: count > 0
          ? `Content updated here and synced to ${count} saved block${count === 1 ? "" : "s"} across all templates.`
          : "Preset content saved. Future blocks inserted from this preset will use the new content.",
      });
    },
    onError: () => toast({ title: "Failed to update preset", variant: "destructive" }),
  });

  const openEditPreset = (preset: any) => {
    setEditingPresetId(preset.id);
    if (preset.blockType === "html_block") {
      setEditPresetDraft((preset.content?.html) ?? "");
    } else {
      const { _presetId: _pid, _presetName: _pn, ...cleanContent } = preset.content || {};
      setEditPresetDraft(JSON.stringify(cleanContent, null, 2));
    }
  };

  const handleSaveEditedPreset = () => {
    const preset = (blockPresetsData as any[]).find((p: any) => p.id === editingPresetId);
    if (!preset) return;
    let newContent: any;
    if (preset.blockType === "html_block") {
      newContent = { ...(preset.content || {}), html: editPresetDraft };
    } else {
      try { newContent = JSON.parse(editPresetDraft); } catch {
        toast({ title: "Invalid JSON", description: "Fix the JSON before saving.", variant: "destructive" });
        return;
      }
    }
    updatePresetMutation.mutate({ id: editingPresetId!, content: newContent });
  };

  const handleEditPresetGlobally = (presetId: number, presetName: string) => {
    const preset = (blockPresetsData as any[]).find((p: any) => p.id === presetId);
    if (preset) openEditPreset(preset);
  };

  const handleDetachPreset = (blockId: string) => {
    setLocalBlocks(prev => prev.map((b: any) => {
      if (b.id !== blockId) return b;
      const { _presetId: _pid, _presetName: _pn, ...cleanContent } = b.content || {};
      return { ...b, content: cleanContent };
    }));
    setHasUnsavedChanges(true);
    toast({ title: "Detached from preset", description: "This block is now an independent copy." });
  };

  const handleSaveAsPreset = (block: any) => {
    setPresetBlock(block);
    setPresetName("");
    setShowPresetDialog(true);
  };

  const addBlockFromPreset = (preset: any) => {
    const nextOrder = localBlocks.length === 0 ? 0 : Math.max(...localBlocks.map((b: any) => b.order ?? 0)) + 1;
    const newBlock = {
      id: Date.now().toString(),
      type: preset.blockType,
      content: { ...(preset.content || {}), _presetId: preset.id, _presetName: preset.name },
      order: nextOrder,
    };
    setLocalBlocks([...localBlocks, newBlock]);
    setHasUnsavedChanges(true);
    toast({ title: `Added "${preset.name}" block` });
  };

  // Load content item if editing by ID
  const { data: loadedContentItem, isLoading: isLoadingContent } = useQuery({
    queryKey: ["/api/content-items", contentItemId],
    queryFn: async () => {
      if (!contentItemId) return null;
      const response = await apiRequest("GET", `/api/content-items/${contentItemId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch content item: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!contentItemId && !contentItem,
    retry: 1
  });

  // Use either the passed contentItem or the loaded one
  const currentContentItem = contentItem || loadedContentItem;

  // Fetch the template when coming from a template-launch flow (urlTemplateId is set)
  const { data: launchTemplate } = useQuery({
    queryKey: ["/api/templates", urlTemplateId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/templates/${urlTemplateId}`);
      if (!response.ok) throw new Error(`Failed to fetch template: ${response.status}`);
      return response.json();
    },
    enabled: !!urlTemplateId && !contentItemId && !contentItem,
    retry: 1,
  });

  // Initialize editor from template structure + merge sessionStorage AI content (template-launch flow)
  useEffect(() => {
    if (!urlTemplateId || !launchTemplate) return;

    // Set the selectedTemplate to the URL templateId so save payload includes it
    setSelectedTemplate(urlTemplateId);

    // Build base blocks — prefer typed blocks column (block_id/block_type), fall back to structure
    let baseBlocks: any[];
    if (Array.isArray(launchTemplate.blocks) && launchTemplate.blocks.length > 0) {
      // Use the strongly-typed blocks array so IDs match AI-generated content keys
      baseBlocks = launchTemplate.blocks
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((block: any) => ({
          id: block.block_id,
          type: block.block_type || "paragraph",
          order: block.order ?? 0,
          content: block.block_type === "list"
            ? { items: [""], ordered: false }
            : block.block_type === "cta"
            ? { text: "", buttonText: "Learn more", link: "" }
            : block.block_type === "image"
            ? { url: "", alt: "", caption: "" }
            : { text: "" },
        }));
    } else {
      // Legacy fallback: structure is either an array of objects or an array of strings
      const templateStructure: any[] = Array.isArray(launchTemplate.structure) ? launchTemplate.structure : [];
      baseBlocks = templateStructure.map((block: any, index: number) => {
        if (typeof block === "string") {
          return {
            id: block,
            type: "paragraph",
            order: index,
            content: { text: "" },
          };
        }
        return {
          id: block.id || String(Date.now() + index),
          type: block.type || "text",
          order: index,
          content: block.content || (block.type === "list" ? { items: [""], ordered: false } : { text: "" }),
        };
      });
    }

    // Merge any AI-generated content from sessionStorage
    const storedContent = sessionStorage.getItem(`prelaunch_content_${urlTemplateId}`);
    const storedContext = sessionStorage.getItem(`prelaunch_context_${urlTemplateId}`);

    if (storedContent) {
      try {
        const generatedContent = JSON.parse(storedContent);
        const mergedBlocks = baseBlocks.map((block: any) => {
          if (generatedContent[block.id] !== undefined) {
            setBlockStates(prev => ({ ...prev, [block.id]: "ai_generated" }));
            const updatedContent = typeof block.content === "object"
              ? { ...block.content, text: generatedContent[block.id] }
              : generatedContent[block.id];
            return { ...block, content: updatedContent };
          }
          return block;
        });
        setLocalBlocks(mergedBlocks);
        sessionStorage.removeItem(`prelaunch_content_${urlTemplateId}`);
      } catch (e) {
        console.error("Error parsing prelaunch content", e);
        setLocalBlocks(baseBlocks);
      }
    } else {
      setLocalBlocks(baseBlocks);
    }

    if (storedContext) {
      try {
        const context = JSON.parse(storedContext);
        if (context.mood) setActiveMood(context.mood);
        if (context.description) setContentDescription(context.description);
        sessionStorage.removeItem(`prelaunch_context_${urlTemplateId}`);
      } catch (e) {
        console.error("Error parsing prelaunch context", e);
      }
    }
  }, [urlTemplateId, launchTemplate]);

  // On mount, check sessionStorage for prelaunch content/context (editing existing items)
  useEffect(() => {
    if (urlTemplateId) return; // Handled by the template-launch flow above
    const itemId = contentItemId || currentContentItem?.id;
    if (!itemId) return;

    const prelaunchContentKey = `prelaunch_content_${itemId}`;
    const prelaunchContextKey = `prelaunch_context_${itemId}`;

    const storedContent = sessionStorage.getItem(prelaunchContentKey);
    const storedContext = sessionStorage.getItem(prelaunchContextKey);

    if (storedContent) {
      try {
        const generatedContent = JSON.parse(storedContent);
        setLocalBlocks(prevBlocks => {
          const newBlocks = prevBlocks.map(block => {
            if (generatedContent[block.id]) {
              setBlockStates(prev => ({ ...prev, [block.id]: "ai_generated" }));
              let updatedContent = block.content;
              if (typeof block.content === 'object') {
                 updatedContent = { ...block.content, text: generatedContent[block.id] };
              } else {
                 updatedContent = generatedContent[block.id];
              }
              return { ...block, content: updatedContent };
            }
            return block;
          });
          return newBlocks;
        });
        sessionStorage.removeItem(prelaunchContentKey);
      } catch (e) {
        console.error("Error parsing prelaunch content", e);
      }
    }

    if (storedContext) {
      try {
        const context = JSON.parse(storedContext);
        if (context.mood) setActiveMood(context.mood);
        if (context.description) setContentDescription(context.description);
        sessionStorage.removeItem(prelaunchContextKey);
      } catch (e) {
        console.error("Error parsing prelaunch context", e);
      }
    }
  }, [contentItemId, currentContentItem?.id]);

  // Auto-populate primary keyword and article angle from URL param (keyword-first flow)
  useEffect(() => {
    if (!urlKeywordId) return;
    apiRequest("GET", `/api/keywords?search=`).then(async (res) => {
      if (!res.ok) return;
      const allKeywords = await res.json();
      const kw = allKeywords.find((k: any) => String(k.id) === urlKeywordId);
      if (kw && kw.keyword) {
        setPrimaryKeyword(kw.keyword);
      }
      if (kw?.articleAngle) {
        setArticleAngle(kw.articleAngle);
      }
      if (kw?.type) {
        setKeywordType(kw.type);
      }
    }).catch(() => {});
  }, [urlKeywordId]);

  // Update block states for "needs_input"
  useEffect(() => {
    const newStates = { ...blockStates };
    localBlocks.forEach(block => {
      if (newStates[block.id]) return; // Already has a state (like ai_generated)

      if (block.type === 'image') {
        if (!block.content?.url && !block.content?.src) {
          newStates[block.id] = "needs_input";
        }
      } else if (block.type === 'promo_code') {
        if (!block.content?.code) {
          newStates[block.id] = "needs_input";
        }
      }
    });
    // Only update if something changed to avoid infinite loops
    if (JSON.stringify(newStates) !== JSON.stringify(blockStates)) {
      setBlockStates(newStates);
    }
  }, [localBlocks]);

  // Update form state when content item loads
  useEffect(() => {
    if (currentContentItem) {
      // Show the raw title as-is in the editor so users can see and edit quotes
      const rawTitle = currentContentItem.title || "";
      console.log('📝 Loading title for editing:', rawTitle);
      setTitle(rawTitle);
      setSlug(currentContentItem.slug || "");
      setMetaDescription(currentContentItem.metaDescription || "");
      setPrimaryKeyword(currentContentItem.primaryKeyword || "");
      setSupportingKeywords(currentContentItem.supportingKeywords || "");
      setFeaturedImage(currentContentItem.featuredImage || "");
      setStatus(currentContentItem.status || "draft");
      const spd = currentContentItem.scheduledPublishDate;
      setScheduledDate(spd ? (spd instanceof Date ? spd.toISOString() : String(spd)).split('T')[0] : "");
      setSelectedTemplate(currentContentItem.templateId || "default");
      setOgTitle(currentContentItem.ogTitle || "");
      setOgImage(currentContentItem.ogImage || "");
      setCanonicalUrl(currentContentItem.canonicalUrl || "");
      setPageTemplate(currentContentItem.pageTemplate || "default");
      setRedirectFrom(Array.isArray(currentContentItem.redirectFrom) ? currentContentItem.redirectFrom.join(", ") : (currentContentItem.redirectFrom || ""));
      setStructuredDataType(currentContentItem.structuredDataType || "None");
      // Restore existing structured data (FAQ, products, CTAs) so saves don't overwrite it
      if (currentContentItem.structuredData && typeof currentContentItem.structuredData === 'object' && !Array.isArray(currentContentItem.structuredData)) {
        setGeneratedStructuredData(currentContentItem.structuredData as object);
      }

      // For web page types: determine markdown mode vs legacy block mode
      const subtype = currentContentItem.contentType || currentContentItem.type;
      const isWebType = !subtype?.startsWith?.("email") && subtype !== "email";
      if (isWebType) {
        const storedMarkdown = currentContentItem.markdownContent || (typeof currentContentItem.content === 'string' ? currentContentItem.content : "");
        const hasExistingBlocks = Array.isArray(currentContentItem.content) && currentContentItem.content.length > 0;

        // Markdown mode: item has stored markdown OR it has no blocks (new page)
        // Legacy block mode: item has existing block JSON but no markdown
        const shouldUseMarkdownMode = !!storedMarkdown || !hasExistingBlocks;
        setIsMarkdownMode(shouldUseMarkdownMode);

        if (shouldUseMarkdownMode) {
          setMarkdownContent(storedMarkdown);
          if (storedMarkdown) {
            import("marked").then(({ marked }) => {
              Promise.resolve(marked(storedMarkdown)).then(html => setMarkdownPreviewHtml(html as string));
            });
          }
          return; // Don't parse blocks for markdown mode
        }
        // Fall through to block parsing for legacy block pages
      }

      // Parse content blocks (email types and legacy block-based web pages)
      if (currentContentItem.content && Array.isArray(currentContentItem.content)) {
        const blocks = currentContentItem.content.map((block: any, index: number) => ({
          ...block,
          id: block.id || Date.now() + index,
          order: block.order ?? index,
        }));
        setLocalBlocks(blocks);
      } else if (currentContentItem.content) {
        // If content is not an array, try to parse it as JSON or handle as a single block
        try {
          const parsedContent = JSON.parse(currentContentItem.content);
          if (Array.isArray(parsedContent)) {
            const blocks = parsedContent.map((block: any, index: number) => ({
              ...block,
              id: block.id || Date.now() + index,
              order: block.order ?? index,
            }));
            setLocalBlocks(blocks);
          } else {
            // Assume it's a single block if not an array
            setLocalBlocks([{ id: Date.now(), type: 'paragraph', order: 0, content: parsedContent }]);
          }
        } catch (e) {
          // If it's not JSON, treat as plain text content
          setLocalBlocks([{ id: Date.now(), type: 'paragraph', order: 0, content: { text: String(currentContentItem.content) } }]);
        }
      }
    }
  }, [currentContentItem]);

  // Derive the effective content_type (subtype like blog_article) from template, existing item, or URL param
  const effectiveContentType = (() => {
    // If we have a loaded template (template-launch flow), use its type
    if (launchTemplate?.type) return launchTemplate.type;
    // If editing an existing item, prefer contentType (subtype) over top-level type
    if (currentContentItem) {
      const subtype = currentContentItem.contentType || currentContentItem.type;
      if (subtype && subtype !== 'webpage' && subtype !== 'email') return subtype;
    }
    // If a URL type param was provided, resolve it
    if (type) {
      if (type === "blog") return "blog_article";
      if (type === "landing") return "landing_page";
      if (type === "webpage") return "blog_article"; // fallback
      if (type === "email") return "email_campaign"; // fallback
      return type;
    }
    return "blog_article";
  })();

  // Fetch all templates for the category: all email types or all web page types
  const isEmailContentType = ['email_campaign', 'email_flow'].includes(effectiveContentType);
  const { data: templates = [] } = useQuery({
    queryKey: ["/api/templates", isEmailContentType ? "email-group" : "web-group"],
    queryFn: async () => {
      if (isEmailContentType) {
        const [campaign, flow] = await Promise.all([
          apiRequest("GET", "/api/templates?type=email_campaign").then(r => r.json()),
          apiRequest("GET", "/api/templates?type=email_flow").then(r => r.json()),
        ]);
        return [...campaign, ...flow];
      } else {
        const [blog, landing, lead] = await Promise.all([
          apiRequest("GET", "/api/templates?type=blog_article").then(r => r.json()),
          apiRequest("GET", "/api/templates?type=landing_page").then(r => r.json()),
          apiRequest("GET", "/api/templates?type=lead_magnet").then(r => r.json()),
        ]);
        return [...blog, ...landing, ...lead];
      }
    }
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const itemId = contentItemId || currentContentItem?.id;
      const endpoint = itemId
        ? `/api/content-items/${itemId}`
        : "/api/content-items";
      const method = itemId ? "PATCH" : "POST";

      const response = await apiRequest(method, endpoint, data);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Clear auth cache and redirect to login
          queryClient.setQueryData(["/api/auth/me"], null);
          throw new Error("Session expired. Please log in again.");
        }
        const errorText = await response.text();
        throw new Error(`Save failed: ${response.status} ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const wasCreate = !(contentItemId || currentContentItem?.id);
      toast({
        title: "Success",
        description: `${wasCreate ? 'Article created' : 'Content updated'} with ${localBlocks.length} blocks saved`,
      });
      
      // Invalidate all content-related queries to ensure pages refresh automatically
      queryClient.invalidateQueries({ queryKey: ["/api/content-items"] });
      
      // Invalidate specific queries for different content types
      const contentType = type || currentContentItem?.type || data?.type;
      if (contentType) {
        queryClient.invalidateQueries({ queryKey: ["/api/content-items", contentType] });
      }
      
      // Invalidate the specific item query if editing
      const itemId = contentItemId || currentContentItem?.id || data?.id;
      if (itemId) {
        queryClient.invalidateQueries({ queryKey: ["/api/content-items", itemId] });
      }
      
      // Force refetch of content lists across all pages
      queryClient.refetchQueries({ queryKey: ["/api/content-items"] });

      // If a keyword was selected in the creation flow, link this content item to it
      if (wasCreate && urlKeywordId && data?.id) {
        apiRequest("PATCH", `/api/keywords/${urlKeywordId}`, {
          contentItemId: String(data.id),
          status: "in_progress",
        }).catch(() => {});
      }
      
      if (onSave) onSave(data);
      if (onClose) onClose();

      // After a CREATE, redirect to the item's permanent URL so further edits use PATCH
      if (wasCreate && data?.id && !onClose) {
        const savedType = data?.type || type || "";
        if (savedType.startsWith("email")) {
          setLocation(`/email-builder/${data.id}`);
        } else {
          setLocation(`/pages/builder/${data.id}`);
        }
      }
    },
    onError: (error: any) => {
      console.error('❌ Save error:', error);
      toast({
        title: "Error",
        description: error.message || "Couldn't save your changes. Please try again.",
        variant: "destructive",
      });
    },
  });

  // AI Generation mutations
  const generateTitle = useMutation({
    mutationFn: async () => {
      // Check authentication before making AI requests
      if (!user) {
        throw new Error("Please log in to use AI features");
      }
      // Fix: Extract text content from blocks properly instead of joining objects
      const contextContent = localBlocks.length > 0
        ? localBlocks.map((b: any) => {
            if (b.content && typeof b.content === 'object') {
              return b.content.text || b.content.html || String(b.content);
            }
            return String(b.content || '');
          }).join(" ").slice(0, 1000)
        : "";

      // Get template details for context
      let templateContext = "";
      if (selectedTemplate !== "default") {
        const template = templates.find((t: any) => t.id === selectedTemplate);
        if (template) {
          templateContext = template.name;
        }
      }

      const response = await apiRequest("POST", "/api/ai/generate-title", {
        content: contextContent,
        type: effectiveContentType,
        primaryKeyword: primaryKeyword || "",
        supportingKeywords: supportingKeywords || "",
        metaDescription: metaDescription || "",
        templateContext: templateContext
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Clear auth cache and redirect to login
          queryClient.setQueryData(["/api/auth/me"], null);
          throw new Error("Session expired. Please log in again.");
        }
        const errorText = await response.text();
        throw new Error(`Title generation failed: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      if (!result.title) {
        throw new Error("No title returned from AI service");
      }
      return result.title;
    },
    onSuccess: (generatedTitle) => {
      setTitle(generatedTitle);
      toast({
        title: "Title Generated",
        description: "Here's a new AI-generated title for your article",
      });
    },
  });

  const generateSummary = useMutation({
    mutationFn: async () => {
      // Check authentication before making AI requests
      if (!user) {
        throw new Error("Please log in to use AI features");
      }
      // Fix: Extract text content from blocks properly instead of joining objects
      const contextContent = localBlocks.length > 0
        ? localBlocks.map((b: any) => {
            if (b.content && typeof b.content === 'object') {
              return b.content.text || b.content.html || String(b.content);
            }
            return String(b.content || '');
          }).join(" ").slice(0, 2000)
        : "";

      const response = await apiRequest("POST", "/api/ai/generate-summary", {
        title: title,
        content: contextContent,
        type: effectiveContentType,
        primaryKeyword: primaryKeyword || ""
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Clear auth cache and redirect to login
          queryClient.setQueryData(["/api/auth/me"], null);
          throw new Error("Session expired. Please log in again.");
        }
        const errorText = await response.text();
        throw new Error(`Summary generation failed: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      if (!result.summary) {
        throw new Error("No summary returned from AI service");
      }
      return result.summary;
    },
    onSuccess: (generatedSummary) => {
      setMetaDescription(generatedSummary);
      toast({
        title: "Meta Description Generated",
        description: "Here's an AI-generated meta description for your article",
      });
    },
  });

  const generateWebPageMarkdownMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to use AI features");
      if (!title.trim()) throw new Error("Enter a title first");
      const response = await apiRequest("POST", "/api/ai/generate-webpage-markdown", {
        title: title.trim(),
        type: effectiveContentType,
        primaryKeyword: primaryKeyword || undefined,
        supportingKeywords: supportingKeywords || undefined,
        articleAngle: articleAngle || undefined,
        mood: activeMood || "conversational",
        keywordType: keywordType || undefined,
        format: contentFormat !== 'auto' ? contentFormat : undefined,
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Generation failed: ${response.status} ${errText}`);
      }
      const result = await response.json();
      if (!result.markdown) throw new Error("No markdown returned from AI");
      return result as { markdown: string; structuredData?: object; featuredImageUrl?: string | null; metaDescription?: string | null };
    },
    onSuccess: async (result) => {
      setMarkdownContent(result.markdown);
      if (result.structuredData) {
        setGeneratedStructuredData(result.structuredData);
        setStructuredDataType("Article");
      }
      // Apply auto-generated meta description if the server returned one
      if (result.metaDescription) {
        setMetaDescription(result.metaDescription);
      }
      // Apply auto-generated featured image if the server returned one
      if (result.featuredImageUrl) {
        setFeaturedImage(result.featuredImageUrl);
      }
      // Persist meta description and featured image to the DB right away — fire and forget
      const itemId = contentItemId || currentContentItem?.id;
      if (itemId && (result.metaDescription || result.featuredImageUrl)) {
        apiRequest("PATCH", `/api/content-items/${itemId}`, {
          ...(result.metaDescription ? { metaDescription: result.metaDescription } : {}),
          ...(result.featuredImageUrl ? { featuredImage: result.featuredImageUrl } : {}),
        }).catch(() => {});
      }
      setHasUnsavedChanges(true);
      const { marked } = await import("marked");
      const html = await marked(result.markdown);
      setMarkdownPreviewHtml(html as string);
      const faqCount = (result.structuredData as any)?._wt_faq?.length ?? 0;
      const productCount = (result.structuredData as any)?._wt_products?.length ?? 0;
      const extras = [faqCount > 0 && `${faqCount} FAQ`, productCount > 0 && `${productCount} product cards`].filter(Boolean).join(', ');
      const imageNote = result.featuredImageUrl ? " + hero image" : "";
      const metaNote = result.metaDescription ? " + meta description" : "";
      toast({ title: "Content Generated", description: extras ? `Article + ${extras}${imageNote}${metaNote} ready. Review and save.` : `Article${imageNote}${metaNote} ready. Review and edit the markdown, then save.` });
    },
    onError: (error: any) => {
      toast({ title: "Generation Failed", description: error.message || "Could not generate content", variant: "destructive" });
    },
  });

  const generateFullArticle = useMutation({
    mutationFn: async () => {
      // Check authentication before making AI requests
      if (!user) {
        throw new Error("Please log in to use AI features");
      }
      console.log('Starting article generation with:', {
        title,
        selectedTemplate,
        primaryKeyword,
        supportingKeywords,
        metaDescription,
        existingBlocksCount: localBlocks.length
      });

      // Handle template fetching - skip for "default" template
      let template = null;
      if (selectedTemplate !== "default") {
        try {
          const templateResponse = await apiRequest("GET", `/api/templates/${selectedTemplate}`);
          if (templateResponse.ok) {
            template = await templateResponse.json();
            console.log('Fetched template:', template);
          } else {
            console.warn('Failed to fetch template, using default');
          }
        } catch (error) {
          console.warn('Template fetch error, using default:', error);
        }
      }

      const requestData = {
        title: title,
        type: effectiveContentType,
        primaryKeyword: primaryKeyword,
        supportingKeywords: supportingKeywords,
        articleAngle: articleAngle || null,
        metaDescription: metaDescription,
        templateId: selectedTemplate,
        systemPrompt: template?.system_prompt,
        userPromptAddition: template?.user_prompt_addition,
        structure: template?.structure,
        existingContent: localBlocks.length > 0 ? localBlocks : null
      };

      // Don't use JSON.parse/stringify - just send the data directly
      console.log('🚀 Sending request data:', requestData);

      const response = await apiRequest("POST", "/api/ai/generate-complete-article", requestData);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Clear auth cache and redirect to login
          queryClient.setQueryData(["/api/auth/me"], null);
          throw new Error("Session expired. Please log in again.");
        }
        const errorText = await response.text();
        throw new Error(`Article generation failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Received AI response:', result);

      if (!result.sections || !Array.isArray(result.sections)) {
        console.error('Invalid AI response structure:', result);
        throw new Error('Invalid response from AI service');
      }

      // The AI service should now return Markdown content in sections.content.text
      // We need to parse this Markdown into blocks.
      const blocks = result.sections.map((section: any, index: number) => {
        // Create a plain object with null prototype
        const cleanBlock = Object.create(null);
        cleanBlock.id = Date.now() + index;
        cleanBlock.type = section.type || "paragraph"; // Default to paragraph if type is missing
        cleanBlock.order = index;

        // Directly use the markdown content from the AI response
        const markdownContent = section.content && typeof section.content === 'object' ? section.content.text : String(section.content || '');

        // For simplicity, we'll treat most markdown as paragraph text for now.
        // A more robust solution would involve a markdown parser here.
        let blockContent: any;
        if (section.type === "heading") {
          blockContent = { text: markdownContent };
        } else if (section.type === "list") {
          // Assuming markdown list items are returned as a single string, split them
          // Fix: Check if markdownContent is valid before splitting
          const items = markdownContent && typeof markdownContent === 'string' 
            ? markdownContent.split('\n').filter((item: string) => item.trim().startsWith('*') || item.trim().startsWith('-')).map((item: string) => item.replace(/^[\*\-]\s*/, ''))
            : [];
          blockContent = { items: items };
        } else if (section.type === "image") {
          // Only use the URL if it looks like a real image URL; otherwise leave blank
          const rawUrl = section.content?.url || "";
          const isValidUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
          blockContent = {
            url: isValidUrl ? rawUrl : "",
            alt: section.content?.alt || markdownContent || "Image",
            caption: section.content?.caption || ""
          };
        } else if (section.type === "quote") {
          // Similar to image, parse markdown blockquotes > quote \n - author
          // Fix: Check if markdownContent is valid before splitting
          const lines = markdownContent && typeof markdownContent === 'string' ? markdownContent.split('\n') : [''];
          const quoteText = lines[0].replace(/^>\s*/, '');
          const author = lines.length > 1 && lines[1].startsWith('- ') ? lines[1].substring(2) : "";
          blockContent = { text: quoteText, author: author };
        } else if (section.type === "cta") {
           // Parse markdown for CTA: Button text, link
          const ctaMatch = markdownContent.match(/\[(.*?)\]\((.*?)\)/);
          const buttonText = ctaMatch ? ctaMatch[1] : "Learn More";
          const link = ctaMatch ? ctaMatch[2] : "#";
          blockContent = { text: markdownContent.replace(/\[(.*?)\]\(.*?\)/, '').trim(), buttonText: buttonText, link: link };
        }
        else {
          blockContent = { text: markdownContent };
        }

        cleanBlock.content = blockContent;
        return cleanBlock;
      });

      // CRITICAL FIX: Actually update the editor with the generated blocks!
      setLocalBlocks(blocks);
      setHasUnsavedChanges(true);

      // Apply the auto-generated featured image if the server returned one
      if (result.featuredImageUrl) {
        setFeaturedImage(result.featuredImageUrl);
      }

      // Read server-provided image suggestions attached to image blocks
      // Use index-based match: blocks[] is built from result.sections[] in the same order
      const serverSuggestions: Record<string, ImageSuggestion> = {};
      result.sections.forEach((section: any, sectionIdx: number) => {
        if (section.type === 'image' && Array.isArray(section.suggestedImages) && section.suggestedImages.length > 0) {
          const clientBlock = blocks[sectionIdx];
          if (clientBlock) {
            serverSuggestions[clientBlock.id] = section.suggestedImages[0] as ImageSuggestion;
          }
        }
      });
      if (Object.keys(serverSuggestions).length > 0) {
        setImageSuggestions(prev => ({ ...prev, ...serverSuggestions }));
      }

      toast({
        title: "Content Generated",
        description: `Generated ${blocks.length} content sections successfully${result.featuredImageUrl ? " with a featured image" : ""}. ${contentItemId ? 'Save your changes to keep them.' : 'Save as draft to create the article.'}`,
      });
    },
    onError: (error) => {
      console.error('Article generation failed:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate article content",
        variant: "destructive",
      });
    }
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const itemId = contentItemId || currentContentItem?.id;
      if (!itemId) throw new Error("Save the page first before regenerating.");
      const res = await apiRequest("POST", `/api/pages/${itemId}/regenerate`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Regeneration failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const itemId = contentItemId || currentContentItem?.id;
      queryClient.invalidateQueries({ queryKey: ["/api/content-items", String(itemId)] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-items"] });
      setShowRegenerateConfirm(false);
      toast({ title: "Page regenerated", description: `"${data.title}" has been rebuilt from scratch.` });
    },
    onError: (error: any) => {
      setShowRegenerateConfirm(false);
      toast({ title: "Regeneration failed", description: error.message, variant: "destructive" });
    },
  });

  const generateImageMutation = useMutation({
    mutationFn: async () => {
      const itemId = contentItemId || currentContentItem?.id;
      if (!itemId) throw new Error("Save the page first before generating an image.");
      const res = await apiRequest("POST", `/api/content-items/${itemId}/generate-featured-image`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Image generation failed");
      }
      return res.json() as Promise<{ featuredImageUrl: string; model: string }>;
    },
    onSuccess: (data) => {
      setFeaturedImage(data.featuredImageUrl);
      setHasUnsavedChanges(true);
      const itemId = contentItemId || currentContentItem?.id;
      queryClient.invalidateQueries({ queryKey: ["/api/content-items", String(itemId)] });
      toast({ title: "Image generated", description: "Featured image has been set and saved." });
    },
    onError: (error: any) => {
      toast({ title: "Image generation failed", description: error.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const itemId = contentItemId || currentContentItem?.id;
      if (!itemId) throw new Error("Save the article first before publishing.");
      const res = await apiRequest("POST", "/api/publish/supabase", {
        contentId: itemId,
        featuredImage: featuredImage || undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Publish failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setStatus("live");
      const itemId = contentItemId || currentContentItem?.id;
      queryClient.invalidateQueries({ queryKey: ["/api/content-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-items", String(itemId)] });
      toast({ title: "Published", description: "Article is live. The hero image and all SEO fields have been synced." });
    },
    onError: (error: any) => {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
    },
  });

  const addBlockWithContent = (type: string, initialContent: Record<string, any>) => {
    const nextOrder = localBlocks.length === 0 ? 0 : Math.max(...localBlocks.map((b: any) => b.order ?? 0)) + 1;
    const newBlock = {
      id: Date.now().toString(),
      type,
      content: initialContent,
      order: nextOrder
    };
    setLocalBlocks([...localBlocks, newBlock]);
    setHasUnsavedChanges(true);
  };

  const addBlock = (type: string) => {
    const defaultContent: Record<string, any> = {
      heading:        { text: "", level: 2 },
      paragraph:      { text: "" },
      image:          { url: "", alt: "", caption: "", widthMode: "full", align: "center" },
      list:           { items: [""], ordered: false },
      quote:          { text: "", author: "" },
      cta:            { text: "", buttonText: "Learn more", link: "", style: "button" },
      divider:        { style: "line", color: "#e0d8d2", height: 1 },
      promo_code:       { code: "", headline: "", expires: "" },
      countdown_timer:  { deadline: "", fallback_text: "" },
      testimonial:      { quote: "", author: "", rating: 5, avatar_url: "" },
      spacer:         { height: 40 },
      // Web-only blocks
      hero:           { headline: "", subtext: "", imageUrl: "", imageAlt: "", ctaText: "", ctaLink: "" },
      two_column:     { leftBlocks: [], rightBlocks: [] },
      accordion:      { items: [{ question: "", answer: "" }] },
      banner:         { text: "", style: "info", link: "", linkText: "" },
      icon_text_row:  { items: [{ icon: "", headline: "", body: "" }, { icon: "", headline: "", body: "" }, { icon: "", headline: "", body: "" }], columns: 3 },
      author_bio:     { name: "", avatarUrl: "", bio: "", links: [] },
      breadcrumb:     { items: [{ label: "Home", url: "/" }] },
      related_content:{ items: [{ title: "", url: "", image: "", contentType: "" }] },
      // Email-only blocks
      product_feature:  { name: "", imageUrl: "", imageAlt: "", description: "", price: "", ctaText: "", ctaLink: "" },
      product_row:      { products: [] },
      email_promo_code:       { code: "", headline: "", expiry: "", instructions: "" },
      review:           { quote: "", author: "", rating: 5 },
      ugc_review:       { layout: "left", backgroundColor: "#e8643a", textColor: "#ffffff", rating: 5, title: "", body: "", attribution: "" },
      image_text:       { layout: "image_left", imageUrl: "", imageAlt: "", heading: "", body: "", textAlign: "left", textColor: "#333333", textBgColor: "#ffffff", ctaText: "", ctaLink: "" },
      image_row:        { images: [{ url: "", alt: "", caption: "" }] },
      gif_image:        { url: "", fallbackUrl: "", alt: "", width: 552 },
      email_countdown_timer:  { endDatetime: "", label: "", style: "light" },
      progress_loyalty: { label: "", current: 0, goal: 100, unit: "", color: "#c9a227" },
      // Shopify blocks (web-only)
      shopify_product_card:      { productId: "", ctaText: "Shop Now", ctaLink: "", showDescription: true, showPrice: true },
      shopify_product_grid:      { collectionId: "", itemCount: 8, sortOrder: "default" },
      shopify_collection_feature:{ collectionId: "", headline: "", subtext: "", ctaText: "Shop the Collection", ctaLink: "", imageUrl: "", style: "light" },
      shopify_variant_selector:  { productId: "", selectorType: "all", ctaText: "Add to Bag", ctaLink: "" },
      shopify_page:              { pageId: "", title: "", handle: "", bodySummary: "", url: "", titleOverride: "", excerptOverride: "", ctaText: "Read More" },
      shopify_image:             { url: "", alt: "" },
      // App Block (interactive registered component)
      app_block:                 { componentName: "", config: {} },
      // HTML Block (admin/developer only)
      html_block:                { html: "" },
    };
    const nextOrder = localBlocks.length === 0 ? 0 : Math.max(...localBlocks.map((b: any) => b.order ?? 0)) + 1;
    const newBlock = {
      id: Date.now().toString(),
      type,
      content: defaultContent[type] ?? { text: "" },
      order: nextOrder
    };
    setLocalBlocks([...localBlocks, newBlock]);
    setHasUnsavedChanges(true);
  };

  const updateBlock = (blockId: string, content: any) => {
    setLocalBlocks(localBlocks.map((block: any) =>
      block.id === blockId ? { ...block, content } : block
    ));
    setHasUnsavedChanges(true);
  };

  const updateBlockMeta = (blockId: string, patch: Record<string, any>) => {
    setLocalBlocks(localBlocks.map((block: any) =>
      block.id === blockId ? { ...block, ...patch } : block
    ));
    setHasUnsavedChanges(true);
  };

  const deleteBlock = (blockId: string) => {
    setLocalBlocks(localBlocks.filter((block: any) => block.id !== blockId));
    setHasUnsavedChanges(true);
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const sorted = [...localBlocks].sort((a: any, b: any) => a.order - b.order);
    const idx = sorted.findIndex((b: any) => b.id === blockId);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    // Swap positions in the array, then re-stamp clean sequential orders.
    // This avoids bugs caused by duplicate or non-sequential order values.
    const reordered = [...sorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const newBlocks = reordered.map((b: any, i: number) => ({ ...b, order: i }));
    setLocalBlocks(newBlocks);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    try {
      console.log('💾 Starting save process...');
      console.log('ContentEditor - currentContentItem:', currentContentItem);

      // CRITICAL FIX: Allow saving new content items even without currentContentItem
      if (!title.trim()) {
        toast({
          title: "Title Required",
          description: "Please enter a title before saving",
          variant: "destructive",
        });
        return;
      }

      setSaving(true);

      // Clean the content to remove any prototype pollution
      let cleanContent;
      if (Array.isArray(localBlocks)) { // Use localBlocks as it's the source of truth for the editor state
        console.log('🧼 Cleaning array content...');
        // Sort by order before saving so the JSON array order matches the visual order
        const sortedBlocks = [...localBlocks].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        cleanContent = sortedBlocks.map((block: any) => {
          // Create a plain object with only the properties we need
          const cleanBlockContent: Record<string, unknown> = {};
          const cleanBlock: Record<string, unknown> = {
            id: block.id,
            type: block.type,
            order: block.order,
            content: cleanBlockContent
          };
          // Preserve _bg if present
          if (block._bg && typeof block._bg === 'object') {
            const bg: Record<string, unknown> = {};
            if (block._bg.color) bg.color = String(block._bg.color);
            if (block._bg.imageUrl) bg.imageUrl = String(block._bg.imageUrl);
            if (block._bg.imageSize) bg.imageSize = String(block._bg.imageSize);
            if (block._bg.fallbackColor) bg.fallbackColor = String(block._bg.fallbackColor);
            if (block._bg.paddingTop !== undefined) bg.paddingTop = Number(block._bg.paddingTop);
            if (block._bg.paddingRight !== undefined) bg.paddingRight = Number(block._bg.paddingRight);
            if (block._bg.paddingBottom !== undefined) bg.paddingBottom = Number(block._bg.paddingBottom);
            if (block._bg.paddingLeft !== undefined) bg.paddingLeft = Number(block._bg.paddingLeft);
            if (Object.keys(bg).length > 0) cleanBlock._bg = bg;
          }

          // Safely copy content properties
          const EMAIL_COMPLEX_TYPES = new Set([
            'product_feature', 'product_row', 'promo_code', 'review', 'ugc_review', 'image_text', 'image_row',
            'gif_image', 'countdown_timer', 'progress_loyalty',
            'hero', 'two_column', 'accordion', 'banner', 'icon_text_row',
            'author_bio', 'breadcrumb', 'related_content',
            'divider', 'spacer', 'cta', 'quote',
            'shopify_product_card', 'shopify_product_grid',
            'shopify_collection_feature', 'shopify_variant_selector',
            'shopify_page', 'shopify_image',
            'app_block', 'html_block',
          ]);
          if (block.content && typeof block.content === 'object') {
            const contentObj = block.content as Record<string, unknown>;
            if (EMAIL_COMPLEX_TYPES.has(block.type)) {
              // Pass through all fields as-is for complex block types
              Object.assign(cleanBlockContent, contentObj);
            } else {
              if (contentObj.html !== undefined) cleanBlockContent.html = String(contentObj.html);
              if (contentObj.text !== undefined) cleanBlockContent.text = String(contentObj.text);
              if (contentObj.items !== undefined) cleanBlockContent.items = Array.isArray(contentObj.items) ? contentObj.items.map(String) : [String(contentObj.items)];
              if (contentObj.url !== undefined) cleanBlockContent.url = String(contentObj.url);
              if (contentObj.alt !== undefined) cleanBlockContent.alt = String(contentObj.alt);
              if (contentObj.caption !== undefined) cleanBlockContent.caption = String(contentObj.caption);
              // Image width/align
              if (contentObj.widthMode !== undefined) cleanBlockContent.widthMode = String(contentObj.widthMode);
              if (contentObj.customWidth !== undefined) { const cw = Number(contentObj.customWidth); if (Number.isFinite(cw) && cw > 0) cleanBlockContent.customWidth = cw; }
              if (contentObj.align !== undefined) cleanBlockContent.align = String(contentObj.align);
              if (contentObj.author !== undefined) cleanBlockContent.author = String(contentObj.author);
              if (contentObj.buttonText !== undefined) cleanBlockContent.buttonText = String(contentObj.buttonText);
              if (contentObj.link !== undefined) cleanBlockContent.link = String(contentObj.link);
              // Heading
              if (contentObj.level !== undefined) cleanBlockContent.level = Number(contentObj.level) || 2;
              // List
              if (contentObj.ordered !== undefined) cleanBlockContent.ordered = Boolean(contentObj.ordered);
              // Divider
              if (contentObj.style !== undefined) cleanBlockContent.style = String(contentObj.style);
              if (contentObj.spacing !== undefined) cleanBlockContent.spacing = String(contentObj.spacing);
              // Spacer
              if (contentObj.height !== undefined) {
                const h = Number(contentObj.height);
                cleanBlockContent.height = Number.isFinite(h) && h >= 8 && h <= 400 ? h : 40;
              }
              // Text styling properties
              if (contentObj.textColor !== undefined) cleanBlockContent.textColor = String(contentObj.textColor);
              if (contentObj.backgroundColor !== undefined) cleanBlockContent.backgroundColor = String(contentObj.backgroundColor);
              if (contentObj.backgroundImageUrl !== undefined) cleanBlockContent.backgroundImageUrl = String(contentObj.backgroundImageUrl);
              if (contentObj.fontFamily !== undefined) cleanBlockContent.fontFamily = String(contentObj.fontFamily);
              if (contentObj.fontSize !== undefined) cleanBlockContent.fontSize = String(contentObj.fontSize);
              if (contentObj.fontWeight !== undefined) cleanBlockContent.fontWeight = String(contentObj.fontWeight);
              if (contentObj.textAlign !== undefined) cleanBlockContent.textAlign = String(contentObj.textAlign);
              if (contentObj.fontStyle !== undefined) cleanBlockContent.fontStyle = String(contentObj.fontStyle);
              if (contentObj.textDecoration !== undefined) cleanBlockContent.textDecoration = String(contentObj.textDecoration);
              if (contentObj.textTransform !== undefined) cleanBlockContent.textTransform = String(contentObj.textTransform);
              if (contentObj.minHeight !== undefined) cleanBlockContent.minHeight = String(contentObj.minHeight);
              // Image src alias
              if (contentObj.src !== undefined) cleanBlockContent.src = String(contentObj.src);
            }
          } else if (typeof block.content === 'string') {
            cleanBlock.content = { text: block.content };
          } else {
            cleanBlock.content = { text: '' };
          }

          return cleanBlock;
        });
        console.log('🧼 Cleaned content blocks:', cleanContent.length);
      } else {
        cleanContent = localBlocks; // Fallback if localBlocks is not an array
      }

      const autoSlug = title.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .replace(/--+/g, '-');

      const updateData: Record<string, any> = {
        title: title.trim(),
        slug: slug.trim() || autoSlug,
        metaDescription: metaDescription.trim(),
        primaryKeyword: primaryKeyword.trim(),
        supportingKeywords: supportingKeywords.trim(),
        featuredImage: featuredImage,
        ogTitle: ogTitle.trim() || null,
        ogImage: ogImage.trim() || null,
        canonicalUrl: canonicalUrl.trim() || null,
        pageTemplate: pageTemplate || "default",
        redirectFrom: redirectFrom.trim() ? redirectFrom.split(",").map(s => s.trim()).filter(Boolean) : null,
        structuredDataType: structuredDataType || "Article",
        status: status,
        scheduledDate: status === "scheduled" ? scheduledDate : null,
        type: effectiveContentType,
        templateId: selectedTemplate,
      };

      if (isMarkdownMode) {
        // Markdown-backed web page: send markdown, clear block content
        updateData.markdownContent = markdownContent;
        updateData.content = null;
        // Persist generated structured data (FAQ, product cards, etc.) if present
        if (generatedStructuredData) {
          updateData.structuredData = generatedStructuredData;
          delete updateData.structuredDataType; // don't let PATCH overwrite with bare skeleton
        }
      } else {
        // Email or legacy block-based web page: send blocks, preserve existing behavior
        updateData.content = cleanContent;
      }

      console.log('🔍 Update data being sent (cleaned):', JSON.stringify(updateData, null, 2));

      // Use the saveMutation instead of direct API calls to get consistent 401 handling
      await saveMutation.mutateAsync(updateData);
      
      setHasUnsavedChanges(false); // Reset unsaved changes flag on successful save
    } catch (error: any) {
      console.error('❌ Save error:', error);
      toast({
        title: "Save Error",
        description: error.message || "An unexpected error occurred while saving.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const applyProductImageChange = (handle: string, oldUrl: string, newUrl: string) => {
    const updated = markdownContent.replace(
      new RegExp(`!\\[([^\\]]*)\\]\\(${oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g"),
      `![$1](${newUrl})`
    );
    setMarkdownContent(updated);
    setHasUnsavedChanges(true);
    import("marked").then(async ({ marked }) => {
      const html = await Promise.resolve(marked(updated));
      setMarkdownPreviewHtml(html as string);
    });
    const updatedSD = JSON.parse(JSON.stringify(generatedStructuredData));
    const p = updatedSD._wt_products?.find((p: any) => p.handle === handle);
    if (p) p.imageUrl = newUrl;
    setGeneratedStructuredData(updatedSD);
    setPickerProduct(prev => prev ? { ...prev, currentImageUrl: newUrl } : null);
    toast({ title: "Image updated", description: "Save the article to keep this change." });
  };

  const handleHeroFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setHeroUploadLoading(true);
      try {
        const res = await apiRequest("POST", "/api/media/upload", { dataUrl });
        const data = await res.json();
        if (data.url) {
          setFeaturedImage(data.url);
          setHasUnsavedChanges(true);
          setHeroPickerOpen(false);
          toast({ title: "Image uploaded" });
        } else throw new Error(data.message || "Upload failed");
      } catch (err) {
        toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
      } finally {
        setHeroUploadLoading(false);
        if (heroFileInputRef.current) heroFileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProductFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !pickerProduct) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPickerUploadLoading(true);
      try {
        const res = await apiRequest("POST", "/api/media/upload", { dataUrl });
        const data = await res.json();
        if (data.url) {
          applyProductImageChange(pickerProduct.handle, pickerProduct.currentImageUrl, data.url);
        } else throw new Error(data.message || "Upload failed");
      } catch (err) {
        toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
      } finally {
        setPickerUploadLoading(false);
        if (productFileInputRef.current) productFileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAssetSelect = (asset: any) => {
    if (cloudinaryTarget === 'product' && pickerProduct) {
      applyProductImageChange(pickerProduct.handle, pickerProduct.currentImageUrl, asset.secure_url);
    } else {
      setFeaturedImage(asset.secure_url);
      setHeroPickerOpen(false);
    }
    setIsAssetSelectorOpen(false);
    setHasUnsavedChanges(true);
  };

  const handleBlockImageSelect = (asset: any) => {
    if (!imageBlockId) return;
    setLocalBlocks(localBlocks.map((block: any) =>
      block.id === imageBlockId
        ? { ...block, content: { ...(block.content || {}), url: asset.secure_url } }
        : block
    ));
    setImageBlockId(null);
    setHasUnsavedChanges(true);
  };

  const handleGenerateTitle = () => {
    // For title generation, we can use meta description or focus keyword as context
    if (!metaDescription && !primaryKeyword && localBlocks.length === 0) {
      toast({
        title: "Need Some Context",
        description: "Add a meta description, primary keyword, or some content to generate a title",
        variant: "destructive",
      });
      return;
    }
    generateTitle.mutate();
  };

  const handleGenerateSummary = () => {
    if (!title) {
      toast({
        title: "Missing Title",
        description: "Add a title first to generate a meta description",
        variant: "destructive",
      });
      return;
    }
    generateSummary.mutate();
  };

  const handleGenerateFullArticle = () => {
    if (!selectedTemplate || selectedTemplate === "default") {
      toast({
        title: "Template Required",
        description: "Please select a template before generating content.",
        variant: "destructive",
      });
      return;
    }
    generateFullArticle.mutate();
  };

  // Handle template switching with content preservation
  const handleTemplateChange = (newTemplateId: string) => {
    if (newTemplateId === selectedTemplate) return;

    const previousTemplate = selectedTemplate;
    setSelectedTemplate(newTemplateId);
    setHasUnsavedChanges(true); // Mark as changed when template is switched

    // If there's existing content and a valid template is selected, offer to reformat
    if (localBlocks.length > 0 && newTemplateId !== "default") {
      toast({
        title: "Template Changed",
        description: "Your existing content will be preserved. Use 'Generate Complete Article' to reformat it with the new template.",
      });
    }
  };

  // Mock functions for block saving and removal (replace with actual logic if needed)
  const [savingBlocks, setSavingBlocks] = useState<Set<number>>(new Set());
  const handleSaveBlock = (block: any, index: number) => {
    console.log("Saving block:", block, "at index:", index);
    setSavingBlocks(prev => new Set(prev).add(index));
    setTimeout(() => {
      setSavingBlocks(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 1000);
  };
  const handleRemoveGeneratedBlock = (index: number) => {
    console.log("Removing generated block at index:", index);
    setLocalBlocks(prevBlocks => prevBlocks.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  const isEmailContent = effectiveContentType?.startsWith?.("email") || 
    currentContentItem?.type === 'email' || 
    (type || currentContentItem?.type)?.startsWith?.("email");

  const handleOpenEmailPreview = () => {
    const itemId = contentItemId || currentContentItem?.id;
    if (!itemId) {
      toast({
        title: "Save First",
        description: "Save your content before previewing the email.",
        variant: "destructive",
      });
      return;
    }
    setShowEmailPreview(true);
  };

  const handlePushToKlaviyo = async () => {
    const itemId = contentItemId || currentContentItem?.id;
    if (!itemId) {
      toast({ title: "Save First", description: "Save your content before pushing to Klaviyo.", variant: "destructive" });
      return;
    }
    setPushKlaviyoLoading(true);
    try {
      const res = await apiRequest("POST", `/api/content/${itemId}/push-to-klaviyo`);
      const data = await res.json();
      if (!res.ok) {
        if (data.message === "klaviyo_required") {
          toast({ title: "Klaviyo not connected", description: "Connect Klaviyo in Integrations to push templates.", variant: "destructive" });
        } else {
          toast({ title: "Push failed", description: data.message, variant: "destructive" });
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/content-items", itemId] });
      const klaviyoLink = (
        <span>
          Template ID: {data.templateId}.{" "}
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">
            View in Klaviyo →
          </a>
        </span>
      );
      toast({ title: "Pushed to Klaviyo", description: klaviyoLink });
    } catch (err: unknown) {
      toast({ title: "Push failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setPushKlaviyoLoading(false);
    }
  };

  const handleOpenCampaignDialog = async () => {
    const itemId = contentItemId || currentContentItem?.id;
    if (!itemId) {
      toast({ title: "Save First", description: "Save your content before pushing to a campaign.", variant: "destructive" });
      return;
    }
    setCampaignName(title || "");
    setCampaignSubject("");
    setCampaignAudienceId("");
    setShowCampaignDialog(true);
    if (campaignAudiences.length === 0) {
      setCampaignAudiencesLoading(true);
      try {
        const res = await apiRequest("GET", "/api/klaviyo/audiences");
        if (res.ok) {
          const data = await res.json();
          setCampaignAudiences(data);
        } else {
          const data = await res.json();
          if (data.message === "klaviyo_required") {
            toast({ title: "Klaviyo not connected", description: "Connect Klaviyo in Integrations to push campaigns.", variant: "destructive" });
          } else {
            toast({ title: "Could not load audiences", description: data.message, variant: "destructive" });
          }
          setShowCampaignDialog(false);
        }
      } catch (err: unknown) {
        toast({ title: "Could not load audiences", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        setShowCampaignDialog(false);
      } finally {
        setCampaignAudiencesLoading(false);
      }
    }
  };

  const handleSubmitCampaign = async () => {
    const itemId = contentItemId || currentContentItem?.id;
    if (!itemId) return;
    if (!campaignSubject.trim()) {
      toast({ title: "Subject line required", variant: "destructive" });
      return;
    }
    if (!campaignAudienceId) {
      toast({ title: "Select an audience", variant: "destructive" });
      return;
    }
    const audience = campaignAudiences.find(a => a.id === campaignAudienceId);
    if (!audience) return;
    setCampaignLoading(true);
    try {
      const res = await apiRequest("POST", `/api/content/${itemId}/push-to-klaviyo-campaign`, {
        campaignName: campaignName.trim() || title || "Untitled Email",
        subject: campaignSubject.trim(),
        fromName: campaignFromName.trim(),
        fromEmail: campaignFromEmail.trim(),
        audienceId: audience.id,
        audienceType: audience.kind,
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.message === "klaviyo_required") {
          toast({ title: "Klaviyo not connected", description: "Connect Klaviyo in Integrations to push campaigns.", variant: "destructive" });
        } else {
          toast({ title: "Campaign push failed", description: data.message, variant: "destructive" });
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/content-items", itemId] });
      const link = (
        <span>
          {data.previousCampaignId && (
            <span className="block text-xs text-muted-foreground mb-0.5">Previous campaign: #{data.previousCampaignId}</span>
          )}
          Saved as draft.{" "}
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">View in Klaviyo →</a>
        </span>
      );
      toast({ title: "Campaign created", description: link });
      setShowCampaignDialog(false);
    } catch (err: unknown) {
      toast({ title: "Campaign push failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setCampaignLoading(false);
    }
  };

  const handleOpenPagePreview = async () => {
    const itemId = contentItemId || currentContentItem?.id;
    if (!itemId) {
      toast({ title: "Save First", description: "Save your content before previewing.", variant: "destructive" });
      return;
    }
    setPagePreviewLoading(true);
    setPagePreviewHtml(null);
    setShowPagePreview(true);
    try {
      const response = await apiRequest("GET", `/api/content-items/${itemId}/preview-html`);
      if (!response.ok) throw new Error(`Preview failed: ${response.status}`);
      const html = await response.text();
      setPagePreviewHtml(html);
    } catch (error: any) {
      toast({ title: "Preview Error", description: error.message || "Could not load preview.", variant: "destructive" });
      setShowPagePreview(false);
    } finally {
      setPagePreviewLoading(false);
    }
  };

  // Show loading state while fetching content
  if (isLoadingContent) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-12">
          <p>Loading content...</p>
        </div>
      </div>
    );
  }

  const contentTypeName = (() => {
    if (isEmailContent) return "Email";
    if (effectiveContentType === "blog_article") return "Blog Article";
    if (effectiveContentType === "landing_page") return "Landing Page";
    if (effectiveContentType === "lead_magnet") return "Lead Magnet";
    return "Content";
  })();

  const liveUrl = (() => {
    if (isEmailContent) return null;
    const s = currentContentItem?.slug || slug;
    if (!s) return null;
    return `https://welltolddesign.com/a/articles/${s}`;
  })();

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Unified Top Bar */}
      <div className="mb-6 flex flex-col gap-3">
        {/* Row 1: Back + Type Badge + Title + Status + Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Back link */}
          {(onCancel || onClose) ? (
            <Button variant="ghost" size="sm" onClick={onCancel || onClose} className="shrink-0 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(isEmailContent ? "/emails" : "/pages")}
              className="shrink-0 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {isEmailContent ? "Emails" : "Pages"}
            </Button>
          )}

          {/* Content type badge */}
          <Badge variant="outline" className="shrink-0 text-xs border-black">{contentTypeName}</Badge>

          {/* Editable title — takes remaining space */}
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setHasUnsavedChanges(true); }}
            placeholder="Enter title…"
            className="flex-1 min-w-[180px] font-medium border-0 border-b border-black rounded-none px-0 focus-visible:ring-0 focus-visible:border-black bg-transparent text-base"
          />

          {/* Status selector */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-28 shrink-0 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="idea">Idea</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="live">Live</SelectItem>
            </SelectContent>
          </Select>

          {status === "scheduled" && (
            <Input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-44 shrink-0 h-8 text-xs"
            />
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Preview */}
            {!isEmailContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPagePreview}
                disabled={pagePreviewLoading || !(contentItemId || currentContentItem?.id)}
                title={!(contentItemId || currentContentItem?.id) ? "Save first to preview" : "Preview rendered page"}
              >
                <Eye className="h-4 w-4 mr-1" />
                {pagePreviewLoading ? "Loading…" : "Preview"}
              </Button>
            )}
            {isEmailContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenEmailPreview}
                disabled={!(contentItemId || currentContentItem?.id)}
                title={!(contentItemId || currentContentItem?.id) ? "Save first to preview" : "Preview email"}
              >
                <Mail className="h-4 w-4 mr-1" />
                Preview
              </Button>
            )}

            {isEmailContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePushToKlaviyo}
                disabled={pushKlaviyoLoading || !(contentItemId || currentContentItem?.id)}
                title={!(contentItemId || currentContentItem?.id) ? "Save first to push" : "Create or update Klaviyo template"}
              >
                <Upload className="h-4 w-4 mr-1" />
                {pushKlaviyoLoading ? "Pushing…" : "Push to Template"}
              </Button>
            )}

            {isEmailContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenCampaignDialog}
                disabled={!(contentItemId || currentContentItem?.id)}
                title={!(contentItemId || currentContentItem?.id) ? "Save first to push" : "Create a new Klaviyo draft campaign"}
              >
                <Megaphone className="h-4 w-4 mr-1" />
                Push to Campaign
              </Button>
            )}


            {/* Regenerate — only for non-email pages that have been saved */}
            {!isEmailContent && (contentItemId || currentContentItem?.id) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegenerateConfirm(true)}
                disabled={regenerateMutation.isPending}
                title={!primaryKeyword ? "Set a primary keyword in Settings first" : "Rebuild this page from scratch using AI"}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                {regenerateMutation.isPending ? "Regenerating…" : "Regenerate"}
              </Button>
            )}

            {/* View Live — only when the persisted item status is live/published and we have a URL */}
            {(currentContentItem?.status === "live" || currentContentItem?.status === "published") && liveUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(liveUrl, "_blank", "noopener")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View Live
              </Button>
            )}

            {/* Publish — web content only, must be saved first */}
            {!isEmailContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending || !(contentItemId || currentContentItem?.id)}
                title={
                  !(contentItemId || currentContentItem?.id)
                    ? "Save the article first before publishing"
                    : status === "live"
                    ? "Re-publish to push the latest changes live"
                    : "Publish this article to the live website"
                }
              >
                {publishMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-1" />
                )}
                {publishMutation.isPending
                  ? "Publishing…"
                  : status === "live"
                  ? "Update Live"
                  : "Publish"}
              </Button>
            )}

            {/* Save */}
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              size="sm"
              className="bg-black hover:bg-gray-800 text-white"
            >
              <Save className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {/* Collapsible Settings Panel (title details + SEO + metadata) */}
        <div className="border border-black">
          <button
            type="button"
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium bg-[#f0ebe7] hover:bg-[#e8e3df] transition-colors"
          >
            <span className="flex items-center gap-2"><Settings2 className="h-3.5 w-3.5" />Settings &amp; Metadata</span>
            <span className="text-xs text-gray-500">{showSettingsPanel ? "▲ hide" : "▼ show"}</span>
          </button>
          {showSettingsPanel && (
            <div className="p-4 space-y-4 border-t border-black">
              {/* Template Selection */}
              <div className="space-y-1.5">
                <Label>Content Template</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Template</SelectItem>
                    {templates.map((template: any) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Slug */}
              {!isEmailContent && (
                <div className="space-y-1.5">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-'))}
                    placeholder="auto-generated-from-title"
                  />
                  <div className="text-xs text-gray-500">welltolddesign.com/a/articles/{slug || "auto-generated"}</div>
                </div>
              )}

              {/* Primary Keyword */}
              <div className="space-y-1.5">
                <Label htmlFor="primaryKeyword">Primary Keyword</Label>
                <Input
                  id="primaryKeyword"
                  value={primaryKeyword}
                  onChange={(e) => setPrimaryKeyword(e.target.value)}
                  placeholder="Enter primary keyword for SEO…"
                />
              </div>

              {/* Supporting Keywords */}
              <div className="space-y-1.5">
                <Label htmlFor="supportingKeywords">Supporting Keywords</Label>
                <Textarea
                  id="supportingKeywords"
                  value={supportingKeywords}
                  onChange={(e) => setSupportingKeywords(e.target.value)}
                  placeholder="Related keywords, clusters, or semantic variations…"
                  rows={3}
                  className="resize-vertical"
                />
              </div>

              {/* Meta Description */}
              <div className="space-y-1.5">
                <Label htmlFor="metaDescription">Meta Description</Label>
                <div className="flex gap-2">
                  <Textarea
                    id="metaDescription"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder="Enter meta description…"
                    className="flex-1"
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateSummary}
                    disabled={generateSummary.isPending}
                    className="self-start shrink-0"
                  >
                    <Wand2 className="h-3.5 w-3.5 mr-1" />
                    AI
                  </Button>
                </div>
              </div>

              {/* Featured Image */}
              <div className="space-y-1.5">
                <Label htmlFor="featuredImage">Featured Image</Label>
                <div className="flex gap-2">
                  <Input
                    id="featuredImage"
                    value={featuredImage}
                    onChange={(e) => setFeaturedImage(e.target.value)}
                    placeholder="Featured image URL…"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAssetSelectorOpen(true)}
                  >
                    Browse
                  </Button>
                </div>
                {featuredImage && (
                  <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded overflow-hidden max-w-xs">
                    <img
                      src={featuredImage}
                      alt="Featured image preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Advanced SEO */}
              <div className="border border-black/20">
                <button
                  type="button"
                  onClick={() => setShowSeoPanel(!showSeoPanel)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span>Advanced SEO</span>
                  <span className="text-gray-400">{showSeoPanel ? "▲" : "▼"}</span>
                </button>
                {showSeoPanel && (
                  <div className="p-3 space-y-3 border-t border-black/20">
                    <div className="space-y-1">
                      <Label htmlFor="ogTitle" className="text-xs">OG Title (social share override)</Label>
                      <Input
                        id="ogTitle"
                        value={ogTitle}
                        onChange={(e) => { setOgTitle(e.target.value); setHasUnsavedChanges(true); }}
                        placeholder="Leave blank to use page title"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ogImage" className="text-xs">OG Image URL (social share image)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="ogImage"
                          value={ogImage}
                          onChange={(e) => { setOgImage(e.target.value); setHasUnsavedChanges(true); }}
                          placeholder="Leave blank to use featured image"
                          className="text-sm flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                          onClick={() => setIsAssetSelectorOpen(true)}
                        >
                          Browse
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="canonicalUrl" className="text-xs">Canonical URL</Label>
                      <Input
                        id="canonicalUrl"
                        value={canonicalUrl}
                        onChange={(e) => { setCanonicalUrl(e.target.value); setHasUnsavedChanges(true); }}
                        placeholder={`https://welltolddesign.com/a/articles/${currentContentItem?.slug || 'slug'}`}
                        className="text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground">Overrides default. Leave blank to use auto-generated value.</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="redirectFrom" className="text-xs">Redirect From (old URLs, comma separated)</Label>
                      <Input
                        id="redirectFrom"
                        value={redirectFrom}
                        onChange={(e) => { setRedirectFrom(e.target.value); setHasUnsavedChanges(true); }}
                        placeholder="e.g. /old-slug, /another-old-path"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="structuredDataType" className="text-xs">Schema Type (JSON-LD)</Label>
                      <Select value={structuredDataType} onValueChange={(v) => { setStructuredDataType(v); setHasUnsavedChanges(true); }}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="None">None</SelectItem>
                          <SelectItem value="Article">Article</SelectItem>
                          <SelectItem value="Product">Product</SelectItem>
                          <SelectItem value="FAQPage">FAQPage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pageTemplate" className="text-xs">Page Template</Label>
                      <Select value={pageTemplate} onValueChange={(v) => { setPageTemplate(v); setHasUnsavedChanges(true); }}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="wide">Wide (no sidebar)</SelectItem>
                          <SelectItem value="landing">Landing Page</SelectItem>
                          <SelectItem value="minimal">Minimal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Collapsible AI Tools Panel */}
        <div className="border border-black">
          <button
            type="button"
            onClick={() => setShowAiPanel(!showAiPanel)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium bg-[#f0ebe7] hover:bg-[#e8e3df] transition-colors"
          >
            <span className="flex items-center gap-2"><Wand2 className="h-3.5 w-3.5" />AI Tools</span>
            <span className="text-xs text-gray-500">{showAiPanel ? "▲ hide" : "▼ show"}</span>
          </button>
          {showAiPanel && (
            <div className="p-4 space-y-3 border-t border-black">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateTitle}
                  disabled={generateTitle.isPending}
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                  {generateTitle.isPending ? "Generating…" : "Generate Title"}
                </Button>
                {!isEmailContent && (
                  <>
                    <Select value={contentFormat} onValueChange={(v) => setContentFormat(v as 'auto' | 'A' | 'B' | 'C')}>
                      <SelectTrigger className="h-8 text-xs rounded-none border-black w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto format</SelectItem>
                        <SelectItem value="A">Gift Guide (A)</SelectItem>
                        <SelectItem value="B">Editorial (B)</SelectItem>
                        <SelectItem value="C">Professional (C)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateWebPageMarkdownMutation.mutate()}
                      disabled={generateWebPageMarkdownMutation.isPending}
                    >
                      <Wand2 className="h-3.5 w-3.5 mr-1" />
                      {generateWebPageMarkdownMutation.isPending ? "Generating…" : "Generate Page"}
                    </Button>
                  </>
                )}
                {isEmailContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateFullArticle}
                    disabled={generateFullArticle.isPending}
                  >
                    <Wand2 className="h-3.5 w-3.5 mr-1" />
                    {generateFullArticle.isPending ? "Generating…" : "Generate Complete Article"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Web Page Markdown Editor — shown for markdown-backed pages (new flow) */}
        {isMarkdownMode && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-4" style={{ minHeight: "500px" }}>
                {/* Markdown textarea */}
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Markdown</h3>
                    <span className="text-xs text-muted-foreground">{markdownContent.length} chars</span>
                  </div>
                  <textarea
                    className="flex-1 w-full border border-black rounded-none p-3 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-black"
                    style={{ minHeight: "460px" }}
                    value={markdownContent}
                    onChange={async (e) => {
                      const md = e.target.value;
                      setMarkdownContent(md);
                      setHasUnsavedChanges(true);
                      if (md) {
                        const { marked } = await import("marked");
                        const html = await marked(md);
                        setMarkdownPreviewHtml(html as string);
                      } else {
                        setMarkdownPreviewHtml("");
                      }
                    }}
                    placeholder="Start writing in Markdown, or click 'Generate Page' in AI Tools to generate content…"
                  />
                </div>
                {/* Live rendered preview */}
                <div className="flex-1 flex flex-col gap-2 border-l border-black/10 pl-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</h3>
                  <div
                    className="flex-1 overflow-auto prose prose-sm max-w-none text-sm p-2"
                    style={{ minHeight: "460px" }}
                    dangerouslySetInnerHTML={{ __html: markdownPreviewHtml || '<p class="text-muted-foreground italic">Preview will appear here as you type…</p>' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Images — hero + product images, shown whenever the article is in markdown mode */}
        {isMarkdownMode && (
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Images</h3>
              <div className="flex flex-col gap-3">

                {/* ── Hero Image row ── */}
                <div className="border border-black/20">
                  <div className="flex items-center gap-3 p-2">
                    {featuredImage ? (
                      <img src={featuredImage} alt="Hero" className="w-12 h-12 object-cover border border-black/10 flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 bg-[#f0ebe7] border border-black/10 flex-shrink-0 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-black/30" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Hero Image</p>
                      <p className="text-xs text-muted-foreground">{featuredImage ? "Featured image set" : "No image yet"}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none border-black text-xs flex-shrink-0"
                      onClick={() => setHeroPickerOpen(!heroPickerOpen)}
                    >
                      {heroPickerOpen ? "Close" : "Change"}
                    </Button>
                  </div>

                  {heroPickerOpen && (
                    <div className="border-t border-black/10 p-3 space-y-3">
                      {/* Tab pills */}
                      <div className="flex gap-1">
                        {(['url', 'upload', 'cloudinary'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setHeroPickerTab(tab)}
                            className={`px-2 py-1 text-xs border border-black/20 ${heroPickerTab === tab ? 'bg-black text-white' : 'bg-white hover:bg-[#f0ebe7]'}`}
                          >
                            {tab === 'url' ? 'URL' : tab === 'upload' ? 'Upload' : 'Cloudinary'}
                          </button>
                        ))}
                      </div>

                      {heroPickerTab === 'url' && (
                        <div className="flex gap-2">
                          <Input
                            value={heroUrlInput}
                            onChange={(e) => setHeroUrlInput(e.target.value)}
                            placeholder="Paste image URL…"
                            className="flex-1 h-8 text-xs rounded-none"
                          />
                          <Button
                            size="sm"
                            className="rounded-none text-xs h-8"
                            onClick={() => {
                              if (!heroUrlInput.trim()) return;
                              setFeaturedImage(heroUrlInput.trim());
                              setHasUnsavedChanges(true);
                              setHeroUrlInput('');
                              setHeroPickerOpen(false);
                              toast({ title: "Hero image updated" });
                            }}
                          >
                            Apply
                          </Button>
                        </div>
                      )}

                      {heroPickerTab === 'upload' && (
                        <div>
                          <input
                            ref={heroFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleHeroFileUpload(e.target.files)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none border-black text-xs"
                            disabled={heroUploadLoading}
                            onClick={() => heroFileInputRef.current?.click()}
                          >
                            {heroUploadLoading ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5 mr-1" />
                            )}
                            {heroUploadLoading ? 'Uploading…' : 'Choose File'}
                          </Button>
                        </div>
                      )}

                      {heroPickerTab === 'cloudinary' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none border-black text-xs"
                          onClick={() => {
                            setCloudinaryTarget('hero');
                            setIsAssetSelectorOpen(true);
                          }}
                        >
                          Browse Library
                        </Button>
                      )}

                      {/* Generate New — always visible in hero picker */}
                      <div className="pt-1 border-t border-black/10">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none border-black text-xs w-full"
                          disabled={generateImageMutation.isPending || !primaryKeyword || !(contentItemId || currentContentItem?.id)}
                          title={
                            !(contentItemId || currentContentItem?.id)
                              ? "Save the article first to generate an image"
                              : !primaryKeyword
                              ? "Set a primary keyword in Settings first"
                              : "Generate a new hero image with AI"
                          }
                          onClick={() => generateImageMutation.mutate()}
                        >
                          {generateImageMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Wand2 className="h-3.5 w-3.5 mr-1" />
                          )}
                          {generateImageMutation.isPending ? 'Generating…' : 'Generate New'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Product Image rows ── */}
                {((generatedStructuredData as any)?._wt_products as any[] ?? []).map((product: any) => {
                  const isOpen = pickerProduct?.handle === product.handle;
                  return (
                    <div key={product.handle} className="border border-black/20">
                      <div className="flex items-center gap-3 p-2">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.title} className="w-12 h-12 object-cover border border-black/10 flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 bg-[#f0ebe7] border border-black/10 flex-shrink-0 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-black/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{product.handle}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none border-black text-xs flex-shrink-0"
                          onClick={async () => {
                            if (isOpen) { setPickerProduct(null); setPickerImages([]); return; }
                            setPickerProduct({ handle: product.handle, title: product.title, currentImageUrl: product.imageUrl });
                            setPickerImages([]);
                            setPickerTab('url');
                            setPickerLoading(true);
                            try {
                              const res = await apiRequest("GET", `/api/shopify/product-images/${product.handle}`);
                              const data = await res.json();
                              setPickerImages(data.images ?? []);
                            } catch {
                              toast({ title: "Couldn't load images", variant: "destructive" });
                            } finally {
                              setPickerLoading(false);
                            }
                          }}
                        >
                          {isOpen ? "Close" : "Change Image"}
                        </Button>
                      </div>

                      {isOpen && (
                        <div className="border-t border-black/10 p-3 space-y-3">
                          {/* Shopify images */}
                          {pickerLoading ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Loading Shopify images…
                            </p>
                          ) : pickerImages.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {pickerImages.map((img) => {
                                const isCurrent = img.src === pickerProduct?.currentImageUrl;
                                return (
                                  <button
                                    key={img.src}
                                    title={img.alt || img.src}
                                    onClick={() => {
                                      if (isCurrent) return;
                                      applyProductImageChange(product.handle, pickerProduct!.currentImageUrl, img.src);
                                    }}
                                    className={`relative border-2 ${isCurrent ? "border-black" : "border-transparent hover:border-black/40"} transition-colors`}
                                    style={{ padding: 0, background: "none", cursor: isCurrent ? "default" : "pointer" }}
                                  >
                                    <img src={img.src} alt={img.alt} className="w-20 h-20 object-cover display-block" />
                                    {isCurrent && (
                                      <span className="absolute bottom-0 left-0 right-0 bg-black text-white text-[9px] text-center py-0.5 font-medium">CURRENT</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No alternate Shopify images.</p>
                          )}

                          {/* Additional options: URL / Upload / Cloudinary */}
                          <div className="border-t border-black/10 pt-3 space-y-2">
                            <p className="text-xs text-muted-foreground font-medium">Or use a custom image:</p>
                            <div className="flex gap-1">
                              {(['url', 'upload', 'cloudinary'] as const).map((tab) => (
                                <button
                                  key={tab}
                                  onClick={() => setPickerTab(tab)}
                                  className={`px-2 py-1 text-xs border border-black/20 ${pickerTab === tab ? 'bg-black text-white' : 'bg-white hover:bg-[#f0ebe7]'}`}
                                >
                                  {tab === 'url' ? 'URL' : tab === 'upload' ? 'Upload' : 'Cloudinary'}
                                </button>
                              ))}
                            </div>

                            {pickerTab === 'url' && (
                              <div className="flex gap-2">
                                <Input
                                  value={pickerUrlInput}
                                  onChange={(e) => setPickerUrlInput(e.target.value)}
                                  placeholder="Paste image URL…"
                                  className="flex-1 h-8 text-xs rounded-none"
                                />
                                <Button
                                  size="sm"
                                  className="rounded-none text-xs h-8"
                                  onClick={() => {
                                    if (!pickerUrlInput.trim() || !pickerProduct) return;
                                    applyProductImageChange(product.handle, pickerProduct.currentImageUrl, pickerUrlInput.trim());
                                    setPickerUrlInput('');
                                  }}
                                >
                                  Apply
                                </Button>
                              </div>
                            )}

                            {pickerTab === 'upload' && (
                              <div>
                                <input
                                  ref={productFileInputRef}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleProductFileUpload(e.target.files)}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-none border-black text-xs"
                                  disabled={pickerUploadLoading}
                                  onClick={() => productFileInputRef.current?.click()}
                                >
                                  {pickerUploadLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                  ) : (
                                    <Upload className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  {pickerUploadLoading ? 'Uploading…' : 'Choose File'}
                                </Button>
                              </div>
                            )}

                            {pickerTab === 'cloudinary' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-none border-black text-xs"
                                onClick={() => {
                                  setCloudinaryTarget('product');
                                  setIsAssetSelectorOpen(true);
                                }}
                              >
                                Browse Library
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              </div>
            </CardContent>
          </Card>
        )}

        {/* Block Editor — email types and legacy block-based web pages */}
        {!isMarkdownMode && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {/* Add Blocks toolbar */}
                {/* Content — shared across email and web */}
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => addBlock("heading")}>
                        <Plus className="h-3 w-3 mr-1" />Heading
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("paragraph")}>
                        <Plus className="h-3 w-3 mr-1" />Paragraph
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("image")}>
                        <Plus className="h-3 w-3 mr-1" />Image
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("list")}>
                        <Plus className="h-3 w-3 mr-1" />List
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("quote")}>
                        <Plus className="h-3 w-3 mr-1" />Quote
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("cta")}>
                        <Plus className="h-3 w-3 mr-1" />CTA
                      </Button>
                    </div>
                  </div>

                  {/* Layout — shared across email and web */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Layout</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => addBlock("hero")}>
                        <Plus className="h-3 w-3 mr-1" />Hero
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("banner")}>
                        <Plus className="h-3 w-3 mr-1" />Banner
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("image_text")}>
                        <Plus className="h-3 w-3 mr-1" />Image &amp; Text
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("image_row")}>
                        <Plus className="h-3 w-3 mr-1" />Image Row
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("divider")}>
                        <Plus className="h-3 w-3 mr-1" />Divider
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("spacer")}>
                        <Plus className="h-3 w-3 mr-1" />Spacer
                      </Button>
                    </div>
                  </div>

                  {/* Web — web-page-only blocks */}
                  {!isEmailContent && (
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Web</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => addBlock("two_column")}>
                        <Plus className="h-3 w-3 mr-1" />2-Column
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("accordion")}>
                        <Plus className="h-3 w-3 mr-1" />Accordion
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("icon_text_row")}>
                        <Plus className="h-3 w-3 mr-1" />Icon Row
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("author_bio")}>
                        <Plus className="h-3 w-3 mr-1" />Author Bio
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("breadcrumb")}>
                        <Plus className="h-3 w-3 mr-1" />Breadcrumb
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("related_content")}>
                        <Plus className="h-3 w-3 mr-1" />Related
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("app_block")}>
                        <Plus className="h-3 w-3 mr-1" />App Block
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("html_block")}>
                        <Plus className="h-3 w-3 mr-1" />HTML Block
                      </Button>
                    </div>
                  </div>
                  )}

                  {/* Email — email-only blocks */}
                  {isEmailContent && (
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => addBlock("product_feature")}>
                        <Plus className="h-3 w-3 mr-1" />Product Feature
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("product_row")}>
                        <Plus className="h-3 w-3 mr-1" />Product Row
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("promo_code")}>
                        <Plus className="h-3 w-3 mr-1" />Promo Code
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("review")}>
                        <Plus className="h-3 w-3 mr-1" />Review
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("ugc_review")}>
                        <Plus className="h-3 w-3 mr-1" />UGC / Review
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("gif_image")}>
                        <Plus className="h-3 w-3 mr-1" />GIF Image
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("countdown_timer")}>
                        <Plus className="h-3 w-3 mr-1" />Countdown
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("progress_loyalty")}>
                        <Plus className="h-3 w-3 mr-1" />Loyalty Bar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("html_block")}>
                        <Plus className="h-3 w-3 mr-1" />HTML Block
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlockWithContent("html_block", { snippetName: "wt_footer" })}>
                        <Plus className="h-3 w-3 mr-1" />WT Footer
                      </Button>
                    </div>
                  </div>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shopify Blocks</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowShopifyPicker(true)} className="text-xs border-dashed">
                        <ShoppingBag className="h-3 w-3 mr-1" />Browse & Insert from Shopify
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("shopify_product_card")}>
                        <Plus className="h-3 w-3 mr-1" />Product Card
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => addBlock("shopify_collection_feature")}>
                        <Plus className="h-3 w-3 mr-1" />Collection Feature
                      </Button>
                      {!isEmailContent && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => addBlock("shopify_product_grid")}>
                            <Plus className="h-3 w-3 mr-1" />Product Grid
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => addBlock("shopify_variant_selector")}>
                            <Plus className="h-3 w-3 mr-1" />Variant Selector
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => addBlock("shopify_page")}>
                            <Plus className="h-3 w-3 mr-1" />Page Embed
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => addBlock("shopify_image")}>
                            <Plus className="h-3 w-3 mr-1" />Shopify Image
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <BookMarked className="h-3 w-3" />
                      Saved Presets
                    </h3>
                    {blockPresetsData.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No presets yet. Click the <Bookmark className="inline h-3 w-3 mx-0.5 align-text-bottom" /> <span className="font-medium">Save as preset</span> button on any block to save it here for reuse.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {blockPresetsData.map((preset: any) => (
                          <div key={preset.id}>
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs rounded-r-none border-r-0 flex-1 justify-start"
                                onClick={() => addBlockFromPreset(preset)}
                              >
                                <Plus className="h-3 w-3 mr-1 shrink-0" />
                                <span className="truncate">{preset.name}</span>
                                <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 h-4 shrink-0">
                                  {preset.blockType}
                                </Badge>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs px-2 border-r-0 rounded-none"
                                title="Edit preset content"
                                onClick={() => openEditPreset(preset)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs rounded-l-none px-1.5 text-red-500 hover:text-red-600"
                                onClick={() => deletePresetMutation.mutate(preset.id)}
                              >
                                ×
                              </Button>
                            </div>
                            {/* Inline editor — shown when this preset is being edited */}
                            {editingPresetId === preset.id && (
                              <div className="border border-t-0 border-input bg-muted/30 p-3 space-y-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                                  {preset.blockType === "html_block" ? "HTML content" : "Block content (JSON)"}
                                </p>
                                <Textarea
                                  value={editPresetDraft}
                                  onChange={e => setEditPresetDraft(e.target.value)}
                                  className="font-mono text-xs min-h-[200px] resize-y"
                                  spellCheck={false}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  Saving will update this preset <strong>and push the new content to every template that uses it.</strong>
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-black text-white hover:bg-gray-800 h-7 text-xs"
                                    onClick={handleSaveEditedPreset}
                                    disabled={updatePresetMutation.isPending}
                                  >
                                    {updatePresetMutation.isPending ? "Saving…" : "Save & sync"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => setEditingPresetId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {localBlocks.length > 0 && (
                    <div className="flex justify-end mb-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2 gap-1"
                        onClick={() => setAllCollapsed((v) => !v)}
                      >
                        {allCollapsed ? (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            Expand All
                          </>
                        ) : (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            Collapse All
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  <div className="space-y-3">
                    {(() => {
                      const sorted = [...localBlocks].sort((a: any, b: any) => a.order - b.order);
                      return sorted.map((block: any, idx: number) => (
                        <div key={block.id} className="flex gap-1 items-start">
                          <div className="flex flex-col gap-0.5 pt-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              disabled={idx === 0}
                              onClick={() => moveBlock(block.id, 'up')}
                              title="Move up"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              disabled={idx === sorted.length - 1}
                              onClick={() => moveBlock(block.id, 'down')}
                              title="Move down"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <ContentBlock
                              block={block}
                              onChange={updateBlock}
                              onBlockUpdate={updateBlockMeta}
                              onDelete={deleteBlock}
                              onSaveAsPreset={handleSaveAsPreset}
                              onEditPreset={handleEditPresetGlobally}
                              onDetachPreset={handleDetachPreset}
                              onImageSelect={(blockId) => setImageBlockId(blockId)}
                              blockState={blockStates[block.id] || null}
                              onStateChange={(state) => setBlockStates(prev => ({ ...prev, [block.id]: state }))}
                              activeMood={activeMood}
                              contentDescription={contentDescription}
                              templateType={type || currentContentItem?.type || "email"}
                              collapsed={allCollapsed}
                              siblingContext={localBlocks.reduce((acc, b) => {
                                if (b.id !== block.id) {
                                  const text = typeof b.content === 'object' ? b.content?.text || b.content?.html : String(b.content);
                                  if (text) acc[b.id] = text;
                                }
                                return acc;
                              }, {} as Record<string, string>)}
                              imageSuggestion={block.type === 'image' ? imageSuggestions[block.id] : undefined}
                              onAcceptSuggestion={(blockId, url, displayName) => {
                                setImageSuggestions(prev => {
                                  const next = { ...prev };
                                  delete next[blockId];
                                  return next;
                                });
                              }}
                            />
                          </div>
                        </div>
                      ));
                    })()}

                    {localBlocks.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>No content blocks yet. Click the buttons above to add content.</p>
                      </div>
                    )}
                  </div>
              </div>
            </CardContent>
          </Card>
        )}
        </div>

      {/* Cloudinary Asset Selector — Featured Image */}
      <CloudinaryAssetSelector
        isOpen={isAssetSelectorOpen}
        onClose={() => setIsAssetSelectorOpen(false)}
        onSelect={handleAssetSelect}
        title="Select Featured Image"
        context="hero"
      />

      {/* Cloudinary Asset Selector — Image Block */}
      <CloudinaryAssetSelector
        isOpen={imageBlockId !== null}
        onClose={() => setImageBlockId(null)}
        onSelect={handleBlockImageSelect}
        title="Select Image"
        context="inline"
      />

      {/* Email Preview Modal */}
      <EmailPreviewModal
        open={showEmailPreview}
        onClose={() => setShowEmailPreview(false)}
        contentId={contentItemId || currentContentItem?.id || 0}
        contentTitle={title || currentContentItem?.title || ""}
      />

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <DialogContent className="max-w-sm w-full" style={{ borderRadius: 0 }}>
          <DialogHeader>
            <DialogTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />Regenerate this page?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1 text-sm text-gray-600">
            <p>This will rebuild the entire page from scratch using the current primary keyword: <span className="font-semibold text-black">{primaryKeyword || currentContentItem?.primaryKeyword}</span>.</p>
            <p>The title, content, FAQ, and product suggestions will all be replaced. This cannot be undone.</p>
          </div>
          <DialogFooter className="pt-2 flex gap-2">
            <Button variant="outline" size="sm" className="rounded-none" onClick={() => setShowRegenerateConfirm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-none bg-black hover:bg-gray-800 text-white"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
              {regenerateMutation.isPending ? "Regenerating…" : "Yes, regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push to Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-w-md w-full" style={{ borderRadius: 0 }}>
          <DialogHeader>
            <DialogTitle className="text-sm font-medium flex items-center gap-2">
              <Megaphone className="h-4 w-4" />Create Draft Campaign in Klaviyo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Campaign name</Label>
              <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} className="h-8 text-sm" placeholder="Campaign name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Subject line <span className="text-red-500">*</span></Label>
              <Input value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} className="h-8 text-sm" placeholder="Email subject…" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From name</Label>
                <Input value={campaignFromName} onChange={e => setCampaignFromName(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From email</Label>
                <Input value={campaignFromEmail} onChange={e => setCampaignFromEmail(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Audience <span className="text-red-500">*</span></Label>
              {campaignAudiencesLoading ? (
                <p className="text-xs text-muted-foreground py-1">Loading audiences…</p>
              ) : (
                <Select value={campaignAudienceId} onValueChange={setCampaignAudienceId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a list or segment…" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignAudiences.filter(a => a.kind === "list").length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Lists</div>
                        {campaignAudiences.filter(a => a.kind === "list").map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {campaignAudiences.filter(a => a.kind === "segment").length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Segments</div>
                        {campaignAudiences.filter(a => a.kind === "segment").map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {campaignAudiences.length === 0 && (
                      <div className="px-2 py-2 text-xs text-muted-foreground">No lists or segments found in Klaviyo.</div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCampaignDialog(false)} disabled={campaignLoading}>Cancel</Button>
            <Button size="sm" className="bg-black hover:bg-gray-800 text-white" onClick={handleSubmitCampaign} disabled={campaignLoading}>
              {campaignLoading ? "Creating…" : "Create Draft Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page Preview Modal */}
      <Dialog open={showPagePreview} onOpenChange={setShowPagePreview}>
        <DialogContent className="max-w-5xl w-full p-0 gap-0 overflow-hidden" style={{ borderRadius: 0 }}>
          <DialogHeader className="flex flex-row items-center px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Page Preview
            </DialogTitle>
            <div className="ml-auto flex items-center gap-3">
              {pagePreviewHtml && (
                <button
                  onClick={() => {
                    const blob = new Blob([pagePreviewHtml], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank", "noopener");
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />Open in tab
                </button>
              )}
            </div>
          </DialogHeader>
          <div className="bg-gray-100 overflow-auto" style={{ height: "80vh" }}>
            {pagePreviewLoading && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Loading preview…
              </div>
            )}
            {pagePreviewHtml && (
              <div className="mx-auto bg-white shadow-sm" style={{ minHeight: "100%" }}>
                <iframe
                  srcDoc={pagePreviewHtml}
                  title="Page Preview"
                  style={{ width: "100%", height: "80vh", border: "none", display: "block" }}
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save as Preset Dialog */}
      <Dialog open={showPresetDialog} onOpenChange={(open) => { setShowPresetDialog(open); if (!open) setPresetBlock(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="h-4 w-4" />
              Save Block as Preset
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {presetBlock && (
              <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded">
                Block type: <span className="font-mono font-medium">{presetBlock.type}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="preset-name">Preset name</Label>
              <Input
                id="preset-name"
                placeholder="e.g. Homepage Hero, Brand CTA, Footer Section…"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && presetName.trim() && presetBlock) savePresetMutation.mutate({ name: presetName.trim(), block: presetBlock }); }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPresetDialog(false)}>Cancel</Button>
            <Button
              onClick={() => { if (presetName.trim() && presetBlock) savePresetMutation.mutate({ name: presetName.trim(), block: presetBlock }); }}
              disabled={!presetName.trim() || savePresetMutation.isPending}
              className="bg-black hover:bg-gray-800 text-white"
            >
              {savePresetMutation.isPending ? "Saving…" : "Save Preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShopifyResourcePicker
        isOpen={showShopifyPicker}
        onClose={() => setShowShopifyPicker(false)}
        title="Browse & Insert Shopify Content"
        onSelect={(resource: ShopifyResource) => {
          if (resource.type === "product") {
            const newBlock = {
              id: Date.now().toString(),
              type: "shopify_product_card",
              content: { productId: resource.id, ctaText: "Shop Now", ctaLink: "", showDescription: true, showPrice: true },
              order: localBlocks.length,
            };
            setLocalBlocks([...localBlocks, newBlock]);
            setHasUnsavedChanges(true);
          } else if (resource.type === "collection") {
            const newBlock = {
              id: Date.now().toString(),
              type: "shopify_collection_feature",
              content: { collectionId: resource.id, headline: "", subtext: "", ctaText: "Shop the Collection", ctaLink: "", imageUrl: resource.imageUrl || "", style: "light" },
              order: localBlocks.length,
            };
            setLocalBlocks([...localBlocks, newBlock]);
            setHasUnsavedChanges(true);
          } else if (resource.type === "page") {
            const newBlock = {
              id: Date.now().toString(),
              type: "shopify_page",
              content: { pageId: resource.id, title: resource.title, handle: resource.handle, bodySummary: resource.bodySummary || "", url: resource.url || "", titleOverride: "", excerptOverride: "", ctaText: "Read More" },
              order: localBlocks.length,
            };
            setLocalBlocks([...localBlocks, newBlock]);
            setHasUnsavedChanges(true);
          } else if (resource.type === "image") {
            const newBlock = {
              id: Date.now().toString(),
              type: "shopify_image",
              content: { url: resource.url, alt: resource.altText || "" },
              order: localBlocks.length,
            };
            setLocalBlocks([...localBlocks, newBlock]);
            setHasUnsavedChanges(true);
          }
        }}
      />
    </div>
  );
}