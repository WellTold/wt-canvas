import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ContentTable } from "@/components/content/ContentTable";
import { ContentEditor } from "@/components/content/ContentEditor";
import { Plus } from "lucide-react";

export default function LandingPages() {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>();

  // Check for edit mode from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editParam = urlParams.get('edit');
    if (editParam) {
      setEditingId(parseInt(editParam));
      setIsEditing(true);
    }
  }, []);

  const handleNew = () => {
    setEditingId(undefined);
    setIsEditing(true);
  };

  const handleEdit = (id: number) => {
    setEditingId(id);
    setIsEditing(true);
  };

  const handleClose = () => {
    setIsEditing(false);
    setEditingId(undefined);
    // Clear URL params
    window.history.replaceState({}, '', '/landing-pages');
  };

  if (isEditing) {
    return (
      <ContentEditor
        contentItemId={editingId}
        type="landing_page"
        onClose={handleClose}
      />
    );
  }

  return (
    <div>
      <div className="wt-page-header">
        {/* Title Row */}
        <div className="mb-4">
          <h1 className="wt-page-title">Landing Pages</h1>
        </div>
        
        {/* Action Button Row */}
        <div>
          <Button onClick={handleNew} className="bg-black hover:bg-gray-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Landing Page
          </Button>
        </div>
      </div>
      
      <ContentTable type="landing_page" onEdit={handleEdit} />
    </div>
  );
}
