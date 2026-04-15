import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ExternalLink, Monitor, Smartphone, Send, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

export interface EmailPreviewModalProps {
  open: boolean;
  onClose: () => void;
  contentId: number | string;
  contentTitle: string;
}

export function EmailPreviewModal({ open, onClose, contentId, contentTitle }: EmailPreviewModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [emailPreviewDevice, setEmailPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [showSendTest, setShowSendTest] = useState(false);
  const [sendTestEmail, setSendTestEmail] = useState("");
  const [sendTestLoading, setSendTestLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmailPreviewHtml(null);
      setPreviewUrl(null);
      setShowSendTest(false);
      setSendTestEmail("");
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
        // Store HTML server-side and get a URL that the iframe can load directly
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

  const handleOpenInNewTab = () => {
    if (!emailPreviewHtml) return;
    const blob = new Blob([emailPreviewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleSendTest = async () => {
    if (!sendTestEmail || !sendTestEmail.includes("@")) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    setSendTestLoading(true);
    try {
      const res = await apiRequest("POST", `/api/content/${contentId}/send-test-email`, { email: sendTestEmail });
      const data = await res.json();
      if (!res.ok) {
        if (data.message === "klaviyo_required") {
          toast({
            title: "Klaviyo not connected",
            description: "Connect Klaviyo in Integrations to enable test sends.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Send failed", description: data.message, variant: "destructive" });
        }
        return;
      }
      toast({ title: "Test email sent", description: `Delivered to ${sendTestEmail}` });
      setShowSendTest(false);
      setSendTestEmail("");
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSendTestLoading(false);
    }
  };

  const handlePushToKlaviyo = async () => {
    setPushLoading(true);
    try {
      const res = await apiRequest("POST", `/api/content/${contentId}/push-to-klaviyo`);
      const data = await res.json();
      if (!res.ok) {
        if (data.message === "klaviyo_required") {
          toast({
            title: "Klaviyo not connected",
            description: "Connect Klaviyo in Integrations to push templates.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Push failed", description: data.message, variant: "destructive" });
        }
        return;
      }
      // Invalidate content item cache so klaviyoTemplateId is reflected if user views metadata
      queryClient.invalidateQueries({ queryKey: ["/api/content-items", contentId] });
      const klaviyoLink = (
        <span>
          Template ID: {data.templateId}.{" "}
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">
            View in Klaviyo →
          </a>
        </span>
      );
      toast({ title: "Pushed to Klaviyo", description: klaviyoLink });
    } catch (err: unknown) {
      toast({ title: "Push failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setPushLoading(false);
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
                onClick={() => setShowSendTest(v => !v)}
                className={`flex items-center gap-1 text-xs transition-colors ${showSendTest ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Send className="h-3 w-3" />Send test
              </button>
            )}
            {emailPreviewHtml && (
              <button
                onClick={handlePushToKlaviyo}
                disabled={pushLoading}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title="Create or update Klaviyo template"
              >
                <Upload className="h-3 w-3" />{pushLoading ? "Pushing…" : "Push to Klaviyo"}
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

        {/* Send test inline form */}
        {showSendTest && (
          <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center gap-2 shrink-0">
            <Input
              type="email"
              placeholder="your@email.com"
              value={sendTestEmail}
              onChange={e => setSendTestEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSendTest(); }}
              className="h-8 text-sm flex-1"
              autoFocus
            />
            <Button
              size="sm"
              className="h-8 bg-black hover:bg-gray-800 text-white text-xs px-3"
              onClick={handleSendTest}
              disabled={sendTestLoading}
            >
              {sendTestLoading ? "Sending…" : "Send"}
            </Button>
            <button
              onClick={() => { setShowSendTest(false); setSendTestEmail(""); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
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
              className="mx-auto bg-white shadow-sm transition-all duration-200"
              style={{ width: emailPreviewDevice === "mobile" ? "375px" : "600px", minHeight: "100%" }}
            >
              <iframe
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
