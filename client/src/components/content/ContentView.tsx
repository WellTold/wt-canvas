import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Edit, 
  Eye, 
  Mail,
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock,
  FileText,
  Magnet,
  Rocket,
  FileCode
} from "lucide-react";
import type { ContentItem, ContentBlock } from "@shared/schema";
import { EmailPreviewModal } from "./EmailPreviewModal";

function blockSummaryLabel(block: any): string {
  const c = block.content || {};
  switch (block.type) {
    case "shopify_product_card":
      return c.productTitle ? `Product: ${c.productTitle}` : c.productId ? `Product: ${c.productId}` : "Shopify product";
    case "shopify_product_grid":
      return c.collectionTitle ? `Collection grid: ${c.collectionTitle}` : c.collectionId ? `Collection grid: ${c.collectionId}` : "Shopify product grid";
    case "shopify_collection_feature":
      return c.collectionTitle ? `Collection: ${c.collectionTitle}` : c.collectionId ? `Collection: ${c.collectionId}` : "Shopify collection";
    case "shopify_variant_selector":
      return c.productTitle ? `Variants: ${c.productTitle}` : c.productId ? `Variants: ${c.productId}` : "Shopify variants";
    case "shopify_page":
      return c.title ? `Page: ${c.title}` : c.pageId ? `Page: ${c.pageId}` : "Shopify page";
    case "shopify_image":
      return c.alt ? `Image: ${c.alt}` : "Shopify image";
    default:
      if (typeof block.type === "string" && block.type.startsWith("shopify_")) {
        const label = block.type.replace(/^shopify_/, "").replace(/_/g, " ");
        const id = c.productId || c.collectionId || c.pageId || c.resourceId || null;
        return id ? `Shopify ${label}: ${id}` : `Shopify ${label}`;
      }
      return block.type;
  }
}

const typeConfig: Record<string, { name: string; icon: typeof FileText; listPath: string; editorPath: string }> = {
  blog: { name: "Blog Article", icon: FileText, listPath: "/pages", editorPath: "/pages/builder" },
  blog_article: { name: "Blog Article", icon: FileText, listPath: "/pages", editorPath: "/pages/builder" },
  landing_page: { name: "Landing Page", icon: Rocket, listPath: "/pages", editorPath: "/pages/builder" },
  landing: { name: "Landing Page", icon: Rocket, listPath: "/pages", editorPath: "/pages/builder" },
  lead_magnet: { name: "Lead Magnet", icon: Magnet, listPath: "/pages", editorPath: "/pages/builder" },
  email_campaign: { name: "Email Campaign", icon: FileText, listPath: "/emails", editorPath: "/email-builder" },
  email_flow: { name: "Email Flow", icon: FileText, listPath: "/emails", editorPath: "/email-builder" },
};

export default function ContentView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();


  const [showPublishedPreview, setShowPublishedPreview] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showMarkdownDialog, setShowMarkdownDialog] = useState(false);
  const [generatedMarkdown, setGeneratedMarkdown] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");

  interface ExtendedContentItem extends ContentItem {
    description?: string;
  }

  // Fetch content item details
  const { data: item, isLoading, error } = useQuery<ExtendedContentItem>({
    queryKey: ["/api/content-items", id],
    queryFn: async () => {
      console.log('📥 ContentView: Fetching content item with ID:', id);
      const response = await apiRequest("GET", `/api/content-items/${id}`);
      console.log('📥 ContentView: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ContentView: Failed to fetch content item:', response.status, errorText);
        throw new Error(`Failed to fetch content item: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📥 ContentView: Loaded content item:', data);
      return data;
    },
    enabled: !!id,
    retry: false
  });

  // Use content blocks from the main item (for Supabase content) or fetch separately (for local content)
  const { data: separateContentBlocks = [] } = useQuery<ContentBlock[]>({
    queryKey: ["/api/content-items", id, "blocks"],
    queryFn: async () => {
      if (!id || !item) return [];
      // Skip fetching blocks if content is already included in the main item (Supabase content)
      if (item.content && Array.isArray(item.content) && item.content.length > 0) {
        return [];
      }
      // Only fetch separate blocks for local storage content
      const response = await apiRequest("GET", `/api/content-items/${id}/blocks`);
      if (!response.ok) throw new Error("Failed to fetch content blocks");
      return response.json();
    },
    enabled: !!id && !!item
  });

  // Use content from main item if available (Supabase), otherwise use separate blocks (local storage)
  const contentBlocks = (item?.content && Array.isArray(item.content) && item.content.length > 0) 
    ? item.content 
    : separateContentBlocks;

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (data: { status?: string; approvalStatus?: string; scheduledPublishDate?: string }) => {
      // Convert camelCase to snake_case for database fields
      const dbData: any = {};
      if (data.status) dbData.status = data.status;
      if (data.approvalStatus) dbData.approvalStatus = data.approvalStatus;
      if (data.scheduledPublishDate) dbData.scheduledPublishDate = data.scheduledPublishDate;

      const response = await apiRequest("PATCH", `/api/content-items/${id}`, dbData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-items", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-items"] });
      toast({
        title: "Updated",
        description: "Status has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Couldn't update the status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateMarkdownMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/pages/${id}/generate-markdown`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to generate markdown");
      }
      return response.json() as Promise<{ markdown: string; saved: boolean }>;
    },
    onSuccess: (data) => {
      setGeneratedMarkdown(data.markdown);
      setShowMarkdownDialog(true);
      toast({
        title: "Markdown generated",
        description: "Saved to Supabase and ready for Cloudflare publish.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (status: string) => {
    updateStatusMutation.mutate({ status });
  };

  const handleApprovalChange = (approvalStatus: string) => {
    updateStatusMutation.mutate({ approvalStatus });
  };

  const handleSchedule = () => {
    if (scheduledDate) {
      updateStatusMutation.mutate({ 
        status: "scheduled",
        scheduledPublishDate: scheduledDate 
      });
      setScheduledDate("");
    }
  };

  const getItemConfig = (it: ContentItem) => {
    const subtype = it.contentType || it.type;
    return typeConfig[subtype] || typeConfig["blog_article"];
  };

  const isEmailContent = (it: ContentItem) => {
    const subtype = it.contentType || it.type;
    return subtype === "email_campaign" || subtype === "email_flow";
  };

  const handleEdit = () => {
    if (item) {
      const config = getItemConfig(item);
      setLocation(`${config.editorPath}/${id}`);
    }
  };

  const handleBack = () => {
    if (item) {
      const config = getItemConfig(item);
      setLocation(config.listPath);
    }
  };

  const formatDate = (dateString: string | null | Date) => {
    if (!dateString) return "Not set";
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <div className="wt-page">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">Failed to load content: {(error as Error).message}</p>
          <Button onClick={handleBack}>Back to Content</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !item) {
    return (
      <div className="wt-page">
        <div className="text-center py-12">
          <p className="text-gray-500">Loading content...</p>
        </div>
      </div>
    );
  }

  const config = getItemConfig(item);
  const IconComponent = config.icon;

  return (
    <div className="wt-page">
      {/* Header - Vertically Stacked */}
      <div className="wt-page-header">
        {/* Back Button Row */}
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {config.name}s
          </Button>
        </div>

        {/* Title Row */}
        <div className="mb-3">
          <h1 className="wt-page-title">{item.title}</h1>
        </div>

        {/* Content Type Badge Row */}
        <div className="mb-4">
          <Badge variant="outline">{config.name}</Badge>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-2">
          {/* Preview Email — email content types only */}
          {isEmailContent(item) && (
            <Button variant="outline" onClick={() => setShowEmailPreview(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Preview Email
            </Button>
          )}

          {/* Preview as Published — iframe showing server-rendered HTML (web pages only) */}
          {!isEmailContent(item) && (
            <Dialog open={showPublishedPreview} onOpenChange={setShowPublishedPreview}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview as Published
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-4 py-3 border-b shrink-0">
                  <DialogTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Published preview — {item.title}
                    {item.slug && (
                      <span className="ml-auto text-xs font-normal text-muted-foreground">
                        welltolddesign.com/a/articles/{item.slug}
                      </span>
                    )}
                  </DialogTitle>
                </DialogHeader>
                <iframe
                  src={`/api/content-items/${id}/preview-html`}
                  className="flex-1 w-full border-0"
                  title="Published page preview"
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Generate Markdown — web pages only */}
          {!isEmailContent(item) && (
            <Button
              variant="outline"
              onClick={() => generateMarkdownMutation.mutate()}
              disabled={generateMarkdownMutation.isPending}
            >
              <FileCode className="h-4 w-4 mr-2" />
              {generateMarkdownMutation.isPending ? "Generating..." : "Generate Markdown"}
            </Button>
          )}

          <Button onClick={handleEdit} className="bg-black hover:bg-gray-800 text-white">
            <Edit className="h-4 w-4 mr-2" />
            Edit Content
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Content Information */}
        <Card className="lg:col-span-2 border border-black" style={{ backgroundColor: '#f0ebe7' }}>
          <CardHeader>
            <CardTitle>Content Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <p className="mt-1 font-medium">{item.title}</p>
            </div>

            {item.metaDescription && (
              <div>
                <Label>Meta Description</Label>
                <p className="mt-1 text-gray-700">{item.metaDescription}</p>
              </div>
            )}

            {item.primaryKeyword && (
              <div>
                <Label>Primary Keyword</Label>
                <p className="mt-1 text-gray-700">{item.primaryKeyword}</p>
              </div>
            )}

            {item.supportingKeywords && (
              <div>
                <Label>Supporting Keywords</Label>
                <p className="mt-1 text-gray-700">{item.supportingKeywords}</p>
              </div>
            )}

            <div>
              <Label>Content Summary</Label>
              {contentBlocks.length > 0 ? (
                <div className="mt-1 space-y-2">
                  <p className="text-gray-700">{contentBlocks.length} content block{contentBlocks.length !== 1 ? "s" : ""}</p>
                  <div className="flex flex-wrap gap-1">
                    {contentBlocks.map((block, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border">
                        {blockSummaryLabel(block)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-gray-500 italic">No content blocks yet. Use the editor to add content.</p>
              )}
            </div>

            {item.slug && (
              <div>
                <Label>URL Slug</Label>
                <p className="mt-1 text-gray-700 font-mono">{item.slug}</p>
              </div>
            )}

            {item.tags && item.tags.length > 0 && (
              <div>
                <Label>Tags</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.tags.map((tag, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 border border-blue-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Created</Label>
                <p className="mt-1 text-sm text-gray-600">{formatDate(item.createdAt)}</p>
              </div>
              <div>
                <Label>Last Updated</Label>
                <p className="mt-1 text-sm text-gray-600">{formatDate(item.updatedAt)}</p>
              </div>
            </div>

            {item.publishedAt && (
              <div>
                <Label>Published</Label>
                <p className="mt-1 text-sm text-gray-600">{formatDate(item.publishedAt)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Controls */}
        <Card className="border border-black" style={{ backgroundColor: '#f0ebe7' }}>
          <CardHeader>
            <CardTitle>Status & Approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Workflow Status */}
            <div>
              <Label htmlFor="status">Workflow Status</Label>
              <Select 
                value={item.status} 
                onValueChange={handleStatusChange}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
              <div className={`mt-2 flex items-center gap-2 text-sm`}>
                <div className={`w-2 h-2 rounded-full ${
                  item.status === 'live' ? 'bg-green-500' :
                  item.status === 'approved' || item.status === 'scheduled' ? 'bg-blue-500' :
                  item.status === 'review' ? 'bg-yellow-500' : 'bg-gray-400'
                }`} />
                Current: {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </div>
            </div>

            {/* Approval Status */}
            <div>
              <Label htmlFor="approval">Approval Status</Label>
              <Select 
                value={item.approvalStatus} 
                onValueChange={handleApprovalChange}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 flex items-center gap-2 text-sm">
                {item.approvalStatus === 'approved' && <CheckCircle className="h-4 w-4 text-green-500" />}
                {item.approvalStatus === 'rejected' && <XCircle className="h-4 w-4 text-red-500" />}
                {item.approvalStatus === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                {item.approvalStatus.charAt(0).toUpperCase() + item.approvalStatus.slice(1)}
              </div>
            </div>

            {/* Scheduling */}
            <div>
              <Label htmlFor="schedule">Schedule Publication</Label>
              <div className="mt-1 space-y-2">
                <Input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  disabled={updateStatusMutation.isPending}
                />
                <Button 
                  size="sm" 
                  onClick={handleSchedule}
                  disabled={!scheduledDate || updateStatusMutation.isPending}
                  className="w-full"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
                {item.scheduledPublishDate && (
                  <p className="text-sm text-gray-600">
                    Scheduled for: {formatDate(item.scheduledPublishDate)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email preview modal — email content types only */}
      <EmailPreviewModal
        open={showEmailPreview}
        onClose={() => setShowEmailPreview(false)}
        contentId={id!}
        contentTitle={item.title}
      />

      {/* Markdown preview dialog */}
      <Dialog open={showMarkdownDialog} onOpenChange={setShowMarkdownDialog}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm font-medium flex items-center gap-2">
              <FileCode className="h-4 w-4" />
              Generated Markdown — {item.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            <Textarea
              value={generatedMarkdown}
              readOnly
              className="font-mono text-xs h-full min-h-[400px] resize-none"
            />
          </div>
          <div className="px-4 py-3 border-t shrink-0 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(generatedMarkdown);
                toast({ title: "Copied", description: "Markdown copied to clipboard." });
              }}
            >
              Copy
            </Button>
            <Button size="sm" onClick={() => setShowMarkdownDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}