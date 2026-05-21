import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Magnet, Rocket, Edit, Trash2, Copy } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { NewPageModal } from "@/components/content/NewPageModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog_article: "Blog Article",
  landing_page: "Landing Page",
  lead_magnet: "Lead Magnet",
};

const CONTENT_TYPE_ICONS: Record<string, typeof FileText> = {
  blog_article: FileText,
  landing_page: Rocket,
  lead_magnet: Magnet,
};

const STATUS_COLORS: Record<string, string> = {
  live: "bg-green-100 text-green-800",
  draft: "bg-gray-100 text-gray-700",
  idea: "bg-purple-100 text-purple-800",
  review: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  scheduled: "bg-orange-100 text-orange-800",
};

export default function SavedPages() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [newPageModalOpen, setNewPageModalOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/content-items"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/content-items");
      if (!response.ok) throw new Error("Failed to fetch pages");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const response = await apiRequest("DELETE", `/api/content-items/${id}`);
      if (!response.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-items"] });
      toast({ title: "Page deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const handleNew = () => {
    setNewPageModalOpen(true);
  };

  const handleEdit = (id: number | string) => {
    setLocation(`/pages/builder/${id}`);
  };

  const handleDelete = (id: number | string) => {
    if (confirm("Delete this page permanently?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCopyKeywords = (item: any) => {
    const parts = [
      item.primaryKeyword,
      ...(item.supportingKeywords ? item.supportingKeywords.split(",").map((s: string) => s.trim()).filter(Boolean) : []),
    ].filter(Boolean);
    if (parts.length === 0) {
      toast({ title: "No keywords to copy", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(parts.join(", ")).then(() => {
      toast({ title: "Keywords copied", description: `${parts.length} keyword${parts.length !== 1 ? "s" : ""} copied to clipboard` });
    });
  };

  const webpageTypes = ["blog_article", "landing_page", "lead_magnet"];
  const webpageItems = items.filter((item: any) => item.type === "webpage");
  const filtered = filter === "all" ? webpageItems : webpageItems.filter((item: any) => item.contentType === filter);

  return (
    <div>
      <div className="wt-page-header">
        <div className="mb-4">
          <h1 className="wt-page-title">Saved Pages</h1>
          <p className="text-gray-500 text-sm mt-1">All web content — blog articles, lead magnets and landing pages.</p>
        </div>
        <div>
          <Button onClick={handleNew} className="bg-black hover:bg-gray-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Page
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 border-b">
        {["all", ...webpageTypes].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === type
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {type === "all" ? "All Pages" : CONTENT_TYPE_LABELS[type]}
            {type !== "all" && (
              <span className="ml-1.5 text-xs text-gray-400">
                ({webpageItems.filter((i: any) => i.contentType === type).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading pages...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500">No pages yet.</p>
          <Button onClick={handleNew} variant="outline" className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Create your first page
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item: any) => {
            const subtype = item.contentType || item.type;
            const Icon = CONTENT_TYPE_ICONS[subtype] || FileText;
            const statusClass = STATUS_COLORS[item.status] || "bg-gray-100 text-gray-700";
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 bg-white"
              >
                <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.title || "Untitled"}</p>
                  <p className="text-xs text-gray-500 truncate">{item.slug || "—"}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {CONTENT_TYPE_LABELS[subtype] || subtype}
                </Badge>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusClass}`}>
                  {item.status}
                </span>
                <div className="flex gap-1 shrink-0">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyKeywords(item)}
                          className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
                          disabled={!item.primaryKeyword && !item.supportingKeywords}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Copy keywords</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(item.id)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewPageModal
        open={newPageModalOpen}
        onClose={() => setNewPageModalOpen(false)}
        initialType={filter !== "all" ? filter : undefined}
      />
    </div>
  );
}
