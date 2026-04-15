import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, Plus, Mail, Workflow, Copy, Edit, Trash2, Layers, Calendar } from "lucide-react";
import { PreLaunchModal } from "@/components/content/PreLaunchModal";

interface Template {
  id: string;
  name: string;
  type: string;
  description: string | null;
  structure: any | null;
  preheader_text: string | null;
  email_header: any | null;
  email_footer: any | null;
  created_at: string;
  updated_at: string;
  mood?: string;
}

const typeConfig: Record<string, { label: string; icon: any; badge: string }> = {
  email_campaign: { label: "Campaign",     icon: Mail,     badge: "bg-orange-100 text-orange-800 border-orange-200" },
  email_flow:     { label: "Flow",         icon: Workflow,  badge: "bg-purple-100 text-purple-800 border-purple-200" },
};

export default function EmailTemplates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [prelaunchTemplate, setPrelaunchTemplate] = useState<Template | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates", "email"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/templates?category=email");
      if (!res.ok) throw new Error("Failed to fetch email templates");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/templates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates", "email"] });
      toast({ title: "Template deleted" });
    },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("POST", `/api/templates/${id}/duplicate`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates", "email"] });
      toast({ title: "Template duplicated" });
    },
    onError: () => toast({ title: "Failed to duplicate template", variant: "destructive" }),
  });

  const filtered = templates.filter(t => {
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
  });

  const handleDelete = (t: Template) => {
    if (window.confirm(`Delete "${t.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(t.id);
    }
  };

  const handleDuplicate = (t: Template) => {
    const name = prompt("Name for the copy:", `Copy of ${t.name}`);
    if (name?.trim()) duplicateMutation.mutate({ id: t.id, name: name.trim() });
  };

  const sectionCount = (t: Template) => {
    if (!t.structure) return 0;
    if (Array.isArray(t.structure)) return t.structure.length;
    if (Array.isArray(t.structure?.sections)) return t.structure.sections.length;
    return 0;
  };

  return (
    <div>
      <div className="wt-page-header">
        <div className="mb-3">
          <h1 className="wt-page-title">Email Templates</h1>
        </div>
        <div className="mb-4">
          <p className="text-gray-500 text-sm">
            Reusable structures for email campaigns and flows. Define sections, AI instructions, header and footer once — apply to any email.
          </p>
        </div>
        <div>
          <Link href="/template-builder?emailType=email_campaign">
            <Button className="bg-black hover:bg-gray-800 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search email templates..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 border border-black bg-[#f0ebe7] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-black bg-[#f0ebe7] p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 border border-black bg-white">
              <Mail size={32} />
            </div>
          </div>
          <h2 className="text-lg font-semibold mb-2">
            {searchQuery ? "No templates match your search" : "No email templates yet"}
          </h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
            Create your first email template to define the block structure, header, footer, and AI instructions for your campaigns.
          </p>
          {!searchQuery && (
            <Link href="/template-builder?emailType=email_campaign">
              <Button className="bg-black hover:bg-gray-800 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Create First Template
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(template => {
            const cfg = typeConfig[template.type] || typeConfig.email_campaign;
            const Icon = cfg.icon;
            return (
              <Card
                key={template.id}
                className="border border-black bg-[#f0ebe7] hover-flat-shadow cursor-pointer transition-all"
                onClick={() => setPrelaunchTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 border border-black bg-white shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-sm font-semibold leading-tight truncate">
                        {template.name}
                      </CardTitle>
                    </div>
                    <Badge className={`text-xs border shrink-0 ${cfg.badge}`}>
                      {cfg.label}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {template.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">{template.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {sectionCount(template)} sections
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(template.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>

                  {template.preheader_text && (
                    <p className="text-xs text-gray-400 italic truncate">"{template.preheader_text}"</p>
                  )}

                  <div
                    className="flex gap-2 pt-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-black text-xs"
                      onClick={() => setLocation(`/email-templates/${template.id}?edit=true`)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-black text-xs px-2"
                      onClick={() => handleDuplicate(template)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-black text-xs px-2 text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(template)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {prelaunchTemplate && (
        <PreLaunchModal
          open={!!prelaunchTemplate}
          onClose={() => setPrelaunchTemplate(null)}
          template={prelaunchTemplate}
          onLaunch={(params) => {
            if (params.generatedContent) {
              sessionStorage.setItem(`prelaunch_content_${prelaunchTemplate.id}`, JSON.stringify(params.generatedContent));
            }
            sessionStorage.setItem(`prelaunch_context_${prelaunchTemplate.id}`, JSON.stringify({
              description: params.description,
              mood: params.mood,
              contextFields: params.contextFields,
            }));
            const templateId = prelaunchTemplate.id;
            const emailType = prelaunchTemplate.type;
            setPrelaunchTemplate(null);
            setLocation(`/email-builder?templateId=${templateId}&type=${emailType}`);
          }}
        />
      )}
    </div>
  );
}
