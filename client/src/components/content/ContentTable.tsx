import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, ExternalLink, Rocket, RotateCcw, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useState } from "react";
import type { ContentItem } from "@shared/schema";

interface ContentTableProps {
  type: string;
  onEdit?: (id: number | string) => void;
}

const statusColors = {
  idea: "secondary",
  draft: "default",
  review: "default", 
  approved: "default",
  scheduled: "default",
  live: "default",
} as const;

const approvalColors = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
} as const;

export function ContentTable({ type, onEdit }: ContentTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<Set<number | string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");

  const { data: items = [], isLoading, error } = useQuery<ContentItem[]>({
    queryKey: [`/api/content-items?type=${type}`],
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number | string) => {
      const response = await apiRequest("POST", `/api/content-items/${id}/publish`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-items"] });
      toast({
        title: "Success",
        description: "Content published successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to publish content",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number | string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/content-items/${id}`, { status });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-items"] });
      toast({
        title: "Success",
        description: "Status updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Status update error:", error);
      toast({
        title: "Error",
        description: `Failed to update status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: (number | string)[]; status: string }) => {
      const promises = ids.map(id => 
        apiRequest("PATCH", `/api/content-items/${id}`, { status })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-items"] });
      setSelectedItems(new Set());
      setBulkStatus("");
      toast({
        title: "Success",
        description: "Bulk status update completed",
      });
    },
    onError: (error: Error) => {
      console.error("Bulk status update error:", error);
      toast({
        title: "Error",
        description: `Failed to update statuses: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      const response = await apiRequest("DELETE", `/api/content-items/${id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-items"] });
      toast({
        title: "Success",
        description: "Content deleted successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: `Failed to delete content: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handlePublish = (id: number) => {
    publishMutation.mutate(id);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(items.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: number | string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const handleStatusChange = (id: number | string, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleBulkStatusUpdate = () => {
    if (selectedItems.size > 0 && bulkStatus) {
      bulkUpdateStatusMutation.mutate({ 
        ids: Array.from(selectedItems), 
        status: bulkStatus 
      });
    }
  };

  const formatDate = (dateString: string | null | Date) => {
    if (!dateString) return "—";
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    return date.toLocaleDateString();
  };

  const getRelativeTime = (dateString: string | Date | null) => {
    if (!dateString) return "—";
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return "1 day ago";
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm text-blue-800">
            {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-3">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Update status to..." />
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
            <Button 
              onClick={handleBulkStatusUpdate}
              disabled={!bulkStatus || bulkUpdateStatusMutation.isPending}
              size="sm"
            >
              Update Status
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setSelectedItems(new Set())}
              size="sm"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      <div className="wt-table-container">
        <table className="wt-table">
          <thead>
            <tr>
              <th className="w-12 px-4">
                <Checkbox
                  checked={selectedItems.size === items.length && items.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </th>
              <th>Title</th>
              <th>Status</th>
              <th>Approval</th>
              <th>Scheduled</th>
              <th>Published</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
        <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  No content items found. Create your first {type.replace('_', ' ')} article!
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4">
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                    />
                  </td>
                  <td>
                    <Link
                      href={`/content/${item.id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => console.log('🔗 Navigating to content view with ID:', item.id)}
                    >
                      <strong>{item.title}</strong>
                    </Link>
                  </td>
                  <td>
                    <Select 
                      value={item.status} 
                      onValueChange={(status) => handleStatusChange(item.id, status)}
                      disabled={updateStatusMutation.isPending}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
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
                  </td>
                  <td>
                    <div className={`wt-status-badge wt-status-${item.approvalStatus === 'approved' ? 'approved' : 'idea'}`}>
                      {item.approvalStatus
                        ? item.approvalStatus.charAt(0).toUpperCase() + item.approvalStatus.slice(1)
                        : 'Pending'}
                    </div>
                  </td>
                  <td>{formatDate(item.scheduledPublishDate)}</td>
                  <td>{formatDate(item.publishedAt)}</td>
                  <td>{getRelativeTime(item.updatedAt)}</td>
                <td>
                  <div className="flex gap-2">
                    {onEdit ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log('✏️ Edit button clicked for item:', item.id, item);
                          onEdit(item.id);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Link href={`/content-editor/${item.id}`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {item.slug && !item.type?.includes('email') && !(item as any).contentType?.includes('email') && (
                      <a
                        href={`https://welltold.design/pages/${item.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm" title="View live page">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                    {item.status === 'approved' && !item.publishedAt ? (
                      <Button
                        size="sm"
                        onClick={() => handlePublish(item.id)}
                        disabled={publishMutation.isPending}
                        className="bg-black hover:bg-gray-800 text-white"
                      >
                        <Rocket className="h-4 w-4" />
                      </Button>
                    ) : item.publishedAt ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePublish(item.id)}
                        disabled={publishMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        <Rocket className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Content</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{item.title}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}