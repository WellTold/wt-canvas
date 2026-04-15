import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Heading2, AlignLeft, Image, List, Quote, MousePointerClick, Minus,
  ChevronsUpDown, Globe, Bookmark, Trash2, Search,
} from "lucide-react";

interface BlockDef {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  channels: ("web" | "email")[];
  fields: string[];
}

const BLOCKS: BlockDef[] = [
  { type: "heading",   label: "Heading",        description: "A section title rendered as H2, H3 or H4.",              icon: Heading2,          channels: ["web", "email"], fields: ["text", "level (2 | 3 | 4)"] },
  { type: "paragraph", label: "Paragraph",       description: "A block of rich text for body copy.",                    icon: AlignLeft,          channels: ["web", "email"], fields: ["text"] },
  { type: "image",     label: "Image",           description: "A full-width image with optional alt text and caption.", icon: Image,              channels: ["web", "email"], fields: ["url", "alt", "caption"] },
  { type: "list",      label: "List",            description: "An ordered or unordered list of items.",                 icon: List,               channels: ["web", "email"], fields: ["items[ ]", "ordered (boolean)"] },
  { type: "quote",     label: "Quote",           description: "A pull-quote with optional attribution.",                icon: Quote,              channels: ["web"],           fields: ["text", "author"] },
  { type: "cta",       label: "Call to Action",  description: "A highlighted section with a button that links somewhere.", icon: MousePointerClick, channels: ["web", "email"], fields: ["text", "buttonText", "link", "style"] },
  { type: "divider",   label: "Divider",         description: "A horizontal rule (line) or a configurable blank gap.", icon: Minus,              channels: ["web"],           fields: ["style (line | space)", "spacing (small | medium | large)"] },
  { type: "spacer",    label: "Spacer",          description: "A fixed-height blank space for layout control.",         icon: ChevronsUpDown,     channels: ["web"],           fields: ["height (px, 8–400)"] },
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
  const { toast } = useToast();

  const { data: presets = [], isLoading: presetsLoading } = useQuery<any[]>({
    queryKey: ["/api/block-presets"],
    enabled: activeTab === "presets",
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

  const filteredPresets = presets.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.blockType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">Block Library</h1>
          <p className="text-gray-500 text-sm mt-1">
            All available content block types and your saved presets.
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BLOCKS.map((block) => {
              const Icon = block.icon;
              return (
                <div
                  key={block.type}
                  className="border border-black p-4 bg-[#f0ebe7] hover:shadow-[4px_4px_0_0_#1a1a1a] transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 bg-white border border-black flex-shrink-0">
                      <Icon size={18} />
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
                      <p className="text-sm text-gray-600 mb-2">{block.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {block.fields.map((f) => (
                          <code key={f} className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 font-mono text-gray-500">
                            {f}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-4 border border-black bg-white">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={16} />
              <span className="font-semibold text-sm">More blocks coming soon</span>
            </div>
            <p className="text-sm text-gray-500">
              Accordion, Banner, Icon Row, Author Bio, Breadcrumb, Related Content, and full email-specific blocks are planned.
            </p>
          </div>
        </>
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
                          <Button size="sm" className="h-7 text-xs" onClick={() => renameMutation.mutate({ id: preset.id, name: editingName })}>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-black text-red-500 hover:text-red-700 shrink-0"
                      onClick={() => { if (window.confirm(`Delete "${preset.name}"?`)) deleteMutation.mutate(preset.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {preset.content && Object.keys(preset.content).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/10">
                      <p className="text-xs text-gray-500 font-mono truncate">
                        {JSON.stringify(preset.content).slice(0, 120)}
                        {JSON.stringify(preset.content).length > 120 ? "…" : ""}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
