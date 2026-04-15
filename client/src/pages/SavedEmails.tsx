import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ContentTable } from "@/components/content/ContentTable";
import { Plus } from "lucide-react";

export default function SavedEmails() {
  const [, setLocation] = useLocation();

  const handleNew = () => {
    setLocation("/email-templates");
  };

  const handleEdit = (id: number | string) => {
    setLocation(`/email-builder/${id}`);
  };

  return (
    <div>
      <div className="wt-page-header">
        <div className="mb-4">
          <h1 className="wt-page-title">Saved Emails</h1>
          <p className="text-gray-500 text-sm mt-1">
            Email campaigns built block by block, with AI-generated content.
          </p>
        </div>
        <div>
          <Button onClick={handleNew} className="bg-black hover:bg-gray-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Email
          </Button>
        </div>
      </div>

      <ContentTable type="email_campaign" onEdit={handleEdit} />
    </div>
  );
}
