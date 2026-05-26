import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Save, Plus, Trash2, Navigation, Image as ImageIcon, ExternalLink, Megaphone, Palette, Share2, Mail, ChevronDown, ChevronUp, Check, X, Code2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface NavLink { label: string; href: string }
interface FooterLink { label: string; href: string }
interface FooterColumn { heading: string; links: FooterLink[] }
interface SocialPlatform { platform: "instagram" | "facebook" | "youtube" | "pinterest" | "tiktok"; url: string }

interface SiteSettingsData {
  id?: number;
  logoUrl: string;
  logoLink: string;
  footerLogoUrl: string;
  announcementText: string;
  announcementLink: string;
  announcementBgColor: string;
  announcementTextColor: string;
  announcementEnabled: boolean;
  navLinks: NavLink[];
  primaryColor: string;
  accentColor: string;
  footerBgColor: string;
  footerColumns: FooterColumn[];
  footerAddress: string;
  footerLinks: FooterLink[];
  footerCopyright: string;
  footerAnnouncementEnabled: boolean;
  footerAnnouncementText: string;
  footerAnnouncementLink: string;
  footerAnnouncementBgColor: string;
  footerAnnouncementTextColor: string;
  socialHandle: string;
  socialLinks: SocialPlatform[];
}

const DEFAULT: SiteSettingsData = {
  logoUrl: "",
  logoLink: "https://welltolddesign.com",
  footerLogoUrl: "",
  announcementText: "<strong>FREE SHIPPING</strong> Orders Over $50",
  announcementLink: "https://welltolddesign.com",
  announcementBgColor: "#000000",
  announcementTextColor: "#ffffff",
  announcementEnabled: true,
  navLinks: [],
  primaryColor: "#000000",
  accentColor: "#04a7cd",
  footerBgColor: "#F5F5F5",
  footerColumns: [],
  footerAddress: "",
  footerLinks: [],
  footerCopyright: "© 2026 Well Told. All rights reserved.",
  footerAnnouncementEnabled: false,
  footerAnnouncementText: "",
  footerAnnouncementLink: "",
  footerAnnouncementBgColor: "#f0ebe7",
  footerAnnouncementTextColor: "#000000",
  socialHandle: "@WellToldDesign",
  socialLinks: [],
};

const SOCIAL_PLATFORMS = ["instagram", "facebook", "youtube", "pinterest", "tiktok"] as const;

function ColorField({ label, id, value, onChange }: { label: string; id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-9 w-12 border border-black cursor-pointer p-0.5 bg-white"
        />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
          className="w-32 font-mono text-sm"
        />
      </div>
    </div>
  );
}

