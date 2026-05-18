import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, X, Image, Upload, Loader2 } from "lucide-react";
import type { ImageTemplate, InsertImageTemplate } from "@shared/schema";

const MODELS = [
  { value: "nano_banana_2",                       label: "Nano Banana Pro" },
  { value: "gpt_image_2",                         label: "GPT Image 2" },
  { value: "cinematic_studio_2_5",                label: "Cinematic Studio 2.5" },
  { value: "flux_2",                              label: "FLUX.2" },
  { value: "flux_kontext",                        label: "Flux Kontext" },
  { value: "flux-pro/kontext/max/text-to-image",  label: "FLUX Kontext Max" },
  { value: "grok_image",                          label: "Grok Image" },
  { value: "image_auto",                          label: "Image Auto" },
  { value: "kling_omni_image",                    label: "Kling O1 Image" },
  { value: "marketing_studio_image",              label: "Marketing Studio Image" },
  { value: "ms_image",                            label: "MS Image" },
  { value: "nano_banana",                         label: "Nano Banana" },
  { value: "nano_banana_flash",                   label: "Nano Banana 2" },
  { value: "openai_hazel",                        label: "OpenAI Hazel" },
  { value: "reve/text-to-image",                  label: "Reve" },
  { value: "seedream_v4_5",                       label: "Seedream 4.5" },
  { value: "seedream_v5_lite",                    label: "Seedream V5 Lite" },
  { value: "soul_cinematic",                      label: "Soul Cinematic" },
  { value: "soul_location",                       label: "Soul Location" },
  { value: "text2image_soul_v2",                  label: "Soul V2" },
  { value: "z_image",                             label: "Z Image" },
];

function blankForm(): Partial<InsertImageTemplate> {
  return { name: "", prompt: "", model: "nano_banana_2", thumbnailUrl: "", referenceImageUrls: [] };
}

export default function ImageTemplates() {
  const { data: user } = useAuth();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<ImageTemplate | null>(null);
  const [form, setForm] = useState<Partial<InsertImageTemplate>>(blankForm());
  const [newRefUrl, setNewRefUrl] = useState("");
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const isAdminOrDev = user?.role === "admin" || user?.role === "developer";

  const { data: templates = [], isLoading } = useQuery<ImageTemplate[]>({
    queryKey: ["/api/image-templates"],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertImageTemplate) => apiRequest("POST", "/api/image-templates", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-templates"] });
      toast({ title: "Template created" });
      closeForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertImageTemplate> }) =>
      apiRequest("PATCH", `/api/image-templates/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-templates"] });
      toast({ title: "Template updated" });
      closeForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/image-templates/${id}`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setNewRefUrl("");
    setIsFormOpen(true);
  };

  const openEdit = (t: ImageTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      prompt: t.prompt,
      model: t.model,
      thumbnailUrl: t.thumbnailUrl ?? "",
      referenceImageUrls: t.referenceImageUrls ?? [],
    });
    setNewRefUrl("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditing(null);
    setForm(blankForm());
    setNewRefUrl("");
    setIsUploadingThumb(false);
  };

  const handleThumbnailUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setIsUploadingThumb(true);
      try {
        const res = await apiRequest("POST", "/api/image-templates/upload-thumbnail", { dataUrl });
        const data = await res.json();
        if (data.url) {
          setForm((f) => ({ ...f, thumbnailUrl: data.url }));
          toast({ title: "Thumbnail uploaded" });
        } else {
          throw new Error(data.message || "Upload failed");
        }
      } catch (err) {
        toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
      } finally {
        setIsUploadingThumb(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!form.name?.trim() || !form.prompt?.trim()) {
      toast({ title: "Name and prompt are required", variant: "destructive" });
      return;
    }
    const data: InsertImageTemplate = {
      name: form.name!.trim(),
      prompt: form.prompt!.trim(),
      model: form.model ?? "flux-pro/kontext/max/text-to-image",
      thumbnailUrl: form.thumbnailUrl?.trim() || undefined,
      referenceImageUrls: form.referenceImageUrls ?? [],
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addRefUrl = () => {
    const trimmed = newRefUrl.trim();
    if (!trimmed) return;
    setForm((f) => ({ ...f, referenceImageUrls: [...(f.referenceImageUrls ?? []), trimmed] }));
    setNewRefUrl("");
  };

  const removeRefUrl = (i: number) => {
    setForm((f) => ({ ...f, referenceImageUrls: (f.referenceImageUrls ?? []).filter((_, idx) => idx !== i) }));
  };

  if (!isAdminOrDev) {
    return (
      <div className="wt-page-header">
        <h1 className="wt-page-title">Image Templates</h1>
        <p className="text-muted-foreground">Access restricted to admins and developers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="wt-page-header">
        <h1 className="wt-page-title">Image Templates</h1>
        <p className="text-muted-foreground">Saved prompt templates for the Image Studio.</p>
      </div>

      <div>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-2" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(null).map((_, i) => (
            <div key={i} className="h-40 bg-[#f0ebe7] border border-black animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No image templates yet. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-[#f0ebe7] border border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow"
            >
              {t.thumbnailUrl ? (
                <div className="aspect-video overflow-hidden">
                  <img src={t.thumbnailUrl} alt={t.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center bg-gray-200">
                  <Image size={32} className="text-gray-400" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-sm">{t.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.prompt}</p>
                <p className="text-xs text-muted-foreground">
                  {MODELS.find((m) => m.value === t.model)?.label ?? t.model}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                    <Pencil size={12} className="mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm("Delete this template?")) deleteMutation.mutate(t.id);
                    }}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={12} className="mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Studio Shot - Product"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Thumbnail</Label>
              <div className="mt-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={form.thumbnailUrl ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                    placeholder="Paste URL or upload a file"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingThumb}
                    onClick={() => thumbInputRef.current?.click()}
                  >
                    {isUploadingThumb ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  </Button>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleThumbnailUpload(e.target.files)}
                  />
                </div>
                {form.thumbnailUrl && (
                  <img src={form.thumbnailUrl} alt="preview" className="h-24 object-cover border border-black" />
                )}
              </div>
            </div>

            <div>
              <Label>Prompt</Label>
              <Textarea
                value={form.prompt ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                placeholder="Describe the image..."
                rows={4}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Model</Label>
              <Select
                value={form.model ?? "flux-pro/kontext/max/text-to-image"}
                onValueChange={(v) => setForm((f) => ({ ...f, model: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reference Image URLs</Label>
              <div className="space-y-2 mt-1">
                {(form.referenceImageUrls ?? []).map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={url} readOnly className="flex-1 text-xs" />
                    <Button size="sm" variant="outline" onClick={() => removeRefUrl(i)}>
                      <X size={12} />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newRefUrl}
                    onChange={(e) => setNewRefUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && addRefUrl()}
                  />
                  <Button size="sm" variant="outline" onClick={addRefUrl}>Add</Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={closeForm}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
