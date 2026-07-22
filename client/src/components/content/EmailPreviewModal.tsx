import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, ExternalLink, Monitor, Smartphone, Send, Upload, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

export interface EmailPreviewModalProps {
  open: boolean;
  onClose: () => void;
  contentId: number | string;
  contentTitle: string;
  subject: string;
  preheaderText: string;
}

interface KlaviyoAudience {
  id: string;
  name: string;
  kind: "list" | "segment";
}

export function EmailPreviewModal({ open, onClose, contentId, contentTitle, subject, preheaderText }: EmailPreviewModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [emailPreviewDevice, setEmailPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Send test state — one-click Klaviyo push, no email input needed
  const [sendTestLoading, setSendTestLoading] = useState(false);

  // Save as Template state (internal Canvas)
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateLoading, setSaveTemplateLoading] = useState(false);

  // Push to Campaign state
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [audiences, setAudiences] = useState<KlaviyoAudience[]>([]);
  const [audiencesLoading, setAudiencesLoading] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignFromName, setCampaignFromName] = useState("Well Told");
  const [campaignFromEmail, setCampaignFromEmail] = useState("help@welltolddesign.com");
  const [campaignAudienceId, setCampaignAudienceId] = useState("");
  const [campaignLoading, setCampaignLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmailPreviewHtml(null);
      setPreviewUrl(null);
      setSendTestLoading(false);
      setShowSaveTemplateForm(false);
      setSaveTemplateName("");
      setShowCampaignForm(false);
      return;
    }
    let cancelled = false;
    setEmailPreviewLoading(true);
    setEmailPreviewHtml(null);
    setPreviewUrl(null);
    apiRequest("GET", `/api/content/${contentId}/email-preview`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) throw new Error(`Preview failed: ${response.status}`);
        const html = await response.text();
        if (cancelled) return;
        setEmailPreviewHtml(html);
        const storeRes = await apiRequest("POST", "/api/email-preview-temp", { html });
        if (cancelled) return;
        const { id } = await storeRes.json();
        setPreviewUrl(`/api/email-preview-temp/${id}`);
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: "Preview Error",
          description: err.message || "Could not load email preview.",
          variant: "destructive",
        });
        onClose();
      })
      .finally(() => { if (!cancelled) setEmailPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [open, contentId]);

  useEffect(() => {
    if (contentTitle) setCampaignName(contentTitle);
  }, [contentTitle]);

  const handleOpenInNewTab = () => {
    if (!emailPreviewHtml) return;
    const blob = new Blob([emailPreviewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // Send Test: push rendered HTML to Klaviyo as a template.
  // Shows a toast with a link to open Klaviyo's templates page —
  // the user sends the actual test preview from inside Klaviyo.
  const handleSendTest = async () => {
    if (!emailPreviewHtml) return;
    setSendTestLoading(true);
    try {
      const res = await apiRequest("POST", `/api/content/${contentId}/push-to-klaviyo`);
      const data = await res.json();
      if (!res.ok) {
        if (data.message === "klaviyo_required") {
          toast({
            title: "Klaviyo not connected",
            description: "Connect Klaviyo in Integrations to send previews.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Preview push failed", description: data.message, variant: "destructive" });
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/content-items", contentId] });
      toast({
        title: "Pushed to Klaviyo ✓",
        description: (
          <span>
            Template updated. Go to Klaviyo → Content → Templates, open it, then use
            {" "}"Preview &amp; test" to send to your inbox.
          </span>
        ),
        duration: 8000,
      });
    } catch (err: any) {
      toast({ title: "Preview push failed", description: err.message, variant: "destructive" });
    } finally {
      setSendTestLoading(false);
    }
  };

  // Save as Template: saves rendered HTML as an internal Canvas template (not pushed to Klaviyo).
  const handleSaveAsTemplate = async () => {
    const name = saveTemplateName.trim() || contentTitle || "Untitled Email Template";
    setSaveTemplateLoading(true);
    try {
      const res = await apiRequest("POST", `/api/content/${contentId}/save-as-canvas-template`, { name });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Save failed", description: data.message, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/templates", "email"] });
      toast({
        title: "Template saved",
        description: (
          <span>
            "{data.name}" saved to Email Templates.{" "}
            <a href="/email-templates" className="underline font-medium">View →</a>
          </span>
        ),
      });
      setShowSaveTemplateForm(false);
      setSaveTemplateName("");
    } catch (err: unknown) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaveTemplateLoading(false);
    }
  };

  const handleOpenCampaignForm = async () => {
    const next = !showCampaignForm;
    setShowCampaignForm(next);
    setShowSaveTemplateForm(false);
    if (next && audiences.length === 0) {
      setAudiencesLoading(true);
      try {
        const res = await apiRequest("GET", "/api/klaviyo/audiences");
        if (res.ok) {
          const data: KlaviyoAudience[] = await res.json();
          setAudiences(data);
        } else {
          const data = await res.json();
          if (data.message === "klaviyo_required") {
            toast({ title: "Klaviyo not connected", description: "Connect Klaviyo in Integrations to push campaigns.", variant: "destructive" });
          } else {
            toast({ title: "Could not load audiences", description: data.message, variant: "destructive" });
          }
          setShowCampaignForm(false);
        }
      } catch (err: unknown) {
        toast({ title: "Could not load audiences", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        setShowCampaignForm(false);
      } finally {
        setAudiencesLoading(false);
      }
    }
  };

  const handlePushToCampaign = async () => {
    if (!subject.trim()) {
      toast({ title: "Subject line required", description: "Add a subject line in the editor before pushing.", variant: "destructive" });
      return;
    }
    if (!preheaderText.trim()) {
      toast({ title: "Preheader required", description: "Add preheader text in the editor before pushing.", variant: "destructive" });
      return;
    }
    if (!campaignAudienceId) {
      toast({ title: "Select an audience", variant: "destructive" });
      return;
    }
    const audience = audiences.find(a => a.id === campaignAudienceId);
    if (!audience) {
      toast({ title: "Invalid audience selection", variant: "destructive" });
      return;
    }
    setCampaignLoading(true);
    try {
      const res = await apiRequest("POST", `/api/content/${contentId}/push-to-klaviyo-campaign`, {
        campaignName: campaignName.trim() || contentTitle || "Untitled Email",
        subject: subject.trim(),
        previewText: preheaderText.trim(),
        fromName: campaignFromName.trim(),
        fromEmail: campaignFromEmail.trim(),
        audienceId: audience.id,
        audienceType: audience.kind,
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.message === "klaviyo_required") {
          toast({ title: "Klaviyo not connected", description: "Connect Klaviyo in Integrations to push campaigns.", variant: "destructive" });
        } else {
          toast({ title: "Campaign push failed", description: data.message, variant: "destructive" });
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/content-items", contentId] });
      toast({
        title: "Campaign created",
        description: (
          <span>
            {data.previousCampaignId && (
              <span className="block text-xs text-muted-foreground mb-0.5">Previous campaign: #{data.previousCampaignId}</span>
            )}
            Saved as draft in Klaviyo → Campaigns.
          </span>
        ),
      });
      setShowCampaignForm(false);
      setCampaignAudienceId("");
    } catch (err: unknown) {
      toast({ title: "Campaign push failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setCampaignLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[720px] w-full p-0 overflow-hidden" style={{ maxHeight: "92vh" }}>
        {/* Header row */}
        <DialogHeader className="px-4 py-2.5 border-b flex-row items-center justify-between gap-3 shrink-0">
          <DialogTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />Email Preview
            {contentTitle && <span className="font-normal text-muted-foreground">— {contentTitle}</span>}
          </DialogTitle>

          {/* Device toggle */}
          <div className="flex items-center border rounded overflow-hidden">
            <button
              onClick={() => setEmailPreviewDevice("desktop")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors ${emailPreviewDevice === "desktop" ? "bg-black text-white" : "text-muted-foreground hover:bg-gray-100"}`}
              title="Desktop view"
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setEmailPreviewDevice("mobile")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors ${emailPreviewDevice === "mobile" ? "bg-black text-white" : "text-muted-foreground hover:bg-gray-100"}`}
              title="Mobile view"
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Right-side actions */}
          <div className="flex items-center gap-3 ml-auto">
            {emailPreviewHtml && (
              <button
                onClick={handleSendTest}
                disabled={sendTestLoading}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title="Push to Klaviyo — then send test from inside Klaviyo (Content → Templates)"
              >
                <Send className="h-3 w-3" />{sendTestLoading ? "Pushing…" : "Send test"}
              </button>
            )}
            {emailPreviewHtml && (
              <button
                onClick={() => {
                  setShowSaveTemplateForm(v => !v);
                  setShowCampaignForm(false);
                  setSaveTemplateName(contentTitle || "");
                }}
                className={`flex items-center gap-1 text-xs transition-colors ${showSaveTemplateForm ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                title="Save as reusable Canvas template (not pushed to Klaviyo)"
              >
                <Upload className="h-3 w-3" />Save as Template
              </button>
            )}
            {emailPreviewHtml && (
              <button
                onClick={handleOpenCampaignForm}
                className={`flex items-center gap-1 text-xs transition-colors ${showCampaignForm ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                title="Create a new Klaviyo draft campaign"
              >
                <Megaphone className="h-3 w-3" />Push to Campaign
              </button>
            )}
            {emailPreviewHtml && (
              <button
                onClick={handleOpenInNewTab}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />Open in tab
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Save as Template inline form */}
        {showSaveTemplateForm && (
          <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center gap-2 shrink-0">
            <Input
              type="text"
              placeholder={contentTitle || "Template name…"}
              value={saveTemplateName}
              onChange={e => setSaveTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSaveAsTemplate(); }}
              className="h-8 text-sm flex-1"
              autoFocus
            />
            <Button
              size="sm"
              className="h-8 bg-black hover:bg-gray-800 text-white text-xs px-3"
              onClick={handleSaveAsTemplate}
              disabled={saveTemplateLoading}
            >
              {saveTemplateLoading ? "Saving…" : "Save"}
            </Button>
            <button
              onClick={() => { setShowSaveTemplateForm(false); setSaveTemplateName(""); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Push to Campaign inline form */}
        {showCampaignForm && (
          <div className="px-4 py-3 border-b bg-gray-50 shrink-0 space-y-3">
            <p className="text-xs font-medium text-foreground">Create Draft Campaign in Klaviyo</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Campaign name</Label>
                <Input
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Campaign name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Subject line <span className="text-red-500">*</span></Label>
                <p className="text-sm px-2 py-1.5 bg-white border rounded min-h-[32px]">{subject || <span className="text-red-500">Not set — add one in the editor.</span>}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Preheader <span className="text-red-500">*</span></Label>
                <p className="text-sm px-2 py-1.5 bg-white border rounded min-h-[32px]">{preheaderText || <span className="text-red-500">Not set — add one in the editor.</span>}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From name</Label>
                <Input
                  value={campaignFromName}
                  onChange={e => setCampaignFromName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From email</Label>
                <Input
                  value={campaignFromEmail}
                  onChange={e => setCampaignFromEmail(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Audience <span className="text-red-500">*</span></Label>
              {audiencesLoading ? (
                <p className="text-xs text-muted-foreground py-1">Loading audiences…</p>
              ) : (
                <Select value={campaignAudienceId} onValueChange={setCampaignAudienceId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a list or segment…" />
                  </SelectTrigger>
                  <SelectContent>
                    {audiences.filter(a => a.kind === "list").length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Lists</div>
                        {audiences.filter(a => a.kind === "list").map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {audiences.filter(a => a.kind === "segment").length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Segments</div>
                        {audiences.filter(a => a.kind === "segment").map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {audiences.length === 0 && (
                      <div className="px-2 py-2 text-xs text-muted-foreground">No lists or segments found in Klaviyo.</div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 bg-black hover:bg-gray-800 text-white text-xs px-3"
                onClick={handlePushToCampaign}
                disabled={campaignLoading}
              >
                {campaignLoading ? "Creating…" : "Create Draft Campaign"}
              </Button>
              <button
                onClick={() => setShowCampaignForm(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Preview area */}
        <div className="bg-gray-100 overflow-auto" style={{ height: "75vh" }}>
          {emailPreviewLoading && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Loading preview…
            </div>
          )}
          {previewUrl && (
            <div
              className="mx-auto shadow-sm transition-all duration-200"
              style={{ width: emailPreviewDevice === "mobile" ? "375px" : "600px", minHeight: "100%" }}
            >
              <iframe
                key={emailPreviewDevice}
                src={previewUrl}
                title="Email Preview"
                style={{ width: "100%", height: "75vh", border: "none", display: "block" }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
