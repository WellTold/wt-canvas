import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ContentBlock } from "@/components/content/ContentBlock";
import {
  Heading2, AlignLeft, Image, List, Quote, MousePointerClick, Minus,
  ChevronsUpDown, Bookmark, Trash2, Search, Monitor, Megaphone,
  Layers, Code, ShoppingBag, ShoppingCart, Grid3X3, Tag, Timer,
  Award, Film, Star, User, Navigation, Link2, Settings, GalleryHorizontal,
  Columns2, ChevronDown, LayoutTemplate, Pencil,
} from "lucide-react";

interface BlockDef {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  channels: ("web" | "email")[];
}

interface BlockGroup {
  label: string;
  blocks: BlockDef[];
}

const BLOCK_GROUPS: BlockGroup[] = [
  {
    label: "Content",
    blocks: [
      { type: "heading",    label: "Heading",        description: "Section title — rendered as H2, H3, or H4.",                           icon: Heading2,          channels: ["web", "email"] },
      { type: "paragraph",  label: "Paragraph",       description: "Body copy and rich text block.",                                        icon: AlignLeft,          channels: ["web", "email"] },
      { type: "image",      label: "Image",           description: "Full-width image with optional alt text and caption.",                  icon: Image,              channels: ["web", "email"] },
      { type: "list",       label: "List",            description: "Ordered or unordered list of items.",                                   icon: List,               channels: ["web", "email"] },
      { type: "quote",      label: "Quote",           description: "Pull-quote or blockquote with optional attribution.",                   icon: Quote,              channels: ["web", "email"] },
      { type: "cta",        label: "Call to Action",  description: "Highlighted section with a button that links somewhere.",              icon: MousePointerClick,  channels: ["web", "email"] },
    ],
  },
  {
    label: "Layout",
    blocks: [
      { type: "hero",           label: "Hero",            description: "Full-width hero section with headline, subtext, and background.",   icon: Monitor,       channels: ["web", "email"] },
      { type: "banner",         label: "Banner",          description: "Announcement or promotional bar.",                                  icon: Megaphone,     channels: ["web", "email"] },
      { type: "divider",        label: "Divider",         description: "Horizontal rule or a configurable blank gap.",                      icon: Minus,         channels: ["web", "email"] },
      { type: "spacer",         label: "Spacer",          description: "Fixed-height blank space for layout control.",                      icon: ChevronsUpDown,channels: ["web", "email"] },
      { type: "image_text",     label: "Image & Text",    description: "Side-by-side image and text columns.",                              icon: Columns2,      channels: ["email", "web"] },
      { type: "image_row",      label: "Image Row",       description: "Up to four side-by-side images in a single row.",                  icon: GalleryHorizontal, channels: ["email", "web"] },
      { type: "two_column",     label: "Two Column",      description: "Side-by-side content columns for web pages.",                      icon: Layers,        channels: ["web"] },
      { type: "accordion",      label: "Accordion",       description: "Expandable FAQ-style sections.",                                   icon: ChevronDown,   channels: ["web"] },
      { type: "icon_text_row",  label: "Icon Row",        description: "Icon paired with label rows — useful for feature lists.",          icon: Grid3X3,       channels: ["web"] },
    ],
  },
  {
    label: "Email",
    blocks: [
      { type: "product_feature",   label: "Product Feature",    description: "Highlight a single product with image, description, and CTA.",  icon: ShoppingBag,  channels: ["email"] },
      { type: "product_row",       label: "Product Row",         description: "Row of products with images and prices.",                        icon: ShoppingCart, channels: ["email"] },
      { type: "promo_code",        label: "Promo Code",          description: "Discount or promotional code display block.",                    icon: Tag,          channels: ["email"] },
      { type: "review",            label: "Review",              description: "Customer review with star rating and attribution.",              icon: Star,         channels: ["email"] },
      { type: "ugc_review",        label: "UGC Review",          description: "User-generated content style review block.",                     icon: Star,         channels: ["email"] },
      { type: "gif_image",         label: "GIF / Animation",     description: "Animated GIF image block.",                                      icon: Film,         channels: ["email"] },
      { type: "countdown_timer",   label: "Countdown Timer",     description: "Urgency countdown to a specific date and time.",                 icon: Timer,        channels: ["email"] },
      { type: "progress_loyalty",  label: "Loyalty Progress",    description: "Points or loyalty tier progress bar.",                           icon: Award,        channels: ["email"] },
      { type: "html_block",        label: "HTML Block",          description: "Raw HTML or named snippet (e.g. WT Footer, standard header).",   icon: Code,         channels: ["email"] },
    ],
  },
  {
    label: "Shopify",
    blocks: [
      { type: "shopify_product_card",       label: "Product Card",        description: "Single product pulled live from Shopify — image, title, price.",     icon: ShoppingBag,  channels: ["web", "email"] },
      { type: "shopify_collection_feature", label: "Collection Feature",  description: "Showcase a Shopify collection with featured image and heading.",      icon: LayoutTemplate, channels: ["web", "email"] },
      { type: "shopify_product_grid",       label: "Product Grid",        description: "Grid of products from a Shopify collection.",                         icon: Grid3X3,      channels: ["web"] },
      { type: "shopify_variant_selector",   label: "Variant Selector",    description: "Interactive colour/size variant picker for a product page.",          icon: Settings,     channels: ["web"] },
      { type: "shopify_page",               label: "Page Embed",          description: "Embed a Shopify page by its handle.",                                 icon: Layers,       channels: ["web"] },
      { type: "shopify_image",              label: "Shopify Image",       description: "Image served directly from your Shopify media library.",              icon: Image,        channels: ["web"] },
    ],
  },
  {
    label: "Web",
    blocks: [
      { type: "author_bio",     label: "Author Bio",       description: "Writer profile with photo and short bio.",                            icon: User,       channels: ["web"] },
      { type: "breadcrumb",     label: "Breadcrumb",       description: "Navigation trail showing the current page path.",                     icon: Navigation, channels: ["web"] },
      { type: "related_content",label: "Related Content",  description: "Links to related articles or pages.",                                icon: Link2,      channels: ["web"] },
      { type: "app_block",      label: "App Block",        description: "Registered custom component from the component registry.",            icon: Settings,   channels: ["web"] },
      { type: "html_block",     label: "HTML Block",       description: "Raw HTML, embeds, or custom markup injected into the page.",          icon: Code,       channels: ["web"] },
    ],
  },
];

