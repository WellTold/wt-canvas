import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Save,
  Plus,
  Trash2,
  GripVertical,
  Type,
  List,
  Quote,
  ExternalLink,
  FileText,
  Mail,
  ChevronUp,
  ChevronDown,
  Globe,
  Image,
  Minus,
  Move,
  Code,
  Monitor,
  Layers,
  Megaphone,
  User,
  Star,
  Navigation,
  Link2,
  Grid3X3,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Timer,
  Award,
  Film,
} from "lucide-react";

const EMAIL_CATEGORIES = ["email_campaign", "email_flow"];

const blockTypeGroups = [
  {
    label: "Content",
    types: [
      { id: "heading",        name: "Heading",          icon: Type,         description: "Section titles" },
      { id: "paragraph",      name: "Paragraph",        icon: FileText,     description: "Body copy and text" },
      { id: "list",           name: "List",             icon: List,         description: "Bullet or numbered lists" },
      { id: "quote",          name: "Quote",            icon: Quote,        description: "Blockquotes and testimonials" },
      { id: "image",          name: "Image",            icon: Image,        description: "Photos and graphics" },
      { id: "cta",            name: "Call-to-Action",   icon: ExternalLink, description: "Buttons and links" },
    ],
  },
  {
    label: "Layout",
    types: [
      { id: "hero",           name: "Hero",             icon: Monitor,      description: "Full-width hero section" },
      { id: "two_column",     name: "Two Column",       icon: Layers,       description: "Side-by-side columns" },
      { id: "banner",         name: "Banner",           icon: Megaphone,    description: "Announcement or promo bar" },
      { id: "icon_text_row",  name: "Icon + Text Row",  icon: Grid3X3,      description: "Icon with label rows" },
      { id: "accordion",      name: "Accordion",        icon: ChevronDown,  description: "Expandable FAQ sections" },
      { id: "divider",        name: "Divider",          icon: Minus,        description: "Horizontal rule" },
      { id: "spacer",         name: "Spacer",           icon: Move,         description: "Vertical whitespace" },
    ],
  },
  {
    label: "Web",
    types: [
      { id: "author_bio",     name: "Author Bio",       icon: User,         description: "Writer profile block" },
      { id: "review",         name: "Review",           icon: Star,         description: "Customer review" },
      { id: "breadcrumb",     name: "Breadcrumb",       icon: Navigation,   description: "Navigation trail" },
      { id: "related_content",name: "Related Content",  icon: Link2,        description: "Link to related pages" },
      { id: "app_block",      name: "App Block",        icon: Settings,     description: "Registered component" },
      { id: "html_block",     name: "HTML Block",       icon: Code,         description: "Custom HTML/embed" },
    ],
  },
  {
    label: "E-commerce",
    types: [
      { id: "product_feature",name: "Product Feature",  icon: ShoppingBag,  description: "Highlight a product" },
      { id: "product_row",    name: "Product Row",      icon: ShoppingCart, description: "Row of products" },
      { id: "promo_code",     name: "Promo Code",       icon: Tag,          description: "Discount code block" },
      { id: "countdown_timer",name: "Countdown Timer",  icon: Timer,        description: "Urgency timer" },
      { id: "progress_loyalty",name: "Loyalty Progress",icon: Award,        description: "Loyalty/points bar" },
      { id: "gif_image",      name: "GIF / Animation",  icon: Film,         description: "Animated image" },
    ],
  },
];

// Flat list for places that just need all types
const blockTypes = blockTypeGroups.flatMap((g) => g.types);

interface TemplateBlock {
  id: string;
  type: string;
  label: string;
  instruction: string;
  order: number;
}

interface SocialLink {
  platform: string;
  url: string;
}

interface EmailHeader {
  logoUrl: string;
  logoLink: string;
}

interface EmailFooter {
  address: string;
  unsubscribeLink: string;
  socialLinks: SocialLink[];
}

interface TemplateSavePayload {
  name: string;
  type: string;
  description: string | null;
  mood: string | null;
  system_prompt: string | null;
  user_prompt_addition: string | null;
  structure: TemplateBlock[] | null;
  preheader_text?: string | null;
  email_header?: EmailHeader | null;
  email_footer?: EmailFooter | null;
}

