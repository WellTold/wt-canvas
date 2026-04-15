import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Search, 
  Plus, 
  FileText, 
  Magnet, 
  Rocket, 
  Copy,
  Edit,
  Trash2,
  Layers,
  Calendar,
  User,
  List,
} from "lucide-react";
import { PreLaunchModal } from "@/components/content/PreLaunchModal";

interface TemplateBlock {
  block_id: string;
  block_type: string;
  ai_fillable: boolean;
  notes?: string;
  order?: number;
}

interface Template {
  id: string;
  name: string;
  type: string;
  description: string | null;
  system_prompt: string | null;
  user_prompt_addition: string | null;
  structure: any | null;
  sections: any | null;
  blocks: TemplateBlock[] | null;
  tags: string[] | null;
  preheader_text: string | null;
  email_header: any | null;
  email_footer: any | null;
  created_at: string;
  updated_at: string;
  mood?: string;
}

const typeConfig: Record<string, any> = {
  blog_article: {
    name: "Blog Articles",
    label: "Blog Article",
    icon: FileText,
    color: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-800"
  },
  landing_page: {
    name: "Landing Pages",
    label: "Landing Page",
    icon: Rocket,
    color: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-800"
  },
  lead_magnet: {
    name: "Lead Magnets",
    label: "Lead Magnet",
    icon: Magnet,
    color: "bg-yellow-50 border-yellow-200",
    badge: "bg-yellow-100 text-yellow-800"
  },
};

export default function Templates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [prelaunchTemplate, setPrelaunchTemplate] = useState<Template | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get("type");
    if (typeParam && typeConfig[typeParam]) {
      setSelectedCategory(typeParam);
    }
  }, []);

  // Fetch templates from Supabase — always scoped to webpage types only
  const { data: templates = [], isLoading, error } = useQuery<Template[]>({
    queryKey: ["/api/templates", "webpage", selectedCategory === "all" ? undefined : selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams({ category: "webpage" });
      if (selectedCategory !== "all") params.set("type", selectedCategory);
      const response = await apiRequest("GET", `/api/templates?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/templates/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates", "webpage"] });
      toast({
        title: "Template Deleted",
        description: "Template has been successfully removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template.",
        variant: "destructive",
      });
    },
  });

  // Duplicate template mutation
  const duplicateTemplateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await apiRequest("POST", `/api/templates/${id}/duplicate`, { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates", "webpage"] });
      toast({
        title: "Template Duplicated",
        description: "Template has been successfully copied.",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to duplicate template.",
        variant: "destructive",
      });
    },
  });

  // Filter templates based on search query
  const filteredTemplates = templates.filter(template => {
    const searchLower = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(searchLower) ||
      (template.description && template.description.toLowerCase().includes(searchLower)) ||
      (template.tags && template.tags.some(tag => tag.toLowerCase().includes(searchLower)))
    );
  });

  const handleUseTemplate = (template: Template) => {
    toast({
      title: "Template Applied",
      description: `${template.name} template is ready to use in your content editor.`
    });
    // TODO: Navigate to content editor with template
  };

  const handleEditTemplate = (template: Template) => {
    setLocation(`/templates/${template.id}?edit=true`);
  };

  const handleViewTemplate = (template: Template) => {
    setLocation(`/templates/${template.id}`);
  };

  const handleDeleteTemplate = (template: Template) => {
    if (window.confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
      deleteTemplateMutation.mutate(template.id);
    }
  };

  const handleDuplicateTemplate = (template: Template) => {
    const newName = prompt(`Enter a name for the duplicated template:`, `Copy of ${template.name}`);
    if (newName && newName.trim()) {
      duplicateTemplateMutation.mutate({ id: template.id, name: newName.trim() });
    }
  };

  if (error) {
    return (
      <div className="wt-page">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">Failed to load templates: {(error as Error).message}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="wt-page">
      <div className="wt-page-header">
        {/* Title Row */}
        <div className="mb-3">
          <h1 className="wt-page-title">Webpage Templates</h1>
        </div>
        
        {/* Description Row */}
        <div className="mb-4">
          <p className="wt-page-description">
            Reusable block structures and AI instructions for blog articles, landing pages, and lead magnets.
          </p>
        </div>
        
        {/* Action Button Row */}
        <div>
          <Link href="/template-builder">
            <Button className="bg-black hover:bg-gray-800 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="blog_article">Blog Articles</SelectItem>
            <SelectItem value="landing_page">Landing Pages</SelectItem>
            <SelectItem value="lead_magnet">Lead Magnets</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading templates...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const typeInfo = typeConfig[template.type] || typeConfig["blog_article"];
            const IconComponent = typeInfo.icon;
            
            return (
              <Card 
                key={template.id} 
                className={`hover-flat-shadow-blue transition-all border border-black cursor-pointer ${typeInfo.color}`}
                style={{ backgroundColor: '#f0ebe7' }}
                onClick={() => setPrelaunchTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5 text-gray-600" />
                      <CardTitle className="text-lg font-medium">{template.name}</CardTitle>
                    </div>
                    <Badge className={typeInfo.badge}>
                      {typeInfo.name}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {template.description || "No description available"}
                  </p>
                  
                  {/* Tags */}
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs px-2 py-0.5">
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                          +{template.tags.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {/* Structure and Section Info */}
                  <div className="space-y-2">
                    {template.structure && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Layers className="h-3 w-3" />
                        <span className="font-medium">Structure:</span>
                        <span>{typeof template.structure === 'object' && template.structure.sections ? `${template.structure.sections.length} sections` : 'Custom layout'}</span>
                      </div>
                    )}
                    
                    {template.sections && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <List className="h-3 w-3" />
                        <span className="font-medium">Sections:</span>
                        <span>{typeof template.sections === 'object' && Array.isArray(template.sections) ? `${template.sections.length} detailed sections` : 'Structured content'}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(template.created_at).toLocaleDateString()}
                    </div>
                    {template.system_prompt && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        AI-enabled
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrelaunchTemplate(template);
                      }}
                      className="bg-black hover:bg-gray-800 text-white"
                      size="sm"
                    >
                      Use Template
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTemplate(template);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit template</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateTemplate(template);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Duplicate template</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(template);
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete template</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredTemplates.length === 0 && !isLoading && (
        <div className="border border-black bg-[#f0ebe7] p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 border border-black bg-white">
              <Layers className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-lg font-semibold mb-2">
            {searchQuery
              ? "No templates match your search"
              : selectedCategory !== "all"
              ? `No ${typeConfig[selectedCategory]?.name || "templates"} yet`
              : "No templates available"}
          </h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
            {searchQuery
              ? "Try adjusting your search or clear the filter to see all templates."
              : selectedCategory !== "all"
              ? `Create your first ${typeConfig[selectedCategory]?.label || "template"} to get started with the template-driven creation flow.`
              : "Create your first template to enable the guided content creation flow."}
          </p>
          {!searchQuery && (
            <Link href={selectedCategory !== "all" ? `/template-builder?type=${selectedCategory}` : "/template-builder"}>
              <Button className="bg-black hover:bg-gray-800 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Create New Template
              </Button>
            </Link>
          )}
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
            const templateType = prelaunchTemplate.type;
            setPrelaunchTemplate(null);
            setLocation(`/pages/builder?templateId=${templateId}&type=${templateType}`);
          }}
        />
      )}
    </div>
  );
}