import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Code2, Save, RotateCcw, ChevronRight } from "lucide-react";
import type { EmailSnippet } from "@shared/schema";

export default function SnippetsEditor() {
  const { data: user } = useAuth();
  const { toast } = useToast();
  const isAdminOrDev = user?.role === "admin" || user?.role === "developer";

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [editedHtml, setEditedHtml] = useState<string>("");
  const [editedLabel, setEditedLabel] = useState<string>("");
  const [editedDescription, setEditedDescription] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);

  const { data: snippets = [], isLoading } = useQuery<EmailSnippet[]>({
    queryKey: ["/api/snippets"],
  });

  const selectedSnippet = snippets.find((s) => s.name === selectedName) ?? null;

  useEffect(() => {
    if (selectedName || snippets.length === 0) return;
    const requestedName = new URLSearchParams(window.location.search).get("name");
    const requested = requestedName && snippets.find((s) => s.name === requestedName);
    if (requested) selectSnippet(requested);
  }, [snippets, selectedName]);

  function selectSnippet(snippet: EmailSnippet) {
    setSelectedName(snippet.name);
    setEditedHtml(snippet.html);
    setEditedLabel(snippet.label);
    setEditedDescription(snippet.description ?? "");
    setIsDirty(false);
  }

  function handleHtmlChange(value: string) {
    setEditedHtml(value);
    setIsDirty(true);
  }

  function handleLabelChange(value: string) {
    setEditedLabel(value);
    setIsDirty(true);
  }

  function handleDescriptionChange(value: string) {
    setEditedDescription(value);
    setIsDirty(true);
  }

  function resetChanges() {
    if (!selectedSnippet) return;
    setEditedHtml(selectedSnippet.html);
    setEditedLabel(selectedSnippet.label);
    setEditedDescription(selectedSnippet.description ?? "");
    setIsDirty(false);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedName) throw new Error("No snippet selected");
      return apiRequest("PUT", `/api/snippets/${selectedName}`, {
        label: editedLabel,
        description: editedDescription,
        html: editedHtml,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      setIsDirty(false);
      toast({ title: "Snippet saved", description: `"${editedLabel}" has been updated.` });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  if (!isAdminOrDev) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="border-b border-black px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Code2 size={20} />
          <div>
            <h1 className="text-xl font-semibold leading-tight">Snippets Editor</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Edit named HTML snippets used in email html_block components.
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: snippet list */}
        <div className="w-64 flex-shrink-0 border-r border-black overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse" />
              ))}
            </div>
          ) : snippets.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No snippets found.</p>
          ) : (
            <ul>
              {snippets.map((snippet) => {
                const isActive = snippet.name === selectedName;
                return (
                  <li key={snippet.name}>
                    <button
                      onClick={() => selectSnippet(snippet)}
                      className={[
                        "w-full text-left px-4 py-3 border-b border-black flex items-center justify-between gap-2 transition-colors",
                        isActive
                          ? "bg-black text-white"
                          : "bg-[#f0ebe7] hover:bg-stone-200",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{snippet.label}</p>
                        <p className={`text-xs truncate mt-0.5 ${isActive ? "text-stone-300" : "text-muted-foreground"}`}>
                          {snippet.name}
                        </p>
                      </div>
                      {isActive && <ChevronRight size={14} className="flex-shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right: editor */}
        {selectedSnippet === null ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a snippet to edit
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Editor header */}
            <div className="border-b border-black px-5 py-3 flex-shrink-0 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={editedLabel}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    className="text-base font-semibold bg-transparent border-0 outline-none focus:ring-0 p-0 min-w-0 w-auto"
                    style={{ fontFamily: "inherit" }}
                    placeholder="Snippet label"
                  />
                  {isDirty && (
                    <Badge variant="outline" className="text-xs border-black">
                      Unsaved
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-muted-foreground bg-stone-100 border border-black px-1.5 py-0.5">
                    {selectedSnippet.name}
                  </code>
                </div>
                <input
                  type="text"
                  value={editedDescription}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  className="text-xs text-muted-foreground bg-transparent border-0 outline-none focus:ring-0 p-0 mt-1.5 w-full"
                  style={{ fontFamily: "inherit" }}
                  placeholder="Description (optional)"
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isDirty && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetChanges}
                    className="border-black"
                  >
                    <RotateCcw size={13} className="mr-1" />
                    Reset
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !isDirty}
                  className="bg-black text-white hover:bg-stone-800"
                >
                  {saveMutation.isPending ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save size={13} className="mr-1" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* HTML textarea */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-5 pt-3 pb-1 flex-shrink-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">HTML</p>
              </div>
              <textarea
                value={editedHtml}
                onChange={(e) => handleHtmlChange(e.target.value)}
                className="flex-1 min-h-0 px-5 pb-5 font-mono text-xs leading-relaxed resize-none outline-none border-0 bg-white w-full"
                spellCheck={false}
                placeholder="<!-- paste snippet HTML here -->"
              />
            </div>

            {/* Footer metadata */}
            <div className="border-t border-black px-5 py-2 flex-shrink-0 flex items-center gap-4 bg-[#f0ebe7]">
              <span className="text-xs text-muted-foreground">
                {editedHtml.length.toLocaleString()} characters
              </span>
              <span className="text-xs text-muted-foreground">
                Last updated:{" "}
                {new Date(selectedSnippet.updatedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