const SOCIAL_PLATFORMS = ["Twitter / X", "Instagram", "LinkedIn", "Facebook", "YouTube", "TikTok", "Pinterest", "Other"];

export default function TemplateBuilder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Pre-select type from URL param (e.g. /template-builder?emailType=email_campaign)
  const initialCategory = (() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("emailType") || p.get("type") || "";
  })();

  // Core fields
  const [templateName,        setTemplateName]        = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateCategory,    setTemplateCategory]    = useState(initialCategory);
  const [templateMood,        setTemplateMood]        = useState("");
  const [systemPrompt,        setSystemPrompt]        = useState("");
  const [userPromptAddition,  setUserPromptAddition]  = useState("");

  // Blocks
  const [blocks, setBlocks] = useState<TemplateBlock[]>([
    { id: "1", type: "heading", label: "Introduction", instruction: "Create an engaging opening that hooks the reader", order: 0 },
  ]);

  // Email settings
  const [preheaderText,  setPreheaderText]  = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState<number | null>(null);

  const isEmailCategory = EMAIL_CATEGORIES.includes(templateCategory);

  const { data: emailStylesList = [] } = useQuery<any[]>({
    queryKey: ["/api/email-styles"],
    enabled: isEmailCategory,
  });

  // ── Block management ──────────────────────────────────────────────────────
  const addBlock = () => {
    const newBlock: TemplateBlock = {
      id: Date.now().toString(),
      type: "text",
      label: "New Section",
      instruction: "Provide instructions for AI content generation",
      order: blocks.length,
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => setBlocks(blocks.filter((b) => b.id !== id));

  const updateBlock = (id: string, field: keyof TemplateBlock, value: string | number) =>
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, [field]: value } : b)));

  const moveBlock = (id: string, direction: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === blocks.length - 1) return;
    const next = [...blocks];
    const swap = direction === "up" ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setBlocks(next.map((b, i) => ({ ...b, order: i })));
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Resolve the selected email style into header/footer fields
      const style = emailStylesList.find((s: any) => s.id === selectedStyleId);
      const emailFields: Pick<TemplateSavePayload, "preheader_text" | "email_header" | "email_footer"> = isEmailCategory
        ? {
            preheader_text: preheaderText.trim() || "",
            email_header: style ? {
              logoUrl:  style.logoUrl  || "",
              logoLink: style.logoLink || "",
            } : { logoUrl: "", logoLink: "" },
            email_footer: style ? {
              address:         style.footerAddress    || "",
              unsubscribeLink: style.unsubscribeLink  || "{{ unsubscribe_url }}",
              socialLinks:     (style.socialLinks || []).filter((l: any) => l.url),
            } : { address: "", unsubscribeLink: "{{ unsubscribe_url }}", socialLinks: [] },
          }
        : {};

      const payload: TemplateSavePayload = {
        name:                 templateName.trim(),
        type:                 templateCategory,
        description:          templateDescription.trim() || null,
        mood:                 templateMood || null,
        system_prompt:        systemPrompt.trim() || null,
        user_prompt_addition: userPromptAddition.trim() || null,
        structure:            blocks.length > 0 ? blocks : null,
        ...emailFields,
      };

      const res = await apiRequest("POST", "/api/templates", payload);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(errBody?.message || `Save failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template saved", description: `"${templateName}" has been created.` });
      setLocation(`/templates/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!templateName.trim()) {
      toast({ title: "Name required", description: "Please enter a template name.", variant: "destructive" });
      return;
    }
    if (!templateCategory) {
      toast({ title: "Category required", description: "Please select a category.", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const getBlockIcon = (type: string) => {
    const bt = blockTypes.find((b) => b.id === type);
    return bt ? bt.icon : Type;
  };

  return (
    <div className="wt-page">
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">Template Builder</h1>
          <p className="wt-page-description">
            Create structured content templates with AI generation instructions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/templates")}>
            Cancel
          </Button>
          <Button
            className="bg-black hover:bg-gray-800 text-white"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving…" : "Save Template"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: settings ─────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">

          {/* Core settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="How-To Guide Template"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Describe what this template is for…"
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
                <Select value={templateCategory} onValueChange={setTemplateCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blog_article">Blog Article</SelectItem>
                    <SelectItem value="lead_magnet">Lead Magnet</SelectItem>
                    <SelectItem value="landing_page">Landing Page</SelectItem>
                    <SelectItem value="email_campaign">Email Campaign</SelectItem>
                    <SelectItem value="email_flow">Email Flow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mood">Default Mood</Label>
                <Select value={templateMood} onValueChange={setTemplateMood}>
                  <SelectTrigger id="mood">
                    <SelectValue placeholder="Select a mood (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conversational">Conversational</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="playful">Playful</SelectItem>
                    <SelectItem value="inspirational">Inspirational</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="empathetic">Empathetic</SelectItem>
                    <SelectItem value="authoritative">Authoritative</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Email-only fields — shown inline when email category selected */}
              {isEmailCategory && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="emailStyle">Email Style</Label>
                    <Select
                      value={selectedStyleId !== null ? String(selectedStyleId) : "none"}
                      onValueChange={(v) => setSelectedStyleId(v === "none" ? null : Number(v))}
                    >
                      <SelectTrigger id="emailStyle">
                        <SelectValue placeholder="Select an email style (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {emailStylesList.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Email styles define the header logo and footer (address, social links). Manage styles in{" "}
                      <a href="/settings" className="underline">Site Settings</a>.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preheaderText">Preheader Text <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input
                      id="preheaderText"
                      value={preheaderText}
                      onChange={(e) => setPreheaderText(e.target.value)}
                      placeholder="Short preview text shown in inbox…"
                      maxLength={200}
                    />
                    <p className="text-xs text-gray-500">Appears after the subject line in email clients. Keep under 90 chars.</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* AI instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are an expert content writer specialising in…"
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userPromptAddition">User Prompt Addition</Label>
                <Textarea
                  id="userPromptAddition"
                  value={userPromptAddition}
                  onChange={(e) => setUserPromptAddition(e.target.value)}
                  placeholder="Additional instructions added to every generation request…"
                  className="min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Block type reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Block Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {blockTypes.map((bt) => {
                  const Icon = bt.icon;
                  return (
                    <div key={bt.id} className="flex items-center gap-2 p-2 border rounded text-sm">
                      <Icon size={14} className="text-gray-500 flex-shrink-0" />
                      <span className="font-medium">{bt.name}</span>
                      <span className="text-gray-400 text-xs">— {bt.description}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: block structure ─────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Template Structure</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{blocks.length} blocks</Badge>
                  <Button onClick={addBlock} size="sm">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Block
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {blocks.map((block, index) => {
                  const Icon = getBlockIcon(block.type);
                  return (
                    <div key={block.id} className="border rounded-lg p-4 space-y-3 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-gray-400" />
                          <Icon className="h-4 w-4 text-gray-600" />
                          <Badge variant="outline" className="text-xs">{block.type}</Badge>
                          <span className="text-xs text-gray-400">#{index + 1}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveBlock(block.id, "up")}>
                            <ChevronUp size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveBlock(block.id, "down")}>
                            <ChevronDown size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => removeBlock(block.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Block Type</Label>
                          <Select
                            value={block.type}
                            onValueChange={(v) => updateBlock(block.id, "type", v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {blockTypeGroups.map((group) => (
                                <SelectGroup key={group.label}>
                                  <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">{group.label}</SelectLabel>
                                  {group.types.map((bt) => (
                                    <SelectItem key={bt.id} value={bt.id}>{bt.name}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Section Label</Label>
                          <Input
                            value={block.label}
                            onChange={(e) => updateBlock(block.id, "label", e.target.value)}
                            placeholder="Section name"
                            className="h-8"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">AI Instructions</Label>
                        <Textarea
                          value={block.instruction}
                          onChange={(e) => updateBlock(block.id, "instruction", e.target.value)}
                          placeholder="Provide detailed instructions for AI content generation…"
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                  );
                })}

                {blocks.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-gray-500 mb-4">No content blocks yet.</p>
                    <Button onClick={addBlock} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Block
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
