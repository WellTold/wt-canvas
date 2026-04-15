import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Grid3X3, List, FolderPlus, Upload } from "lucide-react";
import { FolderIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Folder, MediaAsset } from "@shared/schema";

interface MediaLibraryProps {
  type: "brand_logos" | "lifestyle_images";
}

export function MediaLibrary({ type }: MediaLibraryProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch folders
  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ["/api/folders", { type }],
    queryFn: async () => {
      const response = await fetch(`/api/folders?type=${type}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch folders");
      return response.json();
    },
  });

  // Fetch media assets
  const { data: assets = [] } = useQuery<MediaAsset[]>({
    queryKey: ["/api/media-assets", { folder: selectedFolder }],
    queryFn: async () => {
      const url = selectedFolder 
        ? `/api/media-assets?folder=${selectedFolder}`
        : "/api/media-assets";
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch media assets");
      return response.json();
    },
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/folders", {
        name,
        type,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setNewFolderName("");
      setIsNewFolderDialogOpen(false);
      toast({
        title: "Success",
        description: "Folder created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive",
      });
    },
  });

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim());
    }
  };

  const getFolderColor = (folderName: string) => {
    const colors = [
      "var(--color-accent-blue)",
      "var(--color-accent-green)", 
      "var(--color-accent-yellow)",
      "var(--color-accent-purple)",
    ];
    const index = folderName.length % colors.length;
    return colors[index];
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="h-4 w-4" />
            Grid
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
            List
          </Button>
        </div>

        <div className="flex gap-2">
          <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="folderName">Folder Name</Label>
                  <Input
                    id="folderName"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsNewFolderDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || createFolderMutation.isPending}
                    className="bg-black hover:bg-gray-800 text-white"
                  >
                    Create Folder
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button className="bg-black hover:bg-gray-800 text-white">
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      {selectedFolder && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => setSelectedFolder(null)}
            className="hover:text-foreground transition-colors"
          >
            All Files
          </button>
          <span>/</span>
          <span>{selectedFolder}</span>
        </div>
      )}

      {/* Media Grid */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* Folders */}
          {!selectedFolder && folders.map((folder) => (
            <div
              key={folder.id}
              className="wt-card cursor-pointer p-4 text-center"
              onClick={() => setSelectedFolder(folder.name)}
            >
              <FolderIcon 
                className="h-12 w-12 mx-auto mb-2" 
                style={{ color: getFolderColor(folder.name) }}
              />
              <h4 className="font-semibold text-sm">{folder.name}</h4>
              <p className="text-xs text-muted-foreground">
                {assets.filter(asset => asset.folder === folder.name).length} files
              </p>
            </div>
          ))}

          {/* Assets */}
          {assets
            .filter(asset => !selectedFolder || asset.folder === selectedFolder)
            .map((asset) => (
              <div
                key={asset.id}
                className="wt-card p-2 cursor-pointer"
              >
                {asset.mimeType.startsWith('image/') ? (
                  <img
                    src={asset.url}
                    alt={asset.originalName}
                    className="w-full aspect-square object-cover rounded-lg mb-2"
                  />
                ) : (
                  <div className="w-full aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mb-2">
                    <span className="text-2xl">📄</span>
                  </div>
                )}
                <p className="text-xs font-medium truncate">{asset.originalName}</p>
              </div>
            ))}

          {/* Upload placeholder */}
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 transition-colors">
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Upload</span>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="wt-table-container">
          <table className="wt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Folder</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    No media files found. Upload your first file!
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="font-medium">{asset.originalName}</td>
                    <td>{asset.mimeType}</td>
                    <td>{Math.round(asset.size / 1024)} KB</td>
                    <td>{asset.folder || "—"}</td>
                    <td>{new Date(asset.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
