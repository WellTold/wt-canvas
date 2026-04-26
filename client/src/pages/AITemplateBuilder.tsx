import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, Plus, Trash2, ChevronUp, ChevronDown, FileText, Magnet, Rocket } from "lucide-react";

interface Section {
  id: string;
  label: string;
  instructions: string;
  order: number;
}

const CONTENT_TYPES = [
  { value: "blog_article",  label: "Blog Article",  icon: FileText },
  { value: "landing_page",  label: "Landing Page",  icon: Rocket   },
  { value: "lead_magnet",   label: "Lead Magnet",   icon: Magnet   },
];

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AITemplateBuilder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [name,         setName]         = useState("");
  const [contentType,  setContentType]  = useState("");
  const [description,  setDescription]  = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [sections, setSections] = useState<Section[]>([
    { id: generateId(), label: "Introduction", instructions: "Write an engaging opening that draws the reader in and sets up the main topic.", order: 0 },
  ]);

  const addSection = () => {
    setSections(prev => [
      ...prev,
      { id: generateId(), label: "", instructions: "", order: prev.length },
    ]);
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })));
  };

  const updateSection = (id: string, field: "label" | "instructions", value: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swap = direction === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const blocks = sections.map((s, i) => ({
        block_id:     s.id,
        label:        s.label.trim(),
        instructions: s.instructions.trim(),
        order:        i,
      }));

      const payload = {
        name:                 name.trim(),
        type:                 contentType,
        description:          description.trim() || null,
        system_prompt:        systemPrompt.trim() || null,
        user_prompt_addition: null,
        blocks,
      };

      const res = await apiRequest("POST", "/api/templates", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err?.message || `Save failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template saved", description: `"${name}" has been created.` });
      setLocation(`/templates/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter a template name.", variant: "destructive" });
      return;
    }
    if (!contentType) {
      toast({ title: "Type required", description: "Please select a content type.", variant: "destructive" });
      return;
    }
    if (sections.length === 0) {
      toast({ title: "Sections required", description: "Add at least one section.", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const selectedType = CONTENT_TYPES.find(t => t.value === contentType);

  return (
    <div className="wt-page">
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">Build AI Template</h1>
          <p className="wt-page-description">
            Define sections with instructions — one AI call generates the complete document.
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

        {/* ── Left column: metadata ─────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">

          <Card className="border border-black" style={{ backgroundColor: "#f0ebe7" }}>
            <CardHeader>
              <CardTitle className="text-base">Template Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-1">
                <Label>Template Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. Product Spotlight Blog"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="border-black"
                />
              </div>

              <div className="space-y-1">
                <Label>Content Type <span className="text-red-500">*</span></Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger className="border-black">
                    <SelectValue placeholder="Select a type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <t.icon className="h-4 w-4" />
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedType && (
                  <Badge variant="outline" className="mt-1 border-black text-xs">
                    {selectedType.label}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of what this template is for…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="border-black resize-none"
                  rows={3}
                />
              </div>

            </CardContent>
          </Card>

          <Card className="border border-black" style={{ backgroundColor: "#f0ebe7" }}>
            <CardHeader>
              <CardTitle className="text-base">AI System Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 mb-2">
                  Overall instruction sent to the AI before the section list. Sets tone, audience, brand voice, and any global constraints.
                </p>
                <Textarea
                  placeholder="e.g. You are a content writer for Well Told, a purpose-driven gift brand. Write in a warm, conversational tone. Avoid jargon. Target audience: gift buyers aged 30–55…"
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  className="border-black resize-none font-mono text-sm"
                  rows={10}
                />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── Right column: sections ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base">Content Sections</h2>
              <p className="text-xs text-gray-500">
                Each section becomes a named block in the AI's output. Add instructions to guide what the AI writes.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-black"
              onClick={addSection}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>

          {sections.length === 0 && (
            <Card className="border border-dashed border-gray-300 text-center py-12">
              <CardContent>
                <p className="text-gray-400 text-sm">No sections yet. Add one to get started.</p>
              </CardContent>
            </Card>
          )}

          {sections.map((section, idx) => (
            <Card
              key={section.id}
              className="border border-black"
              style={{ backgroundColor: "#f0ebe7" }}
            >
              <CardContent className="pt-4 space-y-3">

                {/* Section header row */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 w-6 shrink-0 text-center">{idx + 1}</span>

                  <Input
                    placeholder="Section label (e.g. Introduction)"
                    value={section.label}
                    onChange={e => updateSection(section.id, "label", e.target.value)}
                    className="border-black font-medium flex-1"
                  />

                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveSection(section.id, "up")}
                      disabled={idx === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveSection(section.id, "down")}
                      disabled={idx === sections.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => removeSection(section.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="pl-8">
                  <Textarea
                    placeholder="Instructions for the AI — what should this section contain, how long, what tone, any specific points to cover…"
                    value={section.instructions}
                    onChange={e => updateSection(section.id, "instructions", e.target.value)}
                    className="border-black resize-none text-sm"
                    rows={3}
                  />
                </div>

              </CardContent>
            </Card>
          ))}

          {sections.length > 0 && (
            <Button
              variant="outline"
              className="w-full border-dashed border-black text-gray-500"
              onClick={addSection}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Section
            </Button>
          )}

        </div>
      </div>
    </div>
  );
}
