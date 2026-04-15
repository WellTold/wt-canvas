import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Zap, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CloudinaryAsset {
  public_id: string;
  secure_url: string;
  url: string;
  display_name: string;
  format: string;
  resource_type: string;
  type: string;
  bytes: number;
  width?: number;
  height?: number;
  created_at: string;
  folder?: string;
  tags: string[];
}

interface OptimizationData {
  optimized_url: string;
  blog_variants: {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    hero: string;
  };
  responsive_urls: {
    mobile: string;
    tablet: string;
    desktop: string;
    large: string;
  };
}

interface CloudinaryImagePreviewProps {
  asset: CloudinaryAsset | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CloudinaryImagePreview({ asset, isOpen, onClose }: CloudinaryImagePreviewProps) {
  const { toast } = useToast();
  const [optimizationData, setOptimizationData] = useState<OptimizationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (asset && isOpen) {
      // Auto-load optimizations for images
      if (asset.resource_type === 'image') {
        loadOptimizations();
      }
    }
  }, [asset, isOpen]);

  const loadOptimizations = async () => {
    if (!asset) return;
    
    setIsLoading(true);
    try {
      const response = await fetch("/api/cloudinary/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ publicId: asset.public_id }),
      });
      
      if (!response.ok) throw new Error("Failed to get optimized URLs");
      const data = await response.json();
      setOptimizationData(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate optimized URLs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!asset) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-left">{asset.display_name}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Preview */}
          <div className="space-y-4">
            <div className="bg-[#f0ebe7] border border-black rounded p-4">
              {asset.resource_type === 'image' ? (
                <img
                  src={asset.secure_url}
                  alt={asset.display_name}
                  className="w-full max-h-96 object-contain rounded"
                />
              ) : (
                <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center">
                  <span className="text-gray-500 uppercase">{asset.resource_type}</span>
                </div>
              )}
            </div>
            
            {/* Basic Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => copyToClipboard(asset.secure_url, "Original URL")}
                data-testid="button-copy-original"
              >
                <Download className="h-4 w-4 mr-2" />
                Copy Original URL
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(asset.secure_url, '_blank')}
                data-testid="button-open-original"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          </div>

          {/* Asset Details & Optimizations */}
          <div className="space-y-6">
            {/* Asset Information */}
            <div className="space-y-3">
              <h3 className="font-medium">Asset Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Format:</span>
                  <Badge variant="secondary" className="ml-2">{asset.format.toUpperCase()}</Badge>
                </div>
                <div>
                  <span className="font-medium">Type:</span>
                  <Badge variant="secondary" className="ml-2">{asset.resource_type}</Badge>
                </div>
                <div>
                  <span className="font-medium">Size:</span>
                  <span className="ml-2">{formatFileSize(asset.bytes)}</span>
                </div>
                {asset.width && asset.height && (
                  <div>
                    <span className="font-medium">Dimensions:</span>
                    <span className="ml-2">{asset.width} × {asset.height}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Uploaded:</span>
                  <span className="ml-2">{formatDate(asset.created_at)}</span>
                </div>
                {asset.folder && (
                  <div>
                    <span className="font-medium">Folder:</span>
                    <span className="ml-2">{asset.folder}</span>
                  </div>
                )}
              </div>
              
              {/* Tags */}
              {asset.tags.length > 0 && (
                <div>
                  <span className="font-medium text-sm">Tags:</span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {asset.tags.map(tag => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Optimized URLs */}
            {asset.resource_type === 'image' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">Smart Optimizations</h3>
                  {isLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-black"></div>
                  )}
                </div>

                {optimizationData ? (
                  <div className="space-y-4">
                    {/* Auto-Optimized URL */}
                    <div className="bg-[#f0ebe7] p-3 border border-black rounded">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-sm">Auto-Optimized</span>
                        <Badge variant="default">Recommended</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        WebP/AVIF format, smart quality, progressive loading
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(optimizationData.optimized_url, "Optimized URL")}
                        data-testid="button-copy-optimized"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Optimized URL
                      </Button>
                    </div>

                    {/* Blog Variants */}
                    <div>
                      <h4 className="font-medium text-sm mb-2">Blog Content Sizes</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(optimizationData.blog_variants).map(([size, url]) => (
                          <div key={size} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <div>
                              <span className="font-medium text-sm capitalize">{size}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {size === 'thumbnail' && '150×150px'}
                                {size === 'small' && '400px wide'}
                                {size === 'medium' && '800px wide'}
                                {size === 'large' && '1200px wide'}
                                {size === 'hero' && '1920×800px'}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(url, `${size} URL`)}
                              data-testid={`button-copy-${size}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Responsive URLs */}
                    <div>
                      <h4 className="font-medium text-sm mb-2">Responsive Breakpoints</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(optimizationData.responsive_urls).map(([breakpoint, url]) => (
                          <div key={breakpoint} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <div>
                              <span className="font-medium text-sm capitalize">{breakpoint}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {breakpoint === 'mobile' && '480px'}
                                {breakpoint === 'tablet' && '768px'}
                                {breakpoint === 'desktop' && '1200px'}
                                {breakpoint === 'large' && '1920px'}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(url, `${breakpoint} URL`)}
                              data-testid={`button-copy-${breakpoint}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Button
                      onClick={loadOptimizations}
                      disabled={isLoading}
                      data-testid="button-load-optimizations"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Generate Optimized URLs
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}