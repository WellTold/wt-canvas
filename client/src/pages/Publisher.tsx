import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ContentPreview } from "@/components/content/ContentPreview";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Filter, Calendar, FileText, CheckCircle, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface PublishedContent {
  id: string;
  title: string;
  slug: string;
  type: 'webpage' | 'email';
  contentType?: 'blog_article' | 'landing_page' | 'lead_magnet';
  status: 'draft' | 'published' | 'archived';
  approval_status: 'pending' | 'approved' | 'rejected';
  publish_date: string;
  author_name: string;
  author_avatar_url: string;
  tags: string[];
  meta_description: string;
  image_url: string;
  cta_text: string;
  cta_link: string;
  editor_notes: string;
  content_json: any[];
  created_at: string;
  updated_at: string;
}

export default function Publisher() {
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    search: ''
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Fetch published content from Supabase
  const { data: publishedContent = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/published-content', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value);
        }
      });

      const response = await apiRequest("GET", `/api/published-content?${params}`);
      return response.json();
    },
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error.message.includes("Authentication required")) {
        return false;
      }
      return failureCount < 1;
    }
  });

  // Debug log to see what data we're getting
  console.log('Publisher data:', { publishedContent, isLoading, error });

  // Handle item selection
  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === publishedContent.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(publishedContent.map((item: PublishedContent) => item.id)));
    }
  };

  // Get selected content for export
  const getSelectedContent = () => {
    if (selectedItems.size === 0) return [];
    return publishedContent.filter((item: PublishedContent) => selectedItems.has(item.id));
  };

  // Helper function to properly escape CSV fields
  const escapeCsvField = (field: any): string => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCSV = () => {
    const contentToExport = getSelectedContent();
    if (!contentToExport.length) return;

    const headers = [
      'ID', 'Title', 'Slug', 'Type', 'Status', 'Approval Status',
      'Publish Date', 'Author', 'Author Avatar', 'Tags', 'Meta Description',
      'Image URL', 'CTA Text', 'CTA Link', 'Editor Notes', 'Content JSON',
      'Created At', 'Updated At'
    ];

    const csvContent = [
      headers.join(','),
      ...contentToExport.map((item: PublishedContent) => [
        escapeCsvField(item.id),
        escapeCsvField(item.title),
        escapeCsvField(item.slug),
        escapeCsvField(item.type),
        escapeCsvField(item.status),
        escapeCsvField(item.approval_status),
        escapeCsvField(item.publish_date || ''),
        escapeCsvField(item.author_name || ''),
        escapeCsvField(item.author_avatar_url || ''),
        escapeCsvField(item.tags.join(';')),
        escapeCsvField(item.meta_description || ''),
        escapeCsvField(item.image_url || ''),
        escapeCsvField(item.cta_text || ''),
        escapeCsvField(item.cta_link || ''),
        escapeCsvField(item.editor_notes || ''),
        escapeCsvField(JSON.stringify(item.content_json || [])),
        escapeCsvField(item.created_at),
        escapeCsvField(item.updated_at)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wt-canvas-export-${contentToExport.length}-items-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFramer = () => {
    const contentToExport = getSelectedContent();
    if (!contentToExport.length) return;

    // Framer CMS expects all 16 fields in specific order
    const headers = [
      'Title', 'Slug', 'Meta description', 'Image', 'Publication Date',
      'Post Type', 'Tags', 'CTA Text', 'CTA Link', 'Author Name',
      'Author Avatar', 'Status', 'Approval Status', 'Last Updated',
      'Editor Notes', 'Content'
    ];

    const csvContent = [
      headers.join(','),
      ...contentToExport.map((item: PublishedContent) => [
        escapeCsvField(item.title),
        escapeCsvField(item.slug),
        escapeCsvField(item.meta_description || ''),
        escapeCsvField(item.image_url || ''),
        escapeCsvField(item.publish_date || ''),
        escapeCsvField((item.contentType || item.type).replace(/_/g, ' ')),
        escapeCsvField(item.tags.join(';')),
        escapeCsvField(item.cta_text || ''),
        escapeCsvField(item.cta_link || ''),
        escapeCsvField(item.author_name || ''),
        escapeCsvField(item.author_avatar_url || ''),
        escapeCsvField(item.status),
        escapeCsvField(item.approval_status),
        escapeCsvField(item.updated_at ? format(new Date(item.updated_at), 'yyyy-MM-dd HH:mm:ss') : ''),
        escapeCsvField(item.editor_notes || ''),
        escapeCsvField(JSON.stringify(item.content_json || []))
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `framer-import-${contentToExport.length}-items-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTypeLabel = (item: PublishedContent) => {
    const subtype = item.contentType || item.type;
    switch (subtype) {
      case 'blog_article': return 'Blog Article';
      case 'landing_page': return 'Landing Page';
      case 'lead_magnet': return 'Lead Magnet';
      case 'webpage': return 'Web Page';
      case 'email': return 'Email';
      default: return subtype;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getApprovalColor = (approval: string) => {
    switch (approval) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const renderContentSection = (block: any, index: number) => {
    if (!block || typeof block !== 'object') return null;

    switch (block.type) {
      case 'heading':
        return (
          <div key={index} className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Heading {block.level || 2}</div>
            <h3 className="font-semibold text-gray-900">{block.text}</h3>
          </div>
        );
      case 'paragraph':
        return (
          <div key={index} className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Paragraph</div>
            <p className="text-sm text-gray-700 line-clamp-3">{block.text}</p>
          </div>
        );
      case 'list':
        return (
          <div key={index} className="mb-3">
            <div className="text-xs text-gray-500 mb-1">List ({block.items?.length || 0} items)</div>
            <ul className="text-sm text-gray-700 list-disc pl-4">
              {block.items?.slice(0, 3).map((item: string, i: number) => (
                <li key={i}>{item}</li>
              ))}
              {block.items?.length > 3 && (
                <li className="text-gray-500">...and {block.items.length - 3} more</li>
              )}
            </ul>
          </div>
        );
      case 'image':
        return (
          <div key={index} className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Image</div>
            <div className="text-sm text-gray-700">
              {block.alt || 'Image'} {block.caption && `- ${block.caption}`}
            </div>
          </div>
        );
      case 'cta':
        return (
          <div key={index} className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Call to Action</div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">{block.text}</span>
              {block.url && <span className="text-blue-600 ml-2">→ {block.url}</span>}
            </div>
          </div>
        );
      case 'quote':
        return (
          <div key={index} className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Quote</div>
            <blockquote className="text-sm text-gray-700 italic border-l-2 border-gray-300 pl-3">
              "{block.text}"
              {block.author && <footer className="text-gray-500 mt-1">— {block.author}</footer>}
            </blockquote>
          </div>
        );
      default:
        return (
          <div key={index} className="mb-3">
            <div className="text-xs text-gray-500 mb-1">{block.type || 'Unknown'}</div>
            <div className="text-sm text-gray-600">
              {typeof block === 'string' ? block : JSON.stringify(block).substring(0, 100)}...
            </div>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Display error message if there's an error and it's not an authentication error that requires refetching
  if (error && !(error as any).message.includes("Authentication required")) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Error loading content: {error.message}</p>
        <Button onClick={() => refetch()} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  // If there's an authentication error, prompt the user to log in
  if (error && (error as any).message.includes("Authentication required")) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-600 mb-4">
          Your session has expired. Please log in again to continue.
        </p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700 text-white">
          Log In Again
        </Button>
      </div>
    );
  }


  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="wt-page-header">
        {/* Title Row */}
        <div className="mb-3">
          <h1 className="wt-page-title">Publisher</h1>
        </div>

        {/* Description Row */}
        <div className="mb-4">
          <p className="wt-page-description">
            Manage and export published content from your Supabase database
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="mb-6" style={{ backgroundColor: '#f0ebe7' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <Input
                placeholder="Search titles..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Content Type</label>
              <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="blog_article">Blog Articles</SelectItem>
                  <SelectItem value="landing_page">Landing Pages</SelectItem>
                  <SelectItem value="lead_magnet">Lead Magnets</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">From Date</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">To Date</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection and Export Actions */}
      <Card className="mb-6" style={{ backgroundColor: '#f0ebe7' }}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedItems.size === publishedContent.length && publishedContent.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <span className="text-sm">
                  Select All ({selectedItems.size} of {publishedContent.length} selected)
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleExportCSV}
                variant="outline"
                disabled={selectedItems.size === 0}
                className="flex items-center gap-2"
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4" />
                Export Selected CSV ({selectedItems.size})
              </Button>
              <Button
                onClick={handleExportFramer}
                disabled={selectedItems.size === 0}
                className="flex items-center gap-2"
                data-testid="button-export-framer"
              >
                <Download className="h-4 w-4" />
                Export Selected for Framer ({selectedItems.size})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Table */}
      <Card>
        <CardContent className="p-0">
          {publishedContent.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedItems.size === publishedContent.length && publishedContent.length > 0}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-table-select-all"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publishedContent.map((item: PublishedContent) => (
                  <>
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => handleSelectItem(item.id)}
                          data-testid={`checkbox-item-${item.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-gray-500">/{item.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getTypeLabel(item)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getApprovalColor(item.approval_status)}>
                          {item.approval_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.publish_date ? format(new Date(item.publish_date), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell>{item.author_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(item.tags || []).slice(0, 2).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {(item.tags || []).length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(item.tags || []).length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex items-center gap-1"
                              data-testid={`button-preview-${item.id}`}
                            >
                              <Eye className="h-3 w-3" />
                              Preview
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{item.title}</DialogTitle>
                            </DialogHeader>
                            <ContentPreview
                              title={item.title}
                              metaDescription={item.meta_description}
                              featuredImage={item.image_url}
                              content={Array.isArray(item.content_json) ? item.content_json : []}
                            />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  </>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No published content found</h3>
              <p className="text-gray-500">Try adjusting your filters or publish some content first.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}