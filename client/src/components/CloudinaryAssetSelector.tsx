import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Grid3X3, List, Image, Folder, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CloudinaryAsset {
  public_id: string;
  secure_url: string;
  display_name: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  folder?: string;
}

interface CloudinaryFolder {
  name: string;
  path: string;
}

interface CloudinaryAssetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: CloudinaryAsset) => void;
  title?: string;
  context?: 'hero' | 'thumbnail' | 'inline' | 'gallery';
}

export function CloudinaryAssetSelector({ isOpen, onClose, onSelect, title = "Select Image", context = 'inline' }: CloudinaryAssetSelectorProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const { toast } = useToast();

  // Fetch folders
  const { data: folders = [] } = useQuery<CloudinaryFolder[]>({
    queryKey: ["/api/cloudinary/folders"],
    queryFn: async () => {
      const response = await fetch("/api/cloudinary/folders", {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch assets or search results
  const { data: assets = [], isLoading } = useQuery<CloudinaryAsset[]>({
    queryKey: isSearchMode 
      ? ["/api/cloudinary/search", { query: searchQuery }]
      : ["/api/cloudinary/assets", { folder: selectedFolder }],
    queryFn: async () => {
      const url = isSearchMode 
        ? `/api/cloudinary/search?query=${encodeURIComponent(searchQuery)}`
        : selectedFolder 
          ? `/api/cloudinary/assets?folder=${encodeURIComponent(selectedFolder)}`
          : "/api/cloudinary/assets";
      
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch assets");
      return response.json();
    },
    enabled: isOpen && (!isSearchMode || searchQuery.trim() !== ""),
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setIsSearchMode(true);
      setSelectedFolder(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getOptimizedAssetUrl = (asset: CloudinaryAsset) => {
    const baseUrl = asset.secure_url;
    const publicId = asset.public_id;
    
    // Return optimized URL based on context
    switch (context) {
      case 'hero':
        return baseUrl.replace('/upload/', '/upload/w_1200,h_630,c_fill,f_auto,q_auto:best/');
      case 'thumbnail':
        return baseUrl.replace('/upload/', '/upload/w_300,h_200,c_fill,f_auto,q_auto:good/');
      case 'gallery':
        return baseUrl.replace('/upload/', '/upload/w_600,h_400,c_fill,f_auto,q_auto:good/');
      case 'inline':
      default:
        return baseUrl.replace('/upload/', '/upload/w_800,c_scale,f_auto,q_auto:good/');
    }
  };

  const handleAssetSelect = (asset: CloudinaryAsset) => {
    // Create optimized asset with context-appropriate URL
    const optimizedAsset = {
      ...asset,
      secure_url: getOptimizedAssetUrl(asset),
      original_url: asset.secure_url // Keep original for reference
    };
    
    onSelect(optimizedAsset);
    onClose();
    toast({
      title: "Image Selected",
      description: `Selected ${asset.display_name} (optimized for ${context})`,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Controls */}
        <div className="flex gap-4 items-center border-b pb-4">
          {/* Back and folder navigation */}
          <div className="flex items-center gap-2">
            {(selectedFolder || isSearchMode) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFolder(null);
                  setIsSearchMode(false);
                  setSearchQuery("");
                }}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                All Assets
              </Button>
            )}
            {selectedFolder && (
              <span className="text-sm text-muted-foreground">
                Folder: {selectedFolder}
              </span>
            )}
          </div>

          {/* View mode */}
          <div className="flex gap-1">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search images... (Press Enter or click Search)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSearch}>
              Search
            </Button>
            {isSearchMode && (
              <Button variant="outline" size="sm" onClick={handleClearSearch}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Folders (when not searching) */}
        {!isSearchMode && !selectedFolder && folders.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Folders</h3>
            <div className="flex flex-wrap gap-2">
              {folders.map((folder) => (
                <Button
                  key={folder.path}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFolder(folder.path)}
                  className="flex items-center gap-1"
                >
                  <Folder className="h-3 w-3" />
                  {folder.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Assets */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="text-center py-8">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isSearchMode ? "No assets found matching your search" : "No assets found"}
              {isSearchMode && (
                <p className="text-xs mt-2">Try searching for different keywords or browse folders instead</p>
              )}
            </div>
          ) : (
            <>
              {isSearchMode && (
                <div className="px-4 py-2 text-xs text-muted-foreground border-b bg-gray-50">
                  Found {assets.length} asset{assets.length !== 1 ? 's' : ''} matching "{searchQuery}"
                </div>
              )}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
                  {assets.map((asset) => (
                    <div
                      key={asset.public_id}
                      className="bg-[#f0ebe7] border border-black rounded hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow cursor-pointer group"
                      onClick={() => handleAssetSelect(asset)}
                    >
                      <div className="aspect-square overflow-hidden rounded-t">
                        {asset.format && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(asset.format.toLowerCase()) ? (
                          <img
                            src={asset.secure_url}
                            alt={asset.display_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-200">
                            <Image className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium truncate">{asset.display_name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(asset.bytes)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {assets.map((asset) => (
                    <div
                      key={asset.public_id}
                      className="flex items-center gap-3 p-3 bg-[#f0ebe7] border border-black rounded hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow cursor-pointer"
                      onClick={() => handleAssetSelect(asset)}
                    >
                      <div className="w-16 h-16 flex-shrink-0 overflow-hidden rounded">
                        {asset.format && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(asset.format.toLowerCase()) ? (
                          <img
                            src={asset.secure_url}
                            alt={asset.display_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-200">
                            <Image className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{asset.display_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {asset.width && asset.height && `${asset.width}×${asset.height} • `}
                          {formatFileSize(asset.bytes)} • {asset.format?.toUpperCase()}
                        </p>
                        {asset.folder && (
                          <p className="text-xs text-muted-foreground">📁 {asset.folder}</p>
                        )}

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t pt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}