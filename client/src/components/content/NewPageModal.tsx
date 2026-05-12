import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PreLaunchModal } from "./PreLaunchModal";
import {
  Search,
  FileText,
  Rocket,
  Magnet,
  Wand2,
  Keyboard,
  MessageSquare,
  Layers,
  ChevronRight,
  Loader2,
  Sparkles,
  PenLine,
  LayoutGrid,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  type: string;
  description: string | null;
  system_prompt?: string | null;
  user_prompt_addition?: string | null;
  structure?: any;
  sections?: any;
  blocks?: any;
  tags?: string[] | null;
  mood?: string;
}

interface Keyword {
  id: number;
  keyword: string;
  type?: string;
  priority?: string | null;
  cluster?: string | null;
  contentTypeTarget?: string | null;
  status: string;
}

interface RecommendResult {
  keyword: string | null;
  keywordId: number | null;
  recommendedType: string;
  draftTitle: string;
  matchingTemplates: Template[];
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  blog_article: { label: "Blog Article", icon: FileText, color: "bg-blue-50 border-blue-200 text-blue-700" },
  landing_page: { label: "Landing Page", icon: Rocket, color: "bg-green-50 border-green-200 text-green-700" },
  lead_magnet: { label: "Lead Magnet", icon: Magnet, color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
};

type StartMode = "choose" | "keyword" | "topic" | "blank" | "markdown";

interface NewPageModalProps {
  open: boolean;
  onClose: () => void;
  initialType?: string;
}

export function NewPageModal({ open, onClose, initialType }: NewPageModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [mode, setMode] = useState<StartMode>("choose");
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [keywordSearch, setKeywordSearch] = useState("");
  const [showKeywordDropdown, setShowKeywordDropdown] = useState(false);
  const [topicText, setTopicText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendResult | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [prelaunchTemplate, setPrelaunchTemplate] = useState<Template | null>(null);
  const [prelaunchKeywordId, setPrelaunchKeywordId] = useState<number | null>(null);
  const [isQuickCreating, setIsQuickCreating] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<string>("blog_article");
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: allTemplates = [], isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates", "webpage"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/templates?category=webpage");
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
    enabled: open,
  });

  const { data: keywords = [], isLoading: keywordsLoading } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords", keywordSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (keywordSearch) params.set("search", keywordSearch);
      const response = await apiRequest("GET", `/api/keywords?${params.toString()}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open && (mode === "keyword" || mode === "topic"),
  });

  const updateKeywordStatusMutation = useMutation({
    mutationFn: async ({ id, status, contentItemId }: { id: number; status: string; contentItemId?: string }) => {
      const body: any = { status };
      if (contentItemId) body.contentItemId = contentItemId;
      const response = await apiRequest("PATCH", `/api/keywords/${id}`, body);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
    },
  });

  useEffect(() => {
    if (!open) {
      setMode("choose");
      setSelectedKeyword(null);
      setKeywordSearch("");
      setTopicText("");
      setSelectedTemplate(null);
      setRecommendation(null);
      setPrelaunchTemplate(null);
      setPrelaunchKeywordId(null);
      setIsQuickCreating(false);
      setSelectedContentType("blog_article");
      setIsCreatingBlank(false);
    }
  }, [open]);

  const handleGetRecommendation = async (opts: { keywordId?: number; keyword?: string; topic?: string } = {}) => {
    setIsRecommending(true);
    setRecommendation(null);
    try {
      const response = await apiRequest("POST", "/api/pages/recommend", opts);
      const data = await response.json();
      setRecommendation(data);
    } catch {
      toast({ title: "Could not get recommendation", variant: "destructive" });
    } finally {
      setIsRecommending(false);
    }
  };

  const handleAiPickForMe = async () => {
    setIsQuickCreating(true);
    try {
      const response = await apiRequest("POST", "/api/pages/ai-quick-create", {});
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(err.message || "Failed to create page");
      }
      const { id, title, keyword } = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      toast({ title: "Page created!", description: `"${title}" is ready to review.` });
      onClose();
      setLocation(`/pages/builder/${id}`);
    } catch (err: any) {
      toast({ title: "Could not create page", description: err.message, variant: "destructive" });
    } finally {
      setIsQuickCreating(false);
    }
  };

  const handleSelectKeyword = (kw: Keyword) => {
    setSelectedKeyword(kw);
    setKeywordSearch(kw.keyword);
    setShowKeywordDropdown(false);
    handleGetRecommendation({ keywordId: kw.id });
  };

  const handleTopicContinue = () => {
    if (!topicText.trim()) return;
    handleGetRecommendation({ topic: topicText.trim() });
  };

  const handleCreateBlank = async (isMarkdown: boolean) => {
    setIsCreatingBlank(true);
    try {
      const body: any = {
        title: "Untitled",
        type: selectedContentType,
        status: "idea",
      };
      if (isMarkdown) {
        body.markdownContent = "";
      } else {
        body.content = [];
      }
      const response = await apiRequest("POST", "/api/content-items", body);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(err.message || "Failed to create page");
      }
      const item = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      onClose();
      setLocation(`/pages/builder/${item.id}`);
    } catch (err: any) {
      toast({ title: "Could not create page", description: err.message, variant: "destructive" });
    } finally {
      setIsCreatingBlank(false);
    }
  };

  const openPrelaunch = (template: Template, kwId?: number | null) => {
    setPrelaunchTemplate(template);
    setPrelaunchKeywordId(kwId ?? null);
  };

  const handlePrelaunchLaunch = async (params: any) => {
    if (params.generatedContent && prelaunchTemplate) {
      sessionStorage.setItem(
        `prelaunch_content_${prelaunchTemplate.id}`,
        JSON.stringify(params.generatedContent)
      );
    }
    if (prelaunchTemplate) {
      sessionStorage.setItem(`prelaunch_context_${prelaunchTemplate.id}`, JSON.stringify({
        description: params.description,
        mood: params.mood,
        contextFields: params.contextFields,
      }));

      const templateId = prelaunchTemplate.id;
      const templateType = prelaunchTemplate.type;
      const kwId = prelaunchKeywordId;

      setPrelaunchTemplate(null);
      setPrelaunchKeywordId(null);

      const builderUrl = kwId
        ? `/pages/builder?templateId=${templateId}&type=${templateType}&keywordId=${kwId}`
        : `/pages/builder?templateId=${templateId}&type=${templateType}`;

      onClose();
      setLocation(builderUrl);

      if (kwId) {
        updateKeywordStatusMutation.mutate({ id: kwId, status: "in_progress" });
      }
    }
  };

  const filteredKeywords = keywordSearch
    ? keywords.filter((k) => k.keyword.toLowerCase().includes(keywordSearch.toLowerCase()))
    : keywords;

  const renderTypeSelector = () => (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Content type</Label>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const isSelected = selectedContentType === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedContentType(key)}
              className={`flex flex-col items-center gap-1.5 p-3 border-2 text-center transition-all ${
                isSelected
                  ? "border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  : "border-gray-200 bg-white hover:border-gray-400"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium leading-tight">{cfg.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderChooseStep = () => (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Choose how you want to start creating this page.</p>

      <div className="space-y-2">
        <button
          className="w-full flex items-start gap-3 p-4 border-2 border-black bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={handleAiPickForMe}
          disabled={isQuickCreating}
        >
          {isQuickCreating
            ? <Loader2 className="h-5 w-5 mt-0.5 shrink-0 animate-spin" />
            : <Sparkles className="h-5 w-5 mt-0.5 shrink-0" />
          }
          <div>
            <div className="font-bold text-sm">AI Pick for Me</div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isQuickCreating
                ? "AI is writing your page… this takes about 20 seconds."
                : "AI picks the next best keyword, writes the full page, and drops you straight into the editor."
              }
            </p>
          </div>
        </button>

        <button
          className="w-full flex items-start gap-3 p-4 border-2 border-dashed border-gray-300 hover:border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-left"
          onClick={() => setMode("keyword")}
        >
          <Keyboard className="h-5 w-5 mt-0.5 shrink-0 text-gray-500" />
          <div>
            <div className="font-bold text-sm">Keyword First</div>
            <p className="text-xs text-gray-500 mt-0.5">Pick a keyword from your library. AI picks the template, type, and title.</p>
          </div>
        </button>

        <button
          className="w-full flex items-start gap-3 p-4 border-2 border-dashed border-gray-300 hover:border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-left"
          onClick={() => setMode("topic")}
        >
          <MessageSquare className="h-5 w-5 mt-0.5 shrink-0 text-gray-500" />
          <div>
            <div className="font-bold text-sm">Topic / Title</div>
            <p className="text-xs text-gray-500 mt-0.5">Type a topic or working title. AI picks the keyword, template, and type.</p>
          </div>
        </button>
      </div>

      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Manual Templates</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <div className="space-y-2">
        <button
          className="w-full flex items-start gap-3 p-4 border-2 border-dashed border-gray-300 hover:border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-left"
          onClick={() => setMode("markdown")}
        >
          <PenLine className="h-5 w-5 mt-0.5 shrink-0 text-gray-500" />
          <div>
            <div className="font-bold text-sm">Markdown Template</div>
            <p className="text-xs text-gray-500 mt-0.5">Start with an empty markdown editor. Write and format content directly.</p>
          </div>
        </button>

        <button
          className="w-full flex items-start gap-3 p-4 border-2 border-dashed border-gray-300 hover:border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-left"
          onClick={() => setMode("blank")}
        >
          <LayoutGrid className="h-5 w-5 mt-0.5 shrink-0 text-gray-500" />
          <div>
            <div className="font-bold text-sm">Blank Blocks</div>
            <p className="text-xs text-gray-500 mt-0.5">Start from scratch with an empty block canvas. No AI, no template.</p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderRecommendationPanel = () => {
    if (isRecommending) {
      return (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Getting AI recommendation...
        </div>
      );
    }
    if (!recommendation) return null;

    const typeConfig = TYPE_CONFIG[recommendation.recommendedType] || TYPE_CONFIG.blog_article;
    const TypeIcon = typeConfig.icon;

    return (
      <div className="mt-4 space-y-4 border border-black p-4 bg-[#f0ebe7]">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">AI Recommendation</span>
        </div>

        {recommendation.keyword && (
          <div className="text-sm">
            <span className="text-gray-500">Keyword:</span>{" "}
            <span className="font-medium">{recommendation.keyword}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Recommended type:</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${typeConfig.color}`}>
            <TypeIcon className="h-3 w-3" />
            {typeConfig.label}
          </span>
        </div>

        {recommendation.draftTitle && (
          <div className="text-sm">
            <span className="text-gray-500">Draft title:</span>{" "}
            <span className="font-medium italic">&ldquo;{recommendation.draftTitle}&rdquo;</span>
          </div>
        )}

        {recommendation.matchingTemplates.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Suggested templates</p>
            <div className="space-y-2">
              {recommendation.matchingTemplates.map((t) => (
                <button
                  key={t.id}
                  className="w-full flex items-center justify-between p-3 bg-white border border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-left"
                  onClick={() => openPrelaunch(t, recommendation.keywordId)}
                >
                  <div>
                    <div className="font-medium text-sm">{t.name}</div>
                    {t.description && <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{t.description}</div>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {recommendation.matchingTemplates.length === 0 && (
          <p className="text-xs text-gray-500">No templates found for this type. Browse all templates below.</p>
        )}
      </div>
    );
  };

  const renderKeywordStep = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-bold uppercase tracking-wider mb-2 block">
          Search your keyword library
        </Label>
        <div className="relative" ref={dropdownRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9 rounded-none border-black"
            placeholder="Search keywords..."
            value={keywordSearch}
            onChange={(e) => {
              setKeywordSearch(e.target.value);
              setShowKeywordDropdown(true);
              setSelectedKeyword(null);
              setRecommendation(null);
            }}
            onFocus={() => setShowKeywordDropdown(true)}
          />
          {showKeywordDropdown && filteredKeywords.length > 0 && (
            <div className="absolute z-50 w-full bg-white border border-black mt-1 max-h-52 overflow-y-auto shadow-lg">
              {filteredKeywords.slice(0, 20).map((kw) => (
                <button
                  key={kw.id}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[#f0ebe7] text-left"
                  onClick={() => handleSelectKeyword(kw)}
                >
                  <span>{kw.keyword}</span>
                  <div className="flex items-center gap-2">
                    {kw.search_volume != null && (
                      <span className="text-xs text-gray-400">{kw.search_volume.toLocaleString()}/mo</span>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">{kw.status}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {keywordsLoading && (
          <p className="text-xs text-gray-400 mt-1">Loading keywords...</p>
        )}
        {!keywordsLoading && keywords.length === 0 && (
          <p className="text-xs text-gray-500 mt-1">
            No keywords in your library yet. Add some from the keyword library page.
          </p>
        )}
      </div>

      {selectedKeyword && selectedKeyword.priority === "supporting" && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-300 text-amber-800 text-xs">
          <span className="mt-0.5">⚠</span>
          <span>
            <strong>{selectedKeyword.keyword}</strong> is marked as a <strong>supporting</strong> keyword. For best results, consider choosing a primary keyword to anchor your page.
          </span>
        </div>
      )}

      {renderRecommendationPanel()}

      {recommendation && recommendation.matchingTemplates.length === 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">All templates</p>
          <TemplateGrid
            templates={allTemplates.filter((t) => t.type === recommendation.recommendedType)}
            onSelect={(t) => openPrelaunch(t, recommendation?.keywordId)}
            isLoading={templatesLoading}
          />
        </div>
      )}
    </div>
  );

  const renderTopicStep = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-bold uppercase tracking-wider mb-2 block">
          What's the topic or working title?
        </Label>
        <div className="flex gap-2">
          <Input
            className="rounded-none border-black flex-1"
            placeholder="e.g. How to pick the perfect birthday gift for a bookworm"
            value={topicText}
            onChange={(e) => {
              setTopicText(e.target.value);
              setRecommendation(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleTopicContinue()}
          />
          <Button
            className="rounded-none bg-black hover:bg-gray-800 text-white shrink-0"
            onClick={handleTopicContinue}
            disabled={!topicText.trim() || isRecommending}
          >
            {isRecommending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Suggest"}
          </Button>
        </div>
      </div>

      {renderRecommendationPanel()}

      {recommendation && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
            {recommendation.matchingTemplates.length > 0 ? "Or browse all templates" : "Browse templates"}
          </p>
          <TemplateGrid
            templates={allTemplates.filter((t) => t.type === recommendation.recommendedType)}
            onSelect={(t) => openPrelaunch(t, recommendation?.keywordId)}
            isLoading={templatesLoading}
          />
        </div>
      )}
    </div>
  );

  const renderManualStep = (isMarkdown: boolean) => (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        {isMarkdown
          ? "Start with an empty markdown editor. Choose a content type to continue."
          : "Start from scratch with no blocks and no AI. Choose a content type to continue."
        }
      </p>

      {renderTypeSelector()}

      <Button
        className="w-full rounded-none bg-black hover:bg-gray-800 text-white"
        onClick={() => handleCreateBlank(isMarkdown)}
        disabled={isCreatingBlank}
      >
        {isCreatingBlank
          ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...</>
          : `Create ${isMarkdown ? "Markdown" : "Blank"} Page`
        }
      </Button>
    </div>
  );

  const renderStep = () => {
    switch (mode) {
      case "keyword": return renderKeywordStep();
      case "topic": return renderTopicStep();
      case "markdown": return renderManualStep(true);
      case "blank": return renderManualStep(false);
      default: return renderChooseStep();
    }
  };

  const stepTitle: Record<StartMode, string> = {
    choose: "New Page",
    keyword: "Keyword First",
    topic: "Topic / Title",
    markdown: "Markdown Template",
    blank: "Blank Blocks",
  };

  return (
    <>
      <Dialog open={open && !prelaunchTemplate} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-xl border-black rounded-none bg-[#fbfaf9] p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-black bg-white">
            <div className="flex items-center gap-3">
              {mode !== "choose" && (
                <button
                  className="text-xs text-gray-500 hover:text-black transition-colors"
                  onClick={() => {
                    setMode("choose");
                    setRecommendation(null);
                    setSelectedKeyword(null);
                    setKeywordSearch("");
                    setTopicText("");
                    setSelectedContentType("blog_article");
                  }}
                >
                  ← Back
                </button>
              )}
              <DialogTitle className="text-xl font-bold">{stepTitle[mode]}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto max-h-[70vh]">
            {renderStep()}
          </div>

          <div className="p-4 border-t border-black bg-white flex justify-end gap-2">
            <Button variant="outline" className="rounded-none border-black" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {prelaunchTemplate && (
        <PreLaunchModal
          open={!!prelaunchTemplate}
          onClose={() => {
            setPrelaunchTemplate(null);
            setPrelaunchKeywordId(null);
          }}
          template={prelaunchTemplate}
          onLaunch={handlePrelaunchLaunch}
        />
      )}
    </>
  );
}

function TemplateGrid({
  templates,
  onSelect,
  isLoading,
}: {
  templates: Template[];
  onSelect: (t: Template) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading templates...</p>;
  }
  if (templates.length === 0) {
    return <p className="text-sm text-gray-400">No templates found.</p>;
  }
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {templates.map((t) => {
        const typeConfig = TYPE_CONFIG[t.type] || TYPE_CONFIG.blog_article;
        const TypeIcon = typeConfig.icon;
        return (
          <button
            key={t.id}
            className="w-full flex items-center gap-3 p-3 border border-gray-200 hover:border-black bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-left"
            onClick={() => onSelect(t)}
          >
            <TypeIcon className="h-4 w-4 text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{t.name}</div>
              {t.description && (
                <div className="text-xs text-gray-400 truncate">{t.description}</div>
              )}
            </div>
            <Badge variant="outline" className="text-xs shrink-0 capitalize">
              {t.type.replace(/_/g, " ")}
            </Badge>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
          </button>
        );
      })}
    </div>
  );
}
