import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const MOODS = [
  { value: "warm-sentimental", label: "Warm & Sentimental" },
  { value: "celebratory",      label: "Celebratory" },
  { value: "urgent",           label: "Urgent" },
  { value: "helpful",          label: "Helpful" },
  { value: "conversational",   label: "Conversational" },
  { value: "aspirational",     label: "Aspirational" },
];

interface TemplateBlock {
  block_id: string;
  block_type: string;
  ai_fillable: boolean;
  notes?: string;
  order?: number;
}

interface PreLaunchModalProps {
  open: boolean;
  onClose: () => void;
  template: {
    id: string;
    name: string;
    type: string;
    mood?: string;
    structure?: any;
    blocks?: TemplateBlock[] | null;
    system_prompt?: string | null;
    user_prompt_addition?: string | null;
  };
  onLaunch: (params: {
    mode: "auto" | "manual";
    description: string;
    titleHint?: string;
    contextFields: Record<string, string>;
    mood: string;
    generatedContent?: Record<string, string>;
  }) => void;
}

export function PreLaunchModal({ open, onClose, template, onLaunch }: PreLaunchModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [description, setDescription] = useState("");
  const [titleHint, setTitleHint] = useState("");
  const [mood, setMood] = useState(template.mood || "conversational");
  const [contextFields, setContextFields] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmailType = template.type.includes("email");

  // Determine which context fields to show
  const nameLower = template.name.toLowerCase();
  const typeLower = template.type.toLowerCase();
  
  const showProductFields = typeLower.includes("product") || nameLower.includes("product") || nameLower.includes("collection");
  const showSaleFields = typeLower.includes("sale") || typeLower.includes("promo") || nameLower.includes("sale") || nameLower.includes("promo");
  const showCauseFields = typeLower.includes("give") || typeLower.includes("mission") || typeLower.includes("cause") || nameLower.includes("give") || nameLower.includes("mission") || nameLower.includes("cause");
  const showGenericEmailField = isEmailType && !showProductFields && !showSaleFields && !showCauseFields;

  const handleContextChange = (key: string, value: string) => {
    setContextFields(prev => ({ ...prev, [key]: value }));
  };

  const handleLaunch = async () => {
    if (mode === "manual") {
      onLaunch({ mode, description, titleHint, contextFields, mood });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please provide a description for the content generation.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Prefer the strongly-typed blocks column; fall back to structure array
      let blocksToSend: TemplateBlock[] = [];
      if (Array.isArray(template.blocks) && template.blocks.length > 0) {
        blocksToSend = template.blocks;
      } else {
        const rawStructure = Array.isArray(template.structure)
          ? template.structure
          : (template.structure?.sections || template.structure?.blocks || []);
        blocksToSend = rawStructure.map((b: any, i: number) => {
          if (typeof b === 'string') {
            return { block_id: b, block_type: 'paragraph', ai_fillable: true, order: i };
          }
          return {
            block_id: b.block_id || b.id || `block_${i}`,
            block_type: b.block_type || b.type || 'paragraph',
            ai_fillable: b.ai_fillable !== false,
            notes: b.notes || b.description,
            order: b.order ?? i,
          };
        });
      }

      const response = await apiRequest("POST", "/api/ai/generate-content", {
        template_type: template.type,
        mood,
        description,
        title_hint: titleHint,
        context_fields: contextFields,
        blocks: blocksToSend,
        template_system_prompt: template.system_prompt || undefined,
        template_user_prompt_addition: template.user_prompt_addition || undefined,
      });

      const result = await response.json();
      if (result.success) {
        onLaunch({
          mode: "auto",
          description,
          titleHint,
          contextFields,
          mood,
          generatedContent: result.generated
        });
      } else {
        throw new Error(result.message || "Generation failed");
      }
    } catch (err: any) {
      console.error("Auto-generation error:", err);
      setError("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-2xl border-black rounded-none bg-[#fbfaf9] p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-black bg-white">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">{template.name}</DialogTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge
                  variant="outline"
                  className="cursor-pointer border-black hover:bg-black hover:text-white transition-colors select-none py-1 px-3 rounded-none"
                >
                  ✦ {MOODS.find(m => m.value === mood)?.label || "Conversational"}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-none border-black">
                {MOODS.map(m => (
                  <DropdownMenuItem 
                    key={m.value} 
                    onClick={() => setMood(m.value)}
                    className="rounded-none cursor-pointer"
                  >
                    {mood === m.value && <span className="mr-2">✓</span>}
                    {m.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
              <p className="text-sm font-medium">Generating content for {template.name}...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
                  <span>{error}</span>
                  <Button variant="outline" size="sm" onClick={handleLaunch} className="border-red-200 hover:bg-red-100 h-7 text-xs">
                    Try again
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-bold uppercase tracking-wider">
                  What is this {isEmailType ? "email" : "page"} about? <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder={isEmailType 
                    ? "Include key details — product names, offer specifics, the story you want to tell."
                    : "Include the topic, key points, and the audience you're writing for."}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-none border-black min-h-[120px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="titleHint" className="text-sm font-bold uppercase tracking-wider">
                  Title or subject line (optional)
                </Label>
                <Input
                  id="titleHint"
                  placeholder="AI will generate one if left blank"
                  value={titleHint}
                  onChange={(e) => setTitleHint(e.target.value)}
                  className="rounded-none border-black"
                />
              </div>

              {/* Context Fields */}
              {(showProductFields || showSaleFields || showCauseFields || showGenericEmailField) && (
                <div className="space-y-4 p-4 bg-[#f0ebe7] border border-black">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Additional Context</p>
                  
                  {showProductFields && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Product Name</Label>
                        <Input 
                          className="rounded-none border-black bg-white h-8 text-sm" 
                          onChange={(e) => handleContextChange("product_name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Key Details / Materials</Label>
                        <Input 
                          className="rounded-none border-black bg-white h-8 text-sm" 
                          onChange={(e) => handleContextChange("product_details", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Product URL (Optional)</Label>
                        <Input 
                          className="rounded-none border-black bg-white h-8 text-sm" 
                          onChange={(e) => handleContextChange("product_url", e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {showSaleFields && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Offer Description</Label>
                        <Input 
                          className="rounded-none border-black bg-white h-8 text-sm" 
                          placeholder="e.g. 20% off site-wide"
                          onChange={(e) => handleContextChange("offer_description", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Promo Code</Label>
                        <Input 
                          className="rounded-none border-black bg-white h-8 text-sm" 
                          onChange={(e) => handleContextChange("promo_code", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Sale End Date</Label>
                        <Input 
                          type="date"
                          className="rounded-none border-black bg-white h-8 text-sm" 
                          onChange={(e) => handleContextChange("sale_end_date", e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {showCauseFields && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Cause or Charity Name</Label>
                        <Input 
                          className="rounded-none border-black bg-white h-8 text-sm" 
                          onChange={(e) => handleContextChange("cause_name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Impact Stat or Story Detail</Label>
                        <Input 
                          className="rounded-none border-black bg-white h-8 text-sm" 
                          onChange={(e) => handleContextChange("impact_detail", e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {showGenericEmailField && (
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Product Name (Optional)</Label>
                      <Input 
                        className="rounded-none border-black bg-white h-8 text-sm" 
                        onChange={(e) => handleContextChange("product_name", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div 
                  className={`p-4 border-2 cursor-pointer transition-all ${mode === "auto" ? "border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : "border-dashed border-gray-300 bg-transparent hover:border-gray-400"}`}
                  onClick={() => setMode("auto")}
                >
                  <div className="font-bold text-sm mb-1 flex items-center gap-2">
                    <span className="text-lg">✦</span> Auto-Generate
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">AI fills every text block in this template at once. Edit anything after.</p>
                </div>
                <div 
                  className={`p-4 border-2 cursor-pointer transition-all ${mode === "manual" ? "border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : "border-dashed border-gray-300 bg-transparent hover:border-gray-400"}`}
                  onClick={() => setMode("manual")}
                >
                  <div className="font-bold text-sm mb-1 flex items-center gap-2">
                    <span className="text-lg">✎</span> Open Manually
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">Start with a blank template. Use per-block generate buttons as you go.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t border-black bg-white gap-3 sm:justify-end">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="rounded-none border-black"
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleLaunch} 
            className="rounded-none bg-black hover:bg-gray-800 text-white min-w-[140px]"
            disabled={isGenerating}
          >
            {mode === "auto" ? "Generate & Open →" : "Open Template →"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
