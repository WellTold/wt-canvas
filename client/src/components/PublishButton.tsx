import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Upload, 
  Globe, 
  ExternalLink, 
  CheckCircle,
  Clock,
  ChevronDown
} from "lucide-react";

interface PublishButtonProps {
  contentId: number;
  contentType: string;
  status: string;
  onStatusChange?: (newStatus: string) => void;
}

export default function PublishButton({ 
  contentId, 
  contentType, 
  status, 
  onStatusChange 
}: PublishButtonProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const publishToSupabase = useMutation({
    mutationFn: async (destination: string) => {
      return apiRequest(`/api/publish/supabase`, 'POST', { 
        contentId,
        destination 
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Published Successfully",
        description: `Content published to your website. ${data.url ? `Visit: ${data.url}` : ''}`,
      });
      onStatusChange?.('live');
      queryClient.invalidateQueries({ queryKey: ['/api/content-items'] });
    },
    onError: (error) => {
      toast({
        title: "Publishing Failed",
        description: error.message || "Failed to publish content to Supabase",
        variant: "destructive"
      });
    }
  });

  const handlePublish = async (destination: 'supabase' | 'framer') => {
    setIsPublishing(true);
    try {
      if (destination === 'supabase') {
        await publishToSupabase.mutateAsync('supabase');
      } else {
        // Handle Framer publishing here when needed
        toast({
          title: "Framer Publishing",
          description: "Framer CMS integration coming soon",
          variant: "default"
        });
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'idea':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Idea</Badge>;
      case 'draft':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700">Draft</Badge>;
      case 'review':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Review</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Approved</Badge>;
      case 'scheduled':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-700">
          <Clock className="w-3 h-3 mr-1" />
          Scheduled
        </Badge>;
      case 'live':
        return <Badge variant="secondary" className="bg-green-100 text-green-700">
          <CheckCircle className="w-3 h-3 mr-1" />
          Live
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canPublish = ['approved', 'scheduled'].includes(status);

  if (status === 'live') {
    return (
      <div className="flex items-center gap-2">
        {getStatusBadge()}
        <Button variant="outline" size="sm" className="text-green-600 border-green-200">
          <Globe className="w-4 h-4 mr-2" />
          Published
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {getStatusBadge()}
      
      {canPublish && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="sm" 
              disabled={isPublishing}
              className="bg-black hover:bg-gray-800 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isPublishing ? 'Publishing...' : 'Publish'}
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem 
              onClick={() => handlePublish('supabase')}
              disabled={isPublishing}
            >
              <Globe className="w-4 h-4 mr-2" />
              Publish to Website
              <span className="text-xs text-muted-foreground ml-auto">Supabase</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handlePublish('framer')}
              disabled={isPublishing}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Publish to Framer
              <span className="text-xs text-muted-foreground ml-auto">CMS</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      
      {!canPublish && status !== 'live' && (
        <Button variant="outline" size="sm" disabled>
          <Upload className="w-4 h-4 mr-2" />
          Needs Approval
        </Button>
      )}
    </div>
  );
}