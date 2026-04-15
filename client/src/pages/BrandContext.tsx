import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, X, Save } from "lucide-react";
import { BrandContext } from "@shared/schema";
import { format } from "date-fns";

export default function BrandContextPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<BrandContext>>({
    voiceDocument: "",
    alwaysRules: [],
    avoidRules: [],
    wordsWeUse: [],
    wordsWeAvoid: [],
  });

  const { data: context, isLoading } = useQuery<BrandContext>({
    queryKey: ["/api/settings/brand-context"],
  });

  useEffect(() => {
    if (context) {
      setFormData({
        voiceDocument: context.voiceDocument || "",
        alwaysRules: context.alwaysRules || [],
        avoidRules: context.avoidRules || [],
        wordsWeUse: context.wordsWeUse || [],
        wordsWeAvoid: context.wordsWeAvoid || [],
      });
    }
  }, [context]);

  const mutation = useMutation({
    mutationFn: async (updatedContext: Partial<BrandContext>) => {
      const res = await apiRequest("PUT", "/api/settings/brand-context", updatedContext);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/brand-context"] });
      toast({
        title: "Settings saved",
        description: "Brand context has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    mutation.mutate(formData);
  };

  const addListItem = (field: keyof BrandContext) => {
    const current = (formData[field] as string[]) || [];
    setFormData({ ...formData, [field]: [...current, ""] });
  };

  const removeListItem = (field: keyof BrandContext, index: number) => {
    const current = (formData[field] as string[]) || [];
    const updated = current.filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: updated });
  };

  const updateListItem = (field: keyof BrandContext, index: number, value: string) => {
    const current = (formData[field] as string[]) || [];
    const updated = [...current];
    updated[index] = value;
    setFormData({ ...formData, [field]: updated });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="wt-page-title">Brand Context</h1>
          {context?.updatedAt && (
            <p className="text-sm text-muted-foreground">
              Last updated: {format(new Date(context.updatedAt), "PPP p")}
            </p>
          )}
        </div>
        <Button 
          onClick={handleSave} 
          disabled={mutation.isPending}
          className="bg-black text-white hover:bg-black/90 rounded-none border-2 border-black"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save changes
        </Button>
      </div>

      <Card className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-[#f0ebe7]">
        <CardHeader className="border-b-2 border-black">
          <CardTitle className="text-xl font-bold uppercase tracking-tight">Section 1 — Brand Voice Document</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="voiceDocument" className="font-bold">Brand Voice Document</Label>
            <Textarea
              id="voiceDocument"
              value={formData.voiceDocument || ""}
              onChange={(e) => setFormData({ ...formData, voiceDocument: e.target.value })}
              className="min-h-[400px] rounded-none border-2 border-black font-mono text-sm"
              placeholder="Enter brand voice guidelines..."
            />
            <p className="text-xs text-muted-foreground">
              This is injected into every AI generation call. Keep it current.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-[#f0ebe7]">
          <CardHeader className="border-b-2 border-black">
            <CardTitle className="text-xl font-bold uppercase tracking-tight text-green-700">Always Rule List</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {formData.alwaysRules?.map((rule, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={rule}
                  onChange={(e) => updateListItem("alwaysRules", index, e.target.value)}
                  className="rounded-none border-2 border-black"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeListItem("alwaysRules", index)}
                  className="rounded-none border-2 border-black hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addListItem("alwaysRules")}
              className="w-full rounded-none border-2 border-black hover:bg-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add rule
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-[#f0ebe7]">
          <CardHeader className="border-b-2 border-black">
            <CardTitle className="text-xl font-bold uppercase tracking-tight text-red-700">Avoid Rule List</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {formData.avoidRules?.map((rule, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={rule}
                  onChange={(e) => updateListItem("avoidRules", index, e.target.value)}
                  className="rounded-none border-2 border-black"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeListItem("avoidRules", index)}
                  className="rounded-none border-2 border-black hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addListItem("avoidRules")}
              className="w-full rounded-none border-2 border-black hover:bg-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add rule
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-[#f0ebe7]">
          <CardHeader className="border-b-2 border-black">
            <CardTitle className="text-xl font-bold uppercase tracking-tight">Words we use</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {formData.wordsWeUse?.map((word, index) => (
                <div key={index} className="flex items-center bg-white border-2 border-black px-2 py-1 gap-2">
                  <span className="text-sm font-medium">{word}</span>
                  <button onClick={() => removeListItem("wordsWeUse", index)}>
                    <X className="h-3 w-3 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="newWordUse"
                placeholder="New word..."
                className="rounded-none border-2 border-black"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    if (input.value) {
                      setFormData({
                        ...formData,
                        wordsWeUse: [...(formData.wordsWeUse || []), input.value]
                      });
                      input.value = '';
                    }
                  }
                }}
              />
              <Button
                size="icon"
                onClick={() => {
                  const input = document.getElementById('newWordUse') as HTMLInputElement;
                  if (input.value) {
                    setFormData({
                      ...formData,
                      wordsWeUse: [...(formData.wordsWeUse || []), input.value]
                    });
                    input.value = '';
                  }
                }}
                className="rounded-none border-2 border-black bg-white text-black hover:bg-gray-100"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-[#f0ebe7]">
          <CardHeader className="border-b-2 border-black">
            <CardTitle className="text-xl font-bold uppercase tracking-tight">Words we avoid</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {formData.wordsWeAvoid?.map((word, index) => (
                <div key={index} className="flex items-center bg-white border-2 border-black px-2 py-1 gap-2">
                  <span className="text-sm font-medium">{word}</span>
                  <button onClick={() => removeListItem("wordsWeAvoid", index)}>
                    <X className="h-3 w-3 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="newWordAvoid"
                placeholder="New word..."
                className="rounded-none border-2 border-black"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    if (input.value) {
                      setFormData({
                        ...formData,
                        wordsWeAvoid: [...(formData.wordsWeAvoid || []), input.value]
                      });
                      input.value = '';
                    }
                  }
                }}
              />
              <Button
                size="icon"
                onClick={() => {
                  const input = document.getElementById('newWordAvoid') as HTMLInputElement;
                  if (input.value) {
                    setFormData({
                      ...formData,
                      wordsWeAvoid: [...(formData.wordsWeAvoid || []), input.value]
                    });
                    input.value = '';
                  }
                }}
                className="rounded-none border-2 border-black bg-white text-black hover:bg-gray-100"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