const CHANNEL_COLOR: Record<"web" | "email", string> = {
  web:   "bg-blue-50 text-blue-700 border-blue-200",
  email: "bg-amber-50 text-amber-700 border-amber-200",
};

type Tab = "blocks" | "presets";

export default function BlockLibrary() {
  const [activeTab, setActiveTab] = useState<Tab>("blocks");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editContentPreset, setEditContentPreset] = useState<any>(null);
  const [editContentObj, setEditContentObj] = useState<any>(null);
  const { toast } = useToast();

  const { data: presets = [], isLoading: presetsLoading } = useQuery<any[]>({
    queryKey: ["/api/block-presets"],
    enabled: activeTab === "presets",
  });

  const { data: linkedBlocksData } = useQuery<{ count: number; titles: string[] }>({
    queryKey: ["/api/block-presets", editContentPreset?.id, "linked-blocks"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/block-presets/${editContentPreset.id}/linked-blocks`);
      return res.json();
    },
    enabled: editContentPreset !== null,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/block-presets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/block-presets"] });
      toast({ title: "Preset deleted" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PUT", `/api/block-presets/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/block-presets"] });
      setEditingId(null);
      toast({ title: "Preset renamed" });
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: any }) => {
      const res = await apiRequest("PUT", `/api/block-presets/${id}`, { content });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/block-presets"] });
      const count = data.updatedBlockCount ?? 0;
      toast({
        title: "Preset updated",
        description: count > 0
          ? `Content saved and synced to ${count} linked block${count === 1 ? "" : "s"} across all templates.`
          : "Preset content saved.",
      });
      setEditContentPreset(null);
      setEditContentObj(null);
    },
    onError: () => toast({ title: "Failed to update preset", variant: "destructive" }),
  });

  const openEditContent = (preset: any) => {
    const { _presetId: _pid, _presetName: _pn, ...cleanContent } = preset.content || {};
    setEditContentObj(cleanContent);
    setEditContentPreset(preset);
  };

  const filteredPresets = presets.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.blockType.toLowerCase().includes(search.toLowerCase())
  );

  const blockCount = BLOCK_GROUPS.reduce((n, g) => n + g.blocks.length, 0);

  return (
    <div>
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">Block Library</h1>
          <p className="text-gray-500 text-sm mt-1">
            All {blockCount} content block types available across emails and web pages, plus your saved presets.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-black">
        {(["blocks", "presets"] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-black"
            }`}
          >
            {tab === "presets" ? `Saved Presets${presets.length > 0 ? ` (${presets.length})` : ""}` : "Block Types"}
          </button>
        ))}
      </div>

      {activeTab === "blocks" && (
        <div className="space-y-8">
          {BLOCK_GROUPS.map((group) => (
            <section key={group.label}>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">
                {group.label}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.blocks.map((block) => {
                  const Icon = block.icon;
                  return (
                    <div
                      key={`${group.label}-${block.type}`}
                      className="border border-black p-4 bg-[#f0ebe7] hover:shadow-[4px_4px_0_0_#1a1a1a] transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-2 bg-white border border-black flex-shrink-0">
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm">{block.label}</span>
                            <code className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 font-mono text-gray-500">
                              {block.type}
                            </code>
                            {block.channels.map((ch) => (
                              <span key={ch} className={`text-xs border px-1.5 py-0.5 font-medium capitalize ${CHANNEL_COLOR[ch]}`}>
                                {ch}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm text-gray-600">{block.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeTab === "presets" && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search presets…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {presetsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-24 border border-black bg-[#f0ebe7] animate-pulse" />)}
            </div>
          ) : filteredPresets.length === 0 ? (
            <div className="border border-black bg-[#f0ebe7] p-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 border border-black bg-white">
                  <Bookmark size={28} />
                </div>
              </div>
              <h2 className="text-base font-semibold mb-2">
                {search ? "No presets match your search" : "No saved presets yet"}
              </h2>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                {search
                  ? "Try a different search term."
                  : "Open any content item in the editor, configure a block exactly how you want it, then click the bookmark icon to save it as a reusable preset."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPresets.map((preset: any) => (
                <div key={preset.id} className="border border-black p-4 bg-[#f0ebe7]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {editingId === preset.id ? (
                        <div className="flex gap-2 mb-2">
                          <Input
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === "Enter") renameMutation.mutate({ id: preset.id, name: editingName });
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                          <Button size="sm" className="h-7 text-xs bg-black text-white hover:bg-gray-800" onClick={() => renameMutation.mutate({ id: preset.id, name: editingName })}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="font-semibold text-sm text-left hover:underline truncate block w-full"
                          onClick={() => { setEditingId(preset.id); setEditingName(preset.name); }}
                          title="Click to rename"
                        >
                          {preset.name}
                        </button>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 font-mono text-gray-500">
                          {preset.blockType}
                        </code>
                        <span className="text-xs text-gray-400">
                          {new Date(preset.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-black gap-1.5"
                        title="Edit block content"
                        onClick={() => openEditContent(preset)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="text-xs">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-black text-red-500 hover:text-red-700"
                        onClick={() => { if (window.confirm(`Delete "${preset.name}"?`)) deleteMutation.mutate(preset.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit Preset Content Dialog */}
      <Dialog
        open={editContentPreset !== null}
        onOpenChange={(open) => { if (!open) { setEditContentPreset(null); setEditContentObj(null); } }}
      >
        <DialogContent className="sm:max-w-[760px] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Pencil className="h-4 w-4" />
              Edit Preset: {editContentPreset?.name}
              {editContentPreset && (
                <code className="text-[11px] bg-white border border-gray-200 px-1.5 py-0.5 font-mono text-gray-500 font-normal">
                  {editContentPreset.blockType}
                </code>
              )}
            </DialogTitle>
            {linkedBlocksData && (
              <div className="mt-2 px-3 py-2 border border-black bg-[#f0ebe7] text-xs">
                {linkedBlocksData.count > 0 ? (
                  <>
                    <span className="font-semibold">Used in {linkedBlocksData.count} block{linkedBlocksData.count === 1 ? "" : "s"}</span>
                    {linkedBlocksData.titles.length > 0 && (
                      <> across: {linkedBlocksData.titles.join(", ")}</>
                    )}
                    <span className="text-gray-500 ml-1">— saving will sync all of them.</span>
                  </>
                ) : (
                  <span className="text-gray-500">This preset is not currently used in any articles.</span>
                )}
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {editContentPreset && editContentObj !== null && (
              <ContentBlock
                block={{ id: "__preset_edit__", type: editContentPreset.blockType, content: editContentObj }}
                onChange={(_, newContent) => {
                  const { _presetId: _pid, _presetName: _pn, ...clean } = newContent;
                  setEditContentObj(clean);
                }}
              />
            )}
          </div>
          <DialogFooter className="px-5 py-3 border-t shrink-0">
            <Button
              variant="outline"
              onClick={() => { setEditContentPreset(null); setEditContentObj(null); }}
            >
              Cancel
            </Button>
            <Button
              className="bg-black hover:bg-gray-800 text-white"
              onClick={() => {
                if (editContentPreset && editContentObj !== null) {
                  updateContentMutation.mutate({ id: editContentPreset.id, content: editContentObj });
                }
              }}
              disabled={updateContentMutation.isPending}
            >
              {updateContentMutation.isPending ? "Saving…" : "Save & sync"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