export default function SiteSettings() {
  const { toast } = useToast();
  const [form, setForm] = useState<SiteSettingsData>(DEFAULT);

  const { data: settings, isLoading } = useQuery<SiteSettingsData>({
    queryKey: ["/api/site-settings"],
  });

  useEffect(() => {
    if (settings) {
      setForm({
        logoUrl: settings.logoUrl || "",
        logoLink: settings.logoLink || "https://welltolddesign.com",
        footerLogoUrl: settings.footerLogoUrl || "",
        announcementText: settings.announcementText || "FREE SHIPPING Orders Over $50",
        announcementLink: settings.announcementLink || "https://welltolddesign.com",
        announcementBgColor: settings.announcementBgColor || "#000000",
        announcementTextColor: settings.announcementTextColor || "#ffffff",
        announcementEnabled: settings.announcementEnabled ?? true,
        navLinks: (settings.navLinks as NavLink[]) || [],
        primaryColor: settings.primaryColor || "#000000",
        accentColor: settings.accentColor || "#04a7cd",
        footerBgColor: settings.footerBgColor || "#F5F5F5",
        footerColumns: (settings.footerColumns as FooterColumn[]) || [],
        footerAddress: settings.footerAddress || "",
        footerLinks: (settings.footerLinks as FooterLink[]) || [],
        footerCopyright: settings.footerCopyright || "© 2026 Well Told. All rights reserved.",
        footerAnnouncementEnabled: settings.footerAnnouncementEnabled ?? false,
        footerAnnouncementText: settings.footerAnnouncementText || "",
        footerAnnouncementLink: settings.footerAnnouncementLink || "",
        footerAnnouncementBgColor: settings.footerAnnouncementBgColor || "#f0ebe7",
        footerAnnouncementTextColor: settings.footerAnnouncementTextColor || "#000000",
        socialHandle: settings.socialHandle || "@WellToldDesign",
        socialLinks: (settings.socialLinks as SocialPlatform[]) || [],
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: SiteSettingsData) => {
      const res = await apiRequest("PUT", "/api/site-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({ title: "Site settings saved", description: "Changes are live on the next page request." });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  // Nav link helpers
  const updateNavLink = (i: number, field: keyof NavLink, value: string) => {
    const links = [...form.navLinks];
    links[i] = { ...links[i], [field]: value };
    setForm({ ...form, navLinks: links });
  };
  const removeNavLink = (i: number) => setForm({ ...form, navLinks: form.navLinks.filter((_, idx) => idx !== i) });
  const addNavLink = () => setForm({ ...form, navLinks: [...form.navLinks, { label: "", href: "" }] });

  // Footer column helpers
  const addColumn = () => setForm({ ...form, footerColumns: [...form.footerColumns, { heading: "", links: [] }] });
  const removeColumn = (ci: number) => setForm({ ...form, footerColumns: form.footerColumns.filter((_, i) => i !== ci) });
  const updateColumnHeading = (ci: number, heading: string) => {
    const cols = form.footerColumns.map((c, i) => i === ci ? { ...c, heading } : c);
    setForm({ ...form, footerColumns: cols });
  };
  const addColumnLink = (ci: number) => {
    const cols = form.footerColumns.map((c, i) => i === ci ? { ...c, links: [...c.links, { label: "", href: "" }] } : c);
    setForm({ ...form, footerColumns: cols });
  };
  const removeColumnLink = (ci: number, li: number) => {
    const cols = form.footerColumns.map((c, i) => i === ci ? { ...c, links: c.links.filter((_, j) => j !== li) } : c);
    setForm({ ...form, footerColumns: cols });
  };
  const updateColumnLink = (ci: number, li: number, field: keyof FooterLink, value: string) => {
    const cols = form.footerColumns.map((c, i) =>
      i === ci ? { ...c, links: c.links.map((l, j) => j === li ? { ...l, [field]: value } : l) } : c
    );
    setForm({ ...form, footerColumns: cols });
  };

  // Footer link helpers (bottom bar — terms, privacy, etc.)
  const addFooterLink = () => setForm({ ...form, footerLinks: [...form.footerLinks, { label: "", href: "" }] });
  const removeFooterLink = (i: number) => setForm({ ...form, footerLinks: form.footerLinks.filter((_, idx) => idx !== i) });
  const updateFooterLink = (i: number, field: keyof FooterLink, value: string) => {
    const links = [...form.footerLinks];
    links[i] = { ...links[i], [field]: value };
    setForm({ ...form, footerLinks: links });
  };

  // Social link helpers
  const addSocialLink = () => setForm({ ...form, socialLinks: [...form.socialLinks, { platform: "instagram", url: "" }] });
  const removeSocialLink = (i: number) => setForm({ ...form, socialLinks: form.socialLinks.filter((_, idx) => idx !== i) });
  const updateSocialLink = (i: number, field: keyof SocialPlatform, value: string) => {
    const links = [...form.socialLinks];
    links[i] = { ...links[i], [field]: value } as SocialPlatform;
    setForm({ ...form, socialLinks: links });
  };

  if (isLoading) {
    return (
      <div>
        <div className="wt-page-header">
          <h1 className="wt-page-title">Site Settings</h1>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(n => <div key={n} className="h-24 border border-black bg-[#f0ebe7]" />)}
        </div>
      </div>
    );
  }

  const dimmed = "opacity-50 pointer-events-none";

  return (
    <div>
      <div className="wt-page-header">
        <div className="mb-4">
          <h1 className="wt-page-title">Site Settings</h1>
          <p className="text-gray-500 text-sm mt-1">
            Global header and footer configuration for welltolddesign.com. Changes are live on the next page request — no redeployment needed.
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="bg-black hover:bg-gray-800 text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>

      <div className="space-y-6">

        {/* Logo */}
        <div className="border border-black bg-[#f0ebe7] p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="h-4 w-4" />
            <h2 className="font-semibold text-sm">Logo</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="logo-url">Logo image URL</Label>
              <Input id="logo-url" placeholder="https://…/logo.svg" value={form.logoUrl}
                onChange={e => setForm({ ...form, logoUrl: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logo-link">Logo link</Label>
              <Input id="logo-link" placeholder="https://welltolddesign.com" value={form.logoLink}
                onChange={e => setForm({ ...form, logoLink: e.target.value })} />
            </div>
          </div>
          {form.logoUrl && (
            <div className="border border-black bg-white p-3 flex items-center gap-3">
              <img src={form.logoUrl} alt="Logo preview" className="h-10 object-contain"
                onError={e => (e.currentTarget.style.display = "none")} />
              <span className="text-xs text-gray-500">Logo preview</span>
            </div>
          )}
        </div>

        {/* Announcement Bar */}
        <div className="border border-black bg-[#f0ebe7] p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              <h2 className="font-semibold text-sm">Announcement Bar</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                className={`relative w-10 h-5 rounded-full transition-colors ${form.announcementEnabled ? "bg-black" : "bg-gray-300"}`}
                onClick={() => setForm({ ...form, announcementEnabled: !form.announcementEnabled })}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.announcementEnabled ? "translate-x-5" : ""}`} />
              </div>
              <span className="text-sm">{form.announcementEnabled ? "Enabled" : "Disabled"}</span>
            </label>
          </div>
          <div className={`space-y-4 ${form.announcementEnabled ? "" : dimmed}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Announcement text</Label>
                <Input placeholder="FREE SHIPPING Orders Over $50" value={form.announcementText}
                  onChange={e => setForm({ ...form, announcementText: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Link URL</Label>
                <Input placeholder="https://welltolddesign.com" value={form.announcementLink}
                  onChange={e => setForm({ ...form, announcementLink: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Background colour" id="ann-bg" value={form.announcementBgColor}
                onChange={v => setForm({ ...form, announcementBgColor: v })} />
              <ColorField label="Text colour" id="ann-text" value={form.announcementTextColor}
                onChange={v => setForm({ ...form, announcementTextColor: v })} />
            </div>
            {form.announcementEnabled && form.announcementText && (
              <div className="border border-black p-3 text-center text-sm font-bold tracking-wide"
                style={{ background: form.announcementBgColor, color: form.announcementTextColor }}>
                {form.announcementText}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="border border-black bg-[#f0ebe7] p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              <h2 className="font-semibold text-sm">Navigation Links</h2>
            </div>
            <Button variant="outline" size="sm" className="border-black" onClick={addNavLink}>
              <Plus className="h-3 w-3 mr-1" />Add Link
            </Button>
          </div>
          {form.navLinks.length === 0 ? (
            <p className="text-sm text-gray-500">No navigation links yet.</p>
          ) : (
            <div className="space-y-2">
              {form.navLinks.map((link, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="Label" value={link.label}
                    onChange={e => updateNavLink(i, "label", e.target.value)} className="flex-1" />
                  <Input placeholder="https://…" value={link.href}
                    onChange={e => updateNavLink(i, "href", e.target.value)} className="flex-1" />
                  <Button variant="outline" size="sm" className="border-black shrink-0 px-2" onClick={() => removeNavLink(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Branding */}
        <div className="border border-black bg-[#f0ebe7] p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Palette className="h-4 w-4" />
            <h2 className="font-semibold text-sm">Branding</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Primary colour" id="primary-color" value={form.primaryColor}
              onChange={v => setForm({ ...form, primaryColor: v })} />
            <ColorField label="Accent colour" id="accent-color" value={form.accentColor}
              onChange={v => setForm({ ...form, accentColor: v })} />
          </div>
        </div>

        {/* Footer */}
        <div className="border border-black bg-[#f0ebe7] p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm">Footer</h2>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Footer logo URL <span className="text-gray-400 font-normal">(leave blank to use the header logo)</span></Label>
            <Input placeholder="https://… (defaults to header logo)" value={form.footerLogoUrl}
              onChange={e => setForm({ ...form, footerLogoUrl: e.target.value })} />
            {form.footerLogoUrl && (
              <img src={form.footerLogoUrl} alt="Footer logo preview" className="h-12 w-auto mt-1 border border-black p-1 bg-white" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Copyright line</Label>
              <Input placeholder="© 2026 Well Told. All rights reserved." value={form.footerCopyright}
                onChange={e => setForm({ ...form, footerCopyright: e.target.value })} />
            </div>
            <ColorField label="Footer background" id="footer-bg" value={form.footerBgColor}
              onChange={v => setForm({ ...form, footerBgColor: v })} />
          </div>

          {/* Footer announcement banner */}
          <div className="space-y-3 border-t border-black/10 pt-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Footer announcement banner
              </Label>
              <button
                type="button"
                onClick={() => setForm({ ...form, footerAnnouncementEnabled: !form.footerAnnouncementEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border border-black ${form.footerAnnouncementEnabled ? "bg-black" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white border border-black/20 transition-transform ${form.footerAnnouncementEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <div className={`space-y-3 ${!form.footerAnnouncementEnabled ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Banner text</Label>
                  <Input placeholder="e.g. Free shipping on orders over $50" value={form.footerAnnouncementText}
                    onChange={e => setForm({ ...form, footerAnnouncementText: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Link URL <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input placeholder="https://…" value={form.footerAnnouncementLink}
                    onChange={e => setForm({ ...form, footerAnnouncementLink: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ColorField label="Background colour" id="footer-ann-bg" value={form.footerAnnouncementBgColor}
                  onChange={v => setForm({ ...form, footerAnnouncementBgColor: v })} />
                <ColorField label="Text colour" id="footer-ann-text" value={form.footerAnnouncementTextColor}
                  onChange={v => setForm({ ...form, footerAnnouncementTextColor: v })} />
              </div>
              {form.footerAnnouncementEnabled && form.footerAnnouncementText && (
                <div className="text-xs font-medium tracking-wider text-center py-2.5 px-4"
                  style={{ backgroundColor: form.footerAnnouncementBgColor, color: form.footerAnnouncementTextColor }}>
                  {form.footerAnnouncementText}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Bottom bar links <span className="text-gray-400 font-normal">(e.g. Terms, Privacy)</span></Label>
              <Button variant="outline" size="sm" className="border-black" onClick={addFooterLink}>
                <Plus className="h-3 w-3 mr-1" />Add Link
              </Button>
            </div>
            {form.footerLinks.length === 0 ? (
              <p className="text-sm text-gray-500">No bottom bar links yet. Add terms, privacy, or other legal links here.</p>
            ) : (
              <div className="space-y-2">
                {form.footerLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input placeholder="Label" value={link.label}
                      onChange={e => updateFooterLink(i, "label", e.target.value)} className="flex-1" />
                    <Input placeholder="https://…" value={link.href}
                      onChange={e => updateFooterLink(i, "href", e.target.value)} className="flex-1" />
                    <Button variant="outline" size="sm" className="border-black shrink-0 px-2" onClick={() => removeFooterLink(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Footer columns</Label>
              <Button variant="outline" size="sm" className="border-black" onClick={addColumn}>
                <Plus className="h-3 w-3 mr-1" />Add Column
              </Button>
            </div>
            {form.footerColumns.length === 0 ? (
              <p className="text-sm text-gray-500">No footer columns yet. Add columns to build the multi-column footer.</p>
            ) : (
              <div className="space-y-4">
                {form.footerColumns.map((col, ci) => (
                  <div key={ci} className="border border-black bg-white p-4 space-y-3">
                    <div className="flex gap-2 items-center">
                      <Input placeholder="Column heading (e.g. Shop)" value={col.heading}
                        onChange={e => updateColumnHeading(ci, e.target.value)} className="flex-1 font-semibold" />
                      <Button variant="outline" size="sm" className="border-black shrink-0 px-2" onClick={() => removeColumn(ci)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {col.links.map((link, li) => (
                        <div key={li} className="flex gap-2 items-center pl-2">
                          <Input placeholder="Label" value={link.label}
                            onChange={e => updateColumnLink(ci, li, "label", e.target.value)} className="flex-1" />
                          <Input placeholder="https://…" value={link.href}
                            onChange={e => updateColumnLink(ci, li, "href", e.target.value)} className="flex-1" />
                          <Button variant="outline" size="sm" className="border-black shrink-0 px-2" onClick={() => removeColumnLink(ci, li)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="border-black ml-2" onClick={() => addColumnLink(ci)}>
                        <Plus className="h-3 w-3 mr-1" />Add Link
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Social Links */}
        <div className="border border-black bg-[#f0ebe7] p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              <h2 className="font-semibold text-sm">Social Links</h2>
            </div>
            <Button variant="outline" size="sm" className="border-black" onClick={addSocialLink}>
              <Plus className="h-3 w-3 mr-1" />Add Social Link
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>Social handle (shown in footer)</Label>
            <Input placeholder="@WellToldDesign" value={form.socialHandle}
              onChange={e => setForm({ ...form, socialHandle: e.target.value })} className="max-w-xs" />
          </div>
          {form.socialLinks.length === 0 ? (
            <p className="text-sm text-gray-500">No social links yet.</p>
          ) : (
            <div className="space-y-2">
              {form.socialLinks.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={s.platform}
                    onChange={e => updateSocialLink(i, "platform", e.target.value)}
                    className="border border-black bg-white px-2 py-1.5 text-sm w-36 shrink-0"
                  >
                    {SOCIAL_PLATFORMS.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                  <Input placeholder="https://instagram.com/welltolddesign" value={s.url}
                    onChange={e => updateSocialLink(i, "url", e.target.value)} className="flex-1" />
                  <Button variant="outline" size="sm" className="border-black shrink-0 px-2" onClick={() => removeSocialLink(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Email Styles */}
        <EmailStylesSection />

        {/* HTML Snippets */}
        <HtmlSnippetsSection />

        {/* Info */}
        <div className="border border-black bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink className="h-4 w-4" />
            <span className="font-semibold text-sm">How this works</span>
          </div>
          <p className="text-sm text-gray-500">
            These settings are fetched by the Cloudflare Worker at request time and rendered around every page on welltolddesign.com. Changes take effect on the next page request — no redeployment needed.
          </p>
        </div>

      </div>
    </div>
  );
}

// ── Email Styles sub-component ────────────────────────────────────────────────

interface EmailStyleData {
  id?: number;
  name: string;
  logoUrl: string;
  logoLink: string;
  footerAddress: string;
  unsubscribeLink: string;
  socialLinks: Array<{ platform: string; url: string }>;
}

const BLANK_STYLE: EmailStyleData = {
  name: "",
  logoUrl: "",
  logoLink: "https://welltolddesign.com",
  footerAddress: "",
  unsubscribeLink: "{{ unsubscribe_url }}",
  socialLinks: [],
};

function EmailStyleForm({ initial, onSave, onCancel }: {
  initial: EmailStyleData;
  onSave: (data: EmailStyleData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EmailStyleData>(initial);

  const addSocial = () => setForm({ ...form, socialLinks: [...form.socialLinks, { platform: "Instagram", url: "" }] });
  const removeSocial = (i: number) => setForm({ ...form, socialLinks: form.socialLinks.filter((_, j) => j !== i) });
  const updateSocial = (i: number, field: "platform" | "url", val: string) => {
    const links = [...form.socialLinks];
    links[i] = { ...links[i], [field]: val };
    setForm({ ...form, socialLinks: links });
  };

  return (
    <div className="space-y-3 border border-black bg-white p-4">
      <div className="space-y-1.5">
        <Label>Style Name <span className="text-red-500">*</span></Label>
        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Default Style" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Header logo URL</Label>
          <Input value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://…/logo.png" />
        </div>
        <div className="space-y-1.5">
          <Label>Header logo link</Label>
          <Input value={form.logoLink} onChange={e => setForm({ ...form, logoLink: e.target.value })} placeholder="https://welltolddesign.com" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Footer address</Label>
        <Textarea value={form.footerAddress} onChange={e => setForm({ ...form, footerAddress: e.target.value })}
          placeholder="123 Design Street, Melbourne VIC 3000" className="min-h-[56px] text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label>Unsubscribe link placeholder</Label>
        <Input value={form.unsubscribeLink} onChange={e => setForm({ ...form, unsubscribeLink: e.target.value })} placeholder="&#123;&#123; unsubscribe_url &#125;&#125;" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Footer social links</Label>
          <Button type="button" variant="outline" size="sm" className="border-black h-7 text-xs" onClick={addSocial}>
            <Plus className="h-3 w-3 mr-1" />Add
          </Button>
        </div>
        {form.socialLinks.map((s, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input value={s.platform} onChange={e => updateSocial(i, "platform", e.target.value)}
              placeholder="Instagram" className="w-28 shrink-0" />
            <Input value={s.url} onChange={e => updateSocial(i, "url", e.target.value)}
              placeholder="https://instagram.com/…" className="flex-1" />
            <Button type="button" variant="outline" size="sm" className="border-black shrink-0 px-2" onClick={() => removeSocial(i)}>
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="bg-black text-white hover:bg-gray-800" onClick={() => onSave(form)}>
          <Check className="h-3.5 w-3.5 mr-1" />Save Style
        </Button>
        <Button size="sm" variant="outline" className="border-black" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" />Cancel
        </Button>
      </div>
    </div>
  );
}

// ── HTML Snippets sub-component ───────────────────────────────────────────────

function HtmlSnippetsSection() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: snippets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/snippets"],
  });

  const saveMutation = useMutation({
    mutationFn: ({ name, html }: { name: string; html: string }) =>
      apiRequest("PUT", `/api/snippets/${name}`, { html }).then(r => r.json()),
    onSuccess: (_, { name }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      toast({ title: "Snippet saved", description: `"${name}" updated successfully.` });
    },
    onError: () => toast({ title: "Failed to save snippet", variant: "destructive" }),
  });

  const handleExpand = (name: string, html: string) => {
    if (expanded === name) {
      setExpanded(null);
    } else {
      setExpanded(name);
      if (!(name in drafts)) setDrafts(d => ({ ...d, [name]: html }));
    }
  };

  const handleSave = (name: string) => {
    saveMutation.mutate({ name, html: drafts[name] ?? "" });
  };

  const handleReset = (name: string, html: string) => {
    setDrafts(d => ({ ...d, [name]: html }));
  };

  return (
    <div className="border border-black bg-[#f0ebe7] p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Code2 className="h-4 w-4" />
        <h2 className="font-semibold text-sm">HTML Snippets</h2>
      </div>
      <p className="text-xs text-gray-500">
        Reusable HTML blocks used in the email editor (headers, footers, etc.). Edit the raw HTML here and save to update them across all future uses.
      </p>

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

      <div className="space-y-2">
        {snippets.map((snippet: any) => {
          const isOpen = expanded === snippet.name;
          const draft = drafts[snippet.name] ?? snippet.html ?? "";
          const isDirty = draft !== snippet.html;

          return (
            <div key={snippet.name} className="border border-black bg-white">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#f0ebe7] transition-colors"
                onClick={() => handleExpand(snippet.name, snippet.html ?? "")}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{snippet.label || snippet.name}</p>
                  {snippet.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{snippet.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {isDirty && isOpen && (
                    <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Unsaved</span>
                  )}
                  <code className="text-[10px] text-gray-400 font-mono hidden sm:block">{snippet.name}</code>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-black px-4 pb-4 pt-3 space-y-3">
                  <Textarea
                    value={draft}
                    onChange={e => setDrafts(d => ({ ...d, [snippet.name]: e.target.value }))}
                    className="font-mono text-xs min-h-[320px] resize-y border-black"
                    spellCheck={false}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-black text-white hover:bg-gray-800"
                      onClick={() => handleSave(snippet.name)}
                      disabled={saveMutation.isPending || !isDirty}
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {saveMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                    {isDirty && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-black"
                        onClick={() => handleReset(snippet.name, snippet.html ?? "")}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />Discard
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmailStylesSection() {
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: styles = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/email-styles"] });

  const createMutation = useMutation({
    mutationFn: (data: EmailStyleData) => apiRequest("POST", "/api/email-styles", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/email-styles"] }); setShowNew(false); toast({ title: "Email style created" }); },
    onError: () => toast({ title: "Failed to create style", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmailStyleData }) => apiRequest("PUT", `/api/email-styles/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/email-styles"] }); setEditingId(null); toast({ title: "Email style updated" }); },
    onError: () => toast({ title: "Failed to update style", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/email-styles/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/email-styles"] }); toast({ title: "Email style deleted" }); },
    onError: () => toast({ title: "Failed to delete style", variant: "destructive" }),
  });

  return (
    <div className="border border-black bg-[#f0ebe7] p-5 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <h2 className="font-semibold text-sm">Email Styles</h2>
        </div>
        <Button variant="outline" size="sm" className="border-black" onClick={() => { setShowNew(true); setEditingId(null); }}>
          <Plus className="h-3 w-3 mr-1" />New Style
        </Button>
      </div>
      <p className="text-xs text-gray-500">Reusable email header and footer configurations. Select a style when creating an email template.</p>

      {showNew && (
        <EmailStyleForm
          initial={BLANK_STYLE}
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setShowNew(false)}
        />
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

      {!isLoading && styles.length === 0 && !showNew && (
        <p className="text-sm text-gray-500">No email styles yet. Create one to use in email templates.</p>
      )}

      <div className="space-y-2">
        {styles.map((style: any) => (
          <div key={style.id}>
            {editingId === style.id ? (
              <EmailStyleForm
                initial={{
                  name: style.name,
                  logoUrl: style.logoUrl || "",
                  logoLink: style.logoLink || "https://welltolddesign.com",
                  footerAddress: style.footerAddress || "",
                  unsubscribeLink: style.unsubscribeLink || "{{ unsubscribe_url }}",
                  socialLinks: style.socialLinks || [],
                }}
                onSave={(data) => updateMutation.mutate({ id: style.id, data })}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="border border-black bg-white p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{style.name}</p>
                  {style.logoUrl && <p className="text-xs text-gray-400 truncate mt-0.5">{style.logoUrl}</p>}
                  {style.footerAddress && <p className="text-xs text-gray-400 truncate">{style.footerAddress}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" className="border-black h-7 text-xs px-2"
                    onClick={() => { setEditingId(style.id); setShowNew(false); }}>
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="border-black h-7 px-2"
                    onClick={() => deleteMutation.mutate(style.id)}
                    disabled={deleteMutation.isPending}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
