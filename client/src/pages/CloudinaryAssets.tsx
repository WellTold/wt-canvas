import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Grid3X3, List, Search, Download, Zap, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CloudinaryImagePreview } from "@/components/CloudinaryImagePreview";
import { useLocation, useSearch } from "wouter";

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

interface CloudinaryFolder {
  name: string;
  path: string;
}

export default function CloudinaryAssets() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const { toast } = useToast();
  const [location] = useLocation();
  const search = useSearch();

  // Handle folder parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(search);
    const folderParam = urlParams.get('folder');
    if (folderParam) {
      setSelectedFolder(folderParam);
      setIsSearchMode(false);
      setSearchQuery("");
    }
  }, [search]);

  // Fetch folders
  const { data: folders = [] } = useQuery<CloudinaryFolder[]>({
    queryKey: ["/api/cloudinary/folders"],
    queryFn: async () => {
      const response = await fetch("/api/cloudinary/folders", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch Cloudinary folders");
      return response.json();
    },
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
      if (!response.ok) throw new Error("Failed to fetch Cloudinary assets");
      return response.json();
    },
    enabled: !isSearchMode || searchQuery.trim() !== "",
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setIsSearchMode(true);
      setSelectedFolder(null);
    } else {
      setIsSearchMode(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
  };

  const copyImageUrl = (url: string, label: string = "Image URL") => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const [optimizationData, setOptimizationData] = useState<{[key: string]: any}>({});
  const [selectedAsset, setSelectedAsset] = useState<CloudinaryAsset | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const getOptimizedUrls = async (publicId: string) => {
    try {
      const response = await fetch("/api/cloudinary/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ publicId }),
      });
      
      if (!response.ok) throw new Error("Failed to get optimized URLs");
      const data = await response.json();
      setOptimizationData(prev => ({ ...prev, [publicId]: data }));
      return data;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate optimized URLs",
        variant: "destructive",
      });
    }
  };

  const openPreview = (asset: CloudinaryAsset) => {
    setSelectedAsset(asset);
    setShowPreview(true);
  };

  const closePreview = () => {
    setSelectedAsset(null);
    setShowPreview(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="wt-page-header">
        <h1 className="wt-page-title">
          {selectedFolder ? `Cloudinary: ${selectedFolder.split('/').pop()}` : 'Cloudinary Assets'}
        </h1>
        <p className="text-muted-foreground">
          {selectedFolder 
            ? `Browse assets in the "${selectedFolder}" folder`
            : "Browse and use assets from your Cloudinary library"
          }
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
            data-testid="button-grid-view"
          >
            <Grid3X3 className="h-4 w-4" />
            Grid
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            data-testid="button-list-view"
          >
            <List className="h-4 w-4" />
            List
          </Button>
        </div>

        {/* Search */}
        <div className="flex gap-2 flex-1 md:max-w-md">
          <Input
            placeholder="Search assets by name or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            data-testid="input-search-assets"
          />
          <Button onClick={handleSearch} size="sm" data-testid="button-search">
            <Search className="h-4 w-4" />
          </Button>
          {isSearchMode && (
            <Button onClick={handleClearSearch} variant="outline" size="sm" data-testid="button-clear-search">
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Current folder indicator */}
      {selectedFolder && (
        <div className="bg-[#f0ebe7] border border-black rounded p-3">
          <p className="text-sm">
            <span className="font-medium">Viewing folder:</span> {selectedFolder}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFolder(null)}
              className="ml-2"
              data-testid="button-clear-folder"
            >
              View All Assets
            </Button>
          </p>
        </div>
      )}

      {/* Assets Grid */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {isLoading ? (
            Array(12).fill(null).map((_, i) => (
              <div key={i} className="bg-[#f0ebe7] aspect-square rounded animate-pulse" />
            ))
          ) : (
            assets.map((asset) => (
              <div
                key={asset.public_id}
                className="bg-[#f0ebe7] border border-black rounded hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow group"
                data-testid={`card-asset-${asset.public_id}`}
              >
                <div 
                  className="aspect-square overflow-hidden rounded-t cursor-pointer"
                  onClick={() => openPreview(asset)}
                >
                  {asset.resource_type === 'image' ? (
                    <img
                      src={asset.secure_url}
                      alt={asset.display_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <span className="text-xs text-gray-500 uppercase">
                        {asset.resource_type}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-2 space-y-2">
                  <div>
                    <p className="text-xs font-medium truncate">{asset.display_name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(asset.bytes)}</p>
                    {asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {asset.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-xs bg-gray-200 px-1 rounded">
                            {tag}
                          </span>
                        ))}
                        {asset.tags.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{asset.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyImageUrl(asset.secure_url);
                      }}
                      className="text-xs px-2 py-1 h-6"
                      data-testid={`button-copy-grid-${asset.public_id}`}
                    >
                      <Download className="h-2 w-2 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(asset);
                      }}
                      className="text-xs px-2 py-1 h-6"
                      data-testid={`button-preview-grid-${asset.public_id}`}
                    >
                      <Eye className="h-2 w-2 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Assets List */
        <div className="bg-white border border-black rounded">
          <table className="w-full">
            <thead className="bg-[#f0ebe7]">
              <tr>
                <th className="text-left p-3 border-b border-black">Preview</th>
                <th className="text-left p-3 border-b border-black">Name</th>
                <th className="text-left p-3 border-b border-black">Size</th>
                <th className="text-left p-3 border-b border-black">Format</th>
                <th className="text-left p-3 border-b border-black">Tags</th>
                <th className="text-left p-3 border-b border-black">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(8).fill(null).map((_, i) => (
                  <tr key={i}>
                    <td className="p-3 border-b"><div className="w-12 h-12 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="p-3 border-b"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="p-3 border-b"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="p-3 border-b"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="p-3 border-b"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="p-3 border-b"><div className="h-8 bg-gray-200 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : (
                assets.map((asset) => (
                  <tr key={asset.public_id} className="hover:bg-gray-50" data-testid={`row-asset-${asset.public_id}`}>
                    <td className="p-3 border-b">
                      {asset.resource_type === 'image' ? (
                        <img
                          src={asset.secure_url}
                          alt={asset.display_name}
                          className="w-12 h-12 object-cover rounded border"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded border flex items-center justify-center">
                          <span className="text-xs text-gray-500 uppercase">
                            {asset.resource_type}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 border-b text-sm">{asset.display_name}</td>
                    <td className="p-3 border-b text-sm">{formatFileSize(asset.bytes)}</td>
                    <td className="p-3 border-b text-sm uppercase">{asset.format}</td>
                    <td className="p-3 border-b text-sm">
                      {asset.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {asset.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-xs bg-gray-200 px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                          {asset.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{asset.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No tags</span>
                      )}
                    </td>
                    <td className="p-3 border-b">
                      <div className="flex gap-1">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyImageUrl(asset.secure_url)}
                          data-testid={`button-copy-${asset.public_id}`}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Copy URL
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPreview(asset)}
                          data-testid={`button-preview-${asset.public_id}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && assets.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-2">
            {isSearchMode 
              ? `No assets found for "${searchQuery}"`
              : selectedFolder 
                ? `No assets found in "${selectedFolder}"`
                : "No assets found"
            }
          </p>
          {isSearchMode && (
            <Button onClick={handleClearSearch} variant="outline" size="sm">
              Clear search
            </Button>
          )}
        </div>
      )}

      {/* Preview Modal */}
      <CloudinaryImagePreview
        asset={selectedAsset}
        isOpen={showPreview}
        onClose={closePreview}
      />
    </div>
  );
}