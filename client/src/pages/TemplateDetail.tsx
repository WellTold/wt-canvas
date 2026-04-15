import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft,
  Save,
  Edit,
  Eye,
  FileText,
  Magnet,
  Rocket,
  Settings,
  Code,
  Plus,
  GripVertical,
  Trash2,
  Type,
  AlignLeft,
  Image,
  ExternalLink,
  Quote,
  List,
  Mail,
  Workflow,
} from "lucide-react";
import { CloudinaryAssetSelector } from "@/components/CloudinaryAssetSelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Template {
  id: string;
  name: string;
  type: string;
  description: string | null;
  system_prompt: string | null;
  user_prompt_addition: string | null;
  structure: any | null;
  sections: any | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  mood: string | null;
  preheader_text?: string;
  email_header?: any;
  email_footer?: any;
}

const MOODS = [
  { value: "warm-sentimental", label: "Warm & Sentimental" },
  { value: "celebratory",      label: "Celebratory" },
  { value: "urgent",           label: "Urgent" },
  { value: "helpful",          label: "Helpful" },
  { value: "conversational",   label: "Conversational" },
  { value: "aspirational",     label: "Aspirational" },
];

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
  email_campaign: {
    name: "Email Campaigns",
    label: "Email Campaign",
    icon: Mail,
    color: "bg-orange-50 border-orange-200",
    badge: "bg-orange-100 text-orange-800"
  },
  email_flow: {
    name: "Email Flows",
    label: "Email Flow",
    icon: Workflow,
    color: "bg-purple-50 border-purple-200",
    badge: "bg-purple-100 text-purple-800"
  },
};

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Image selection state
  const [templateImages, setTemplateImages] = useState<{[key: string]: string}>({});
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [selectedImageKey, setSelectedImageKey] = useState<string>("");
  
  // Get edit mode from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const isEditMode = urlParams.get('edit') === 'true';
  
  const [editMode, setEditMode] = useState(isEditMode);
  const [moodOverride, setMoodOverride] = useState<string | null>(() => {
    return sessionStorage.getItem("mood_" + id);
  });
  const [structureViewMode, setStructureViewMode] = useState<'visual' | 'json'>('visual');
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: '',
    system_prompt: '',
    user_prompt_addition: '',
    structure: '',
    sections: '',
    tags: '',
    mood: ''
  });
  const [structureBlocks, setStructureBlocks] = useState<any[]>([]);

  // Email-template constant fields
  const [preheaderText, setPreheaderText] = useState('');
  const [selectedEmailStyleId, setSelectedEmailStyleId] = useState<string>("none");

  const EMAIL_TYPES = ['email_campaign', 'email_flow'];
  const isEmailType = EMAIL_TYPES.includes(formData.type);

  // Fetch email styles for the selector
  const { data: emailStylesList = [] } = useQuery<any[]>({
    queryKey: ["/api/email-styles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/email-styles");
      if (!response.ok) throw new Error("Failed to fetch email styles");
      return response.json();
    }
  });

  // Fetch template details
  const { data: template, isLoading, error } = useQuery<Template>({
    queryKey: ["/api/templates", id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/templates/${id}`);
      if (!response.ok) throw new Error("Failed to fetch template");
      return response.json();
    },
    enabled: !!id
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (data: Partial<Template>) => {
      const response = await apiRequest("PUT", `/api/templates/${id}`, data);
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errBody?.message || `Save failed (${response.status})`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates", id] });
      setEditMode(false);
      toast({
        title: "Template Updated",
        description: "Template has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update template.",
        variant: "destructive",
      });
    },
  });

  // Handle mood change
  const handleMoodChange = (mood: string | null) => {
    setMoodOverride(mood);
    if (mood) {
      sessionStorage.setItem("mood_" + id, mood);
    } else {
      sessionStorage.removeItem("mood_" + id);
    }
    toast({ 
      title: mood 
        ? `Mood updated to ${MOODS.find(m => m.value === mood)?.label}` 
        : "Mood reset to template default"
    });
  };

  // Initialize form data when template loads
  useEffect(() => {
    if (template) {
      const structureData = template.structure ? 
        (typeof template.structure === 'string' ? 
          JSON.parse(template.structure) : 
          template.structure) : [];
      
      setFormData({
        name: template.name,
        type: template.type,
        description: template.description || '',
        system_prompt: template.system_prompt || '',
        user_prompt_addition: template.user_prompt_addition || '',
        structure: template.structure ? JSON.stringify(structureData, null, 2) : '',
        sections: template.sections ? JSON.stringify(template.sections, null, 2) : '',
        tags: template.tags ? template.tags.join(', ') : '',
        mood: template.mood || 'conversational'
      });
      setStructureBlocks(Array.isArray(structureData) ? structureData : []);

      // Email constants
      setPreheaderText(template.preheader_text || '');
    }
  }, [template]);

  const handleSave = () => {
    const structureToSave = structureViewMode === 'visual' ? 
      structureBlocks : 
      (formData.structure ? JSON.parse(formData.structure) : null);
      
    const sectionsToSave = formData.sections ? 
      (typeof formData.sections === 'string' ? JSON.parse(formData.sections) : formData.sections) : 
      null;
    
    const tagsToSave = formData.tags ? 
      formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : 
      null;

    const isEmail = EMAIL_TYPES.includes(formData.type);

    const selectedStyle = emailStylesList.find((s: any) => String(s.id) === selectedEmailStyleId);

    const updateData: Partial<Template> = {
      name: formData.name,
      type: formData.type,
      description: formData.description || null,
      system_prompt: formData.system_prompt || null,
      user_prompt_addition: formData.user_prompt_addition || null,
      structure: structureToSave,
      sections: sectionsToSave,
      tags: tagsToSave,
      mood: formData.mood || null,
      ...(isEmail && {
        preheader_text: preheaderText.trim() || null,
        ...(selectedStyle && {
          email_header: { logoUrl: selectedStyle.logoUrl || '', logoLink: selectedStyle.logoLink || '' },
          email_footer: {
            address: selectedStyle.footerAddress || '',
            unsubscribeLink: selectedStyle.unsubscribeLink || '',
            socialLinks: Array.isArray(selectedStyle.socialLinks) ? selectedStyle.socialLinks : [],
          },
        }),
      }),
    };

    updateTemplateMutation.mutate(updateData);
  };

  // Visual editor functions
  const addSection = (type: string) => {
    const newSection = {
      id: Date.now().toString(),
      type,
      title: `New ${type}`,
      description: `Description for ${type} section`,
      ...(type === 'list' && { items: [] }),
      ...(type === 'image' && { alt: '', caption: '', imageKey: `image_${Date.now()}` }),
      ...(type === 'cta' && { buttonText: 'Click Here', url: '' }),
      ...(type === 'quote' && { author: '' })
    };
    
    setStructureBlocks([...structureBlocks, newSection]);
  };

  const updateSection = (index: number, updates: any) => {
    const updated = [...structureBlocks];
    updated[index] = { ...updated[index], ...updates };
    setStructureBlocks(updated);
  };

  const removeSection = (index: number) => {
    setStructureBlocks(structureBlocks.filter((_, i) => i !== index));
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    const updated = [...structureBlocks];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setStructureBlocks(updated);
  };

  const syncFromJson = () => {
    try {
      const parsed = JSON.parse(formData.structure);
      setStructureBlocks(Array.isArray(parsed) ? parsed : []);
      setStructureViewMode('visual');
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid JSON format",
        variant: "destructive",
      });
    }
  };

  const syncToJson = () => {
    setFormData({
      ...formData,
      structure: JSON.stringify(structureBlocks, null, 2)
    });
    setStructureViewMode('json');
  };

  // Image selection functions
  const handleImageSelection = (imageKey: string) => {
    setSelectedImageKey(imageKey);
    setIsAssetSelectorOpen(true);
  };

  const handleAssetSelect = (asset: any) => {
    if (selectedImageKey) {
      setTemplateImages({
        ...templateImages,
        [selectedImageKey]: asset.secure_url
      });
    }
    setIsAssetSelectorOpen(false);
    setSelectedImageKey("");
  };

  // Get image sections from structure
  const getImageSections = () => {
    return structureBlocks
      .map((block, index) => ({ ...block, order: index + 1 }))
      .filter(block => block.type === 'image');
  };;

  const handleCancel = () => {
    if (template) {
      setFormData({
        name: template.name,
        type: template.type,
        description: template.description || '',
        system_prompt: template.system_prompt || '',
        user_prompt_addition: template.user_prompt_addition || '',
        structure: template.structure ? JSON.stringify(template.structure, null, 2) : '',
        sections: template.sections ? JSON.stringify(template.sections, null, 2) : '',
        tags: template.tags ? template.tags.join(', ') : '',
        mood: template.mood || 'conversational'
      });
    }
    setEditMode(false);
  };

  if (error) {
    return (
      <div className="wt-page">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">Failed to load template: {(error as Error).message}</p>
          <Link href="/templates">
            <Button>Back to Templates</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !template) {
    return (
      <div className="wt-page">
        <div className="text-center py-12">
          <p className="text-gray-500">Loading template...</p>
        </div>
      </div>
    );
  }

  const typeInfo = typeConfig[template.type] || typeConfig["blog_article"];
  const IconComponent = typeInfo.icon;

  return (
    <div className="wt-page">
      {/* Header */}
      <div className="wt-page-header">
        {/* Back Button Row */}
        <div className="mb-4">
          <Link href="/templates">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
          </Link>
        </div>
        
        {/* Title Row */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <IconComponent className="h-6 w-6 text-gray-600" />
            <h1 className="wt-page-title">{editMode ? 'Edit Template' : 'Template Preview'}</h1>
            <div className="ml-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`cursor-pointer border-black hover:bg-black hover:text-white transition-colors select-none py-1 px-3 rounded-none ${moodOverride ? "bg-black text-white" : ""}`}
                  >
                    ✦ {MOODS.find(m => m.value === (moodOverride || template?.mood || "conversational"))?.label || "Conversational"}
                    {moodOverride && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />}
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-none border-black">
                  {MOODS.map(m => (
                    <DropdownMenuItem key={m.value} onClick={() => handleMoodChange(m.value)} className="rounded-none cursor-pointer">
                      {(moodOverride || template?.mood) === m.value && <span className="mr-2">✓</span>}
                      {m.label}
                    </DropdownMenuItem>
                  ))}
                  {moodOverride && (
                    <DropdownMenuItem onClick={() => handleMoodChange(null)} className="text-muted-foreground rounded-none cursor-pointer">
                      Reset to template default
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        
        {/* Content Type Badge Row */}
        <div className="mb-4">
          <Badge className={typeInfo.badge}>
            {typeInfo.name}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!editMode ? (
            <Button 
              onClick={() => setEditMode(true)}
              className="bg-black hover:bg-gray-800 text-white"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Template
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={updateTemplateMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={updateTemplateMutation.isPending}
                className="bg-black hover:bg-gray-800 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateTemplateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Basic Information */}
        <Card className="border border-black" style={{ backgroundColor: '#f0ebe7' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              {editMode ? (
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 text-gray-900 font-medium">{template.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="type">Template Type</Label>
              {editMode ? (
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blog_article">Blog Article</SelectItem>
                    <SelectItem value="landing_page">Landing Page</SelectItem>
                    <SelectItem value="lead_magnet">Lead Magnet</SelectItem>
                    <SelectItem value="email_campaign">Email Campaign</SelectItem>
                    <SelectItem value="email_flow">Email Flow</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 text-gray-900 font-medium">{typeConfig[template.type]?.label || template.type}</p>
              )}
            </div>

            <div>
              <Label htmlFor="mood">Default AI Mood</Label>
              {editMode ? (
                <Select value={formData.mood} onValueChange={(value) => setFormData({ ...formData, mood: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 text-gray-900 font-medium">
                  {MOODS.find(m => m.value === template.mood)?.label || "Conversational"}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              {editMode ? (
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="mt-1"
                  placeholder="Enter template description..."
                />
              ) : (
                <p className="mt-1 text-gray-700">{template.description || "No description available"}</p>
              )}
            </div>

            <div>
              <Label htmlFor="tags">Tags</Label>
              {editMode ? (
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="mt-1"
                  placeholder="Enter tags separated by commas (e.g., SEO, Marketing, Guide)"
                />
              ) : (
                <div className="mt-1">
                  {template.tags && template.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No tags assigned</p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Created: {new Date(template.created_at).toLocaleDateString()}</span>
                <span>Updated: {new Date(template.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Instructions */}
        <Card className="border border-black" style={{ backgroundColor: '#f0ebe7' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              AI Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="system_prompt">System Prompt</Label>
              {editMode ? (
                <Textarea
                  id="system_prompt"
                  value={formData.system_prompt}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  rows={4}
                  className="mt-1 font-mono text-sm"
                  placeholder="Enter system prompt for AI generation..."
                />
              ) : (
                <div className="mt-1 p-3 bg-gray-50 rounded border font-mono text-sm">
                  {template.system_prompt || "No system prompt defined"}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="user_prompt_addition">User Prompt Addition</Label>
              {editMode ? (
                <Textarea
                  id="user_prompt_addition"
                  value={formData.user_prompt_addition}
                  onChange={(e) => setFormData({ ...formData, user_prompt_addition: e.target.value })}
                  rows={3}
                  className="mt-1 font-mono text-sm"
                  placeholder="Additional instructions for user prompts..."
                />
              ) : (
                <div className="mt-1 p-3 bg-gray-50 rounded border font-mono text-sm">
                  {template.user_prompt_addition || "No additional prompt instructions"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Email Settings — shown only for email template types */}
        {(isEmailType || (template && ['email_campaign', 'email_flow'].includes(template.type))) && (
          <Card className="border border-black" style={{ backgroundColor: '#f0ebe7' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="preheaderText">Preheader Text</Label>
                {editMode ? (
                  <Input
                    id="preheaderText"
                    value={preheaderText}
                    onChange={(e) => setPreheaderText(e.target.value)}
                    placeholder="Short preview text shown in email clients…"
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{template.preheader_text || "—"}</p>
                )}
              </div>

              <div>
                <Label>Email Style</Label>
                {editMode ? (
                  <Select value={selectedEmailStyleId} onValueChange={setSelectedEmailStyleId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select an email style…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {emailStylesList.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="mt-1 text-gray-900 text-sm">
                    {(template.email_header as any)?.logoUrl
                      ? `Logo: ${(template.email_header as any).logoUrl}`
                      : "No email style applied"}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">Applies branding (logo, footer) from the selected style when saving.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Sections */}
        <Card className="border border-black lg:col-span-2" style={{ backgroundColor: '#f0ebe7' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Detailed Sections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="sections">Section Information</Label>
              {editMode ? (
                <Textarea
                  id="sections"
                  value={formData.sections}
                  onChange={(e) => setFormData({ ...formData, sections: e.target.value })}
                  rows={8}
                  className="mt-1 font-mono text-sm"
                  placeholder="Enter detailed section information in JSON format..."
                />
              ) : (
                <div className="mt-1">
                  {template.sections ? (
                    <div className="p-3 bg-gray-50 rounded border">
                      <pre className="font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                        {typeof template.sections === 'string' 
                          ? template.sections 
                          : JSON.stringify(template.sections, null, 2)
                        }
                      </pre>
                    </div>
                  ) : (
                    <p className="text-gray-500">No detailed sections defined</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Template Structure */}
        <Card className="border border-black lg:col-span-2" style={{ backgroundColor: '#f0ebe7' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Template Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Tabs value={structureViewMode} onValueChange={(value: string) => setStructureViewMode(value as 'visual' | 'json')}>
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="visual">Visual Editor</TabsTrigger>
                    <TabsTrigger value="json">JSON View</TabsTrigger>
                  </TabsList>
                  <div className="flex gap-2">
                    {structureViewMode === 'json' && (
                      <Button size="sm" variant="outline" onClick={syncFromJson}>
                        Switch to Visual
                      </Button>
                    )}
                    {structureViewMode === 'visual' && (
                      <Button size="sm" variant="outline" onClick={syncToJson}>
                        Switch to JSON
                      </Button>
                    )}
                  </div>
                </div>

                <TabsContent value="visual" className="space-y-4">
                  {/* Add Section Buttons */}
                  <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded border">
                    <span className="text-sm font-medium text-gray-600 mr-2">Add Section:</span>
                    <Button size="sm" variant="outline" onClick={() => addSection('heading')}>
                      <Type className="h-3 w-3 mr-1" />
                      Heading
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addSection('paragraph')}>
                      <AlignLeft className="h-3 w-3 mr-1" />
                      Paragraph
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addSection('list')}>
                      <List className="h-3 w-3 mr-1" />
                      List
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addSection('image')}>
                      <Image className="h-3 w-3 mr-1" />
                      Image
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addSection('cta')}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Call to Action
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addSection('quote')}>
                      <Quote className="h-3 w-3 mr-1" />
                      Quote
                    </Button>
                  </div>

                  {/* Structure Blocks */}
                  <div className="space-y-3">
                    {structureBlocks.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="h-8 w-8 mx-auto mb-2" />
                        <p>No sections defined. Add your first section above.</p>
                      </div>
                    ) : (
                      structureBlocks.map((block, index) => (
                        <div key={block.id || index} className="bg-white border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                              <Badge variant="outline">{block.type}</Badge>
                              <span className="text-sm text-gray-600">Section {index + 1}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {index > 0 && (
                                <Button size="sm" variant="ghost" onClick={() => moveSection(index, index - 1)}>
                                  ↑
                                </Button>
                              )}
                              {index < structureBlocks.length - 1 && (
                                <Button size="sm" variant="ghost" onClick={() => moveSection(index, index + 1)}>
                                  ↓
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => removeSection(index)} className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Title</Label>
                              <Input
                                value={block.title || ''}
                                onChange={(e) => updateSection(index, { title: e.target.value })}
                                placeholder="Section title"
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Description</Label>
                              <Input
                                value={block.description || ''}
                                onChange={(e) => updateSection(index, { description: e.target.value })}
                                placeholder="Section description"
                                className="text-sm"
                              />
                            </div>
                            
                            {/* Type-specific fields */}
                            {block.type === 'image' && (
                              <>
                                <div>
                                  <Label className="text-xs">Alt Text</Label>
                                  <Input
                                    value={block.alt || ''}
                                    onChange={(e) => updateSection(index, { alt: e.target.value })}
                                    placeholder="Image alt text"
                                    className="text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Caption</Label>
                                  <Input
                                    value={block.caption || ''}
                                    onChange={(e) => updateSection(index, { caption: e.target.value })}
                                    placeholder="Image caption"
                                    className="text-sm"
                                  />
                                </div>
                              </>
                            )}
                            
                            {block.type === 'cta' && (
                              <>
                                <div>
                                  <Label className="text-xs">Button Text</Label>
                                  <Input
                                    value={block.buttonText || ''}
                                    onChange={(e) => updateSection(index, { buttonText: e.target.value })}
                                    placeholder="Button text"
                                    className="text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">URL</Label>
                                  <Input
                                    value={block.url || ''}
                                    onChange={(e) => updateSection(index, { url: e.target.value })}
                                    placeholder="Button URL"
                                    className="text-sm"
                                  />
                                </div>
                              </>
                            )}
                            
                            {block.type === 'quote' && (
                              <div>
                                <Label className="text-xs">Author</Label>
                                <Input
                                  value={block.author || ''}
                                  onChange={(e) => updateSection(index, { author: e.target.value })}
                                  placeholder="Quote author"
                                  className="text-sm"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="json">
                  <div>
                    <Label htmlFor="structure">JSON Structure</Label>
                    <Textarea
                      id="structure"
                      value={formData.structure}
                      onChange={(e) => setFormData({ ...formData, structure: e.target.value })}
                      rows={12}
                      className="mt-1 font-mono text-sm"
                      placeholder="Enter JSON structure for content blocks..."
                    />
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div>
                <Label htmlFor="structure">Template Structure</Label>
                {template.structure && Array.isArray(template.structure) && template.structure.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {template.structure.map((block: any, index: number) => (
                      <div key={index} className="bg-white border rounded p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{block.type}</Badge>
                          <span className="text-sm font-medium">{block.title}</span>
                        </div>
                        <p className="text-sm text-gray-600">{block.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 p-4 bg-gray-50 rounded border font-mono text-sm overflow-auto max-h-96">
                    <pre>{template.structure ? JSON.stringify(template.structure, null, 2) : "No structure defined"}</pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar for Image Management */}
      <div className="lg:col-span-1">
        {editMode && getImageSections().length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Image className="h-4 w-4" />
                Template Images ({getImageSections().length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {getImageSections().map((imageSection, index) => {
                const imageKey = imageSection.imageKey || `image_${imageSection.id}`;
                const selectedImage = templateImages[imageKey];
                
                return (
                  <div key={imageSection.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        #{imageSection.order}
                      </Badge>
                      <span className="text-sm font-medium">
                        {imageSection.title || `Image ${imageSection.order}`}
                      </span>
                    </div>
                    
                    <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                      {selectedImage ? (
                        <img
                          src={selectedImage}
                          alt={imageSection.alt || `Template image ${imageSection.order}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <Image className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                          <p className="text-xs text-gray-500">No image selected</p>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleImageSelection(imageKey)}
                    >
                      {selectedImage ? 'Change Image' : 'Select Image'}
                    </Button>
                    
                    {imageSection.description && (
                      <p className="text-xs text-gray-600 mt-2">
                        {imageSection.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* CloudinaryAssetSelector */}
      <CloudinaryAssetSelector
        isOpen={isAssetSelectorOpen}
        onClose={() => setIsAssetSelectorOpen(false)}
        onSelect={handleAssetSelect}
        title="Select Template Image"
      />
    </div>
  );
}