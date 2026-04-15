import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ContentTable } from "@/components/content/ContentTable";
import { ContentEditor } from "@/components/content/ContentEditor";
import { Plus } from "lucide-react";

export default function BlogArticles() {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | string | undefined>();

  // Check for edit mode from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editParam = urlParams.get('edit');
    if (editParam) {
      // Handle both integer IDs (local storage) and string UUIDs (Supabase)
      const parsedId = /^\d+$/.test(editParam) ? parseInt(editParam) : editParam;
      setEditingId(parsedId);
      setIsEditing(true);
    }
  }, []);

  const handleNew = () => {
    setEditingId(undefined);
    setIsEditing(true);
  };

  const handleEdit = (id: number | string) => {
    setEditingId(id);
    setIsEditing(true);
  };

  const handleClose = () => {
    setIsEditing(false);
    setEditingId(undefined);
    // Clear URL params
    window.history.replaceState({}, '', '/blog-articles');
  };

  if (isEditing) {
    return (
      <ContentEditor
        contentItemId={editingId}
        type="blog"
        onClose={handleClose}
      />
    );
  }

  return (
    <div>
      <div className="wt-page-header">
        {/* Title Row */}
        <div className="mb-4">
          <h1 className="wt-page-title">Blog Articles</h1>
        </div>
        
        {/* Action Button Row */}
        <div>
          <Button onClick={handleNew} className="bg-black hover:bg-gray-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Article
          </Button>
        </div>
      </div>
      
      <ContentTable type="blog" onEdit={handleEdit} />
    </div>
  );
}
