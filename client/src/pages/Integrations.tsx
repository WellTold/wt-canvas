import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Plus, Trash2, Store, Globe } from "lucide-react";
import { SiShopify } from "react-icons/si";
import { Mail } from "lucide-react";
import type { Integration } from "@shared/schema";

type IntegrationType = "shopify" | "klaviyo";

interface IntegrationDef {
  type: IntegrationType;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  credentialFields: Array<{ key: string; label: string; placeholder: string; type?: string }>;
}

const INTEGRATION_DEFS: IntegrationDef[] = [
  {
    type: "shopify",
    label: "Shopify",
    description: "Connect your Shopify storefront to enable product blocks and live product data.",
    Icon: SiShopify,
    credentialFields: [
      { key: "storeDomain", label: "Store Domain", placeholder: "your-store.myshopify.com" },
      { key: "storefrontToken", label: "Storefront API Token", placeholder: "shpss_••••••••", type: "password" },
    ],
  },
  {
    type: "klaviyo",
    label: "Klaviyo",
    description: "Connect Klaviyo for email marketing automation and audience sync.",
    Icon: Mail,
    credentialFields: [
      { key: "apiKey", label: "Private API Key", placeholder: "pk_xxx...", type: "password" },
    ],
  },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "connected") {
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-700">
        <CheckCircle2 size={12} className="mr-1" />
        Connected
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-700">
        <XCircle size={12} className="mr-1" />
        Error
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Not Connected
    </Badge>
  );
}

interface TestResult {
  success: boolean;
  message: string;
  shopName?: string;
  domain?: string;
  accountName?: string;
}

interface DrawerState {
  open: boolean;
  integration: Integration | null;
  def: IntegrationDef | null;
  isNew: boolean;
  newType: IntegrationType | null;
}

export default function Integrations() {
  const { toast } = useToast();
  const [drawer, setDrawer] = useState<DrawerState>({
    open: false,
    integration: null,
    def: null,
    isNew: false,
    newType: null,
  });
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [integrationName, setIntegrationName] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [shopifyMode, setShopifyMode] = useState<"admin" | "token" | "oauth">("admin");

  // When opening an existing Shopify integration, detect which mode was used
  useEffect(() => {
    if (drawer.def?.type === "shopify" && drawer.integration) {
      const creds = (drawer.integration.credentials as Record<string, string>) ?? {};
      if (creds.adminToken || creds.storefrontToken?.startsWith("shpat_") || creds.clientSecret?.startsWith("shpat_")) {
        setShopifyMode("admin");
      } else if (creds.clientId && creds.clientSecret) {
        setShopifyMode("oauth");
      } else {
        setShopifyMode("token");
      }
    } else {
      setShopifyMode("admin");
    }
  }, [drawer.open]);

  const { data: integrationsList = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { type: string; name: string; credentials: Record<string, string>; status: string }) =>
      apiRequest("POST", "/api/integrations", data).then((r) => r.json()),
    onSuccess: (created: Integration) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Integration added" });
      setDrawer((prev) => ({ ...prev, integration: created, isNew: false }));
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Integration> }) =>
      apiRequest("PATCH", `/api/integrations/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Integration updated" });
      closeDrawer();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/integrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Integration removed" });
      closeDrawer();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openNew(type: IntegrationType) {
    const def = INTEGRATION_DEFS.find((d) => d.type === type)!;
    setDrawer({ open: true, integration: null, def, isNew: true, newType: type });
    setCredentials({});
    setIntegrationName(def.label);
    setTestResult(null);
  }

  function openExisting(integration: Integration) {
    const def = INTEGRATION_DEFS.find((d) => d.type === integration.type as IntegrationType);
    if (!def) return;
    setDrawer({ open: true, integration, def, isNew: false, newType: null });
    const rawCreds = (integration.credentials as Record<string, string>) ?? {};
    // Normalize misfiled tokens into the correct field
    let normalised = { ...rawCreds };
    // Only move shpat_ tokens — shpss_ is valid as a Client Secret in Shopify's current format
    if (normalised.clientSecret?.startsWith("shpat_")) {
      normalised = { ...normalised, adminToken: normalised.adminToken || normalised.clientSecret, clientSecret: "" };
    }
    if (normalised.storefrontToken?.startsWith("shpat_")) {
      normalised = { ...normalised, adminToken: normalised.adminToken || normalised.storefrontToken, storefrontToken: "" };
    }
    setCredentials(normalised);
    setIntegrationName(integration.name);
    setTestResult(null);
  }

  function closeDrawer() {
    setDrawer({ open: false, integration: null, def: null, isNew: false, newType: null });
    setCredentials({});
    setIntegrationName("");
    setTestResult(null);
  }

  async function testEnteredCredentials() {
    if (!drawer.def) return;
    setIsTesting(true);
    setTestResult(null);

    if (drawer.def.type === "shopify") {
      const hasToken = credentials.storeDomain && credentials.storefrontToken;
      const hasClientCreds = credentials.storeDomain && credentials.clientId && credentials.clientSecret;
      if (!hasToken && !hasClientCreds) {
        setTestResult({ success: false, message: "Please fill in store domain and either a Storefront token or Client ID + Secret." });
        setIsTesting(false);
        return;
      }
      try {
        const res = await apiRequest("POST", "/api/integrations/test-credentials", {
          type: "shopify",
          credentials,
        });
        const json = await res.json();
        if (res.ok) {
          setTestResult({ success: true, message: `Connected — ${json.shopName}`, shopName: json.shopName, domain: json.domain });
        } else {
          setTestResult({ success: false, message: json.message || "Connection failed" });
        }
      } catch (err) {
        setTestResult({ success: false, message: (err as Error).message });
      } finally {
        setIsTesting(false);
      }
      return;
    }

    if (drawer.def.type === "klaviyo") {
      if (!credentials.apiKey) {
        setTestResult({ success: false, message: "Please enter an API key first." });
        setIsTesting(false);
        return;
      }
      try {
        const res = await apiRequest("POST", "/api/integrations/test-credentials", {
          type: "klaviyo",
          credentials,
        });
        const json = await res.json();
        if (res.ok) {
          setTestResult({ success: true, message: `Connected — ${json.accountName}`, accountName: json.accountName });
        } else {
          setTestResult({ success: false, message: json.message || "Connection failed" });
        }
      } catch (err) {
        setTestResult({ success: false, message: (err as Error).message });
      } finally {
        setIsTesting(false);
      }
      return;
    }

    setIsTesting(false);
  }

  async function handleTestExistingConnection() {
    if (!drawer.integration) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiRequest("POST", `/api/integrations/${drawer.integration.id}/test-connection`);
      const json = await res.json();
      if (res.ok) {
        const label = json.shopName || json.accountName || "Success";
        setTestResult({ success: true, message: `Connected — ${label}`, shopName: json.shopName, domain: json.domain, accountName: json.accountName });
        queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      } else {
        setTestResult({ success: false, message: json.message || "Connection failed" });
      }
    } catch (err) {
      setTestResult({ success: false, message: (err as Error).message });
    } finally {
      setIsTesting(false);
    }
  }

  function handleSave() {
    if (drawer.isNew && drawer.def) {
      createMutation.mutate({
        type: drawer.def.type,
        name: integrationName || drawer.def.label,
        credentials,
        status: testResult?.success ? "connected" : "not_connected",
      });
    } else if (drawer.integration) {
      updateMutation.mutate({
        id: drawer.integration.id,
        data: {
          name: integrationName,
          credentials,
          ...(testResult?.success ? { status: "connected" } : {}),
        },
      });
    }
  }

  function handleDelete() {
    if (!drawer.integration) return;
    if (confirm(`Remove ${drawer.integration.name}?`)) {
      deleteMutation.mutate(drawer.integration.id);
    }
  }

  const findConnected = (type: IntegrationType) =>
    integrationsList.find((i) => i.type === type);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="wt-page-header">
        <h1 className="wt-page-title">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect third-party services to power Shopify product blocks, email marketing, and more.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 size={18} className="animate-spin" />
          <span>Loading integrations...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {INTEGRATION_DEFS.map((def) => {
            const existing = findConnected(def.type);
            const creds = (existing?.credentials ?? {}) as Record<string, string>;
            return (
              <Card key={def.type} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <def.Icon size={28} className="text-foreground" />
                      <div>
                        <CardTitle className="text-base">{def.label}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {def.description}
                        </CardDescription>
                      </div>
                    </div>
                    <StatusBadge status={existing?.status ?? "not_connected"} />
                  </div>

                  {existing?.status === "connected" && def.type === "shopify" && creds.storeDomain && (
                    <div className="mt-2 space-y-1">
                      {existing.name !== def.label && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Store size={12} />
                          <span>{existing.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe size={12} />
                        <span>{creds.storeDomain}</span>
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {existing ? (
                    <Button variant="outline" size="sm" onClick={() => openExisting(existing)}>
                      Manage
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => openNew(def.type)}>
                      <Plus size={14} className="mr-1" />
                      Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={drawer.open} onOpenChange={(o) => !o && closeDrawer()}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {drawer.def && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-center gap-3">
                  <drawer.def.Icon size={24} />
                  <SheetTitle>
                    {drawer.isNew ? `Connect ${drawer.def.label}` : drawer.integration?.name}
                  </SheetTitle>
                </div>
                <SheetDescription>{drawer.def.description}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="int-name">Integration Name</Label>
                  <Input
                    id="int-name"
                    value={integrationName}
                    onChange={(e) => setIntegrationName(e.target.value)}
                    placeholder={drawer.def.label}
                  />
                </div>

                {drawer.def.type === "shopify" ? (
                  <>
                    {/* Mode toggle */}
                    <div className="flex border border-black overflow-hidden text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => { setShopifyMode("admin"); setTestResult(null); }}
                        className={`flex-1 py-1.5 transition-colors ${shopifyMode === "admin" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"}`}
                      >
                        Admin Token
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShopifyMode("token"); setTestResult(null); }}
                        className={`flex-1 py-1.5 border-l border-black transition-colors ${shopifyMode === "token" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"}`}
                      >
                        Storefront Token
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShopifyMode("oauth"); setTestResult(null); }}
                        className={`flex-1 py-1.5 border-l border-black transition-colors ${shopifyMode === "oauth" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"}`}
                      >
                        Client ID + Secret
                      </button>
                    </div>

                    {/* Store domain — always shown */}
                    <div className="space-y-1.5">
                      <Label htmlFor="cred-storeDomain">Store Domain</Label>
                      <Input
                        id="cred-storeDomain"
                        value={credentials["storeDomain"] ?? ""}
                        onChange={(e) => { setCredentials((prev) => ({ ...prev, storeDomain: e.target.value.trim() })); setTestResult(null); }}
                        placeholder="your-store.myshopify.com"
                      />
                    </div>

                    {shopifyMode === "admin" ? (
                      <>
                        <div className="text-xs text-muted-foreground bg-muted/50 border rounded p-3 space-y-1">
                          <p>Use an <strong>App automation token</strong> from your Shopify Partners dashboard → Apps → your app → API access → Create access token.</p>
                          <p>Or use a custom app Admin API token from Shopify admin → Settings → Apps → Develop apps → your app → API credentials.</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cred-adminToken">Admin API Access Token</Label>
                          <div className="flex gap-2 items-center">
                            <Input
                              id="cred-adminToken"
                              type="text"
                              value={credentials["adminToken"] ?? ""}
                              onChange={(e) => { setCredentials((prev) => ({ ...prev, adminToken: e.target.value.trim(), storefrontToken: "", clientId: "", clientSecret: "" })); setTestResult(null); }}
                              placeholder="shpat_... or app automation token"
                              className="font-mono text-xs"
                            />
                            {credentials["adminToken"] && (
                              <button type="button" className="text-xs text-muted-foreground underline whitespace-nowrap" onClick={() => { setCredentials((prev) => ({ ...prev, adminToken: "" })); setTestResult(null); }}>Clear</button>
                            )}
                          </div>
                        </div>
                      </>
                    ) : shopifyMode === "token" ? (
                      <>
                        <div className="text-xs text-muted-foreground bg-muted/50 border rounded p-3 space-y-1">
                          <p>Find it in Shopify admin → Settings → Apps → Develop apps → your app → <strong>API credentials</strong> → Storefront API access token. Starts with <code>shpss_</code>.</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cred-storefrontToken">Storefront API Token</Label>
                          <div className="flex gap-2 items-center">
                            <Input
                              id="cred-storefrontToken"
                              type="text"
                              value={credentials["storefrontToken"] ?? ""}
                              onChange={(e) => { setCredentials((prev) => ({ ...prev, storefrontToken: e.target.value.trim(), adminToken: "", clientId: "", clientSecret: "" })); setTestResult(null); }}
                              placeholder="shpss_..."
                              className="font-mono text-xs"
                            />
                            {credentials["storefrontToken"] && (
                              <button type="button" className="text-xs text-muted-foreground underline whitespace-nowrap" onClick={() => { setCredentials((prev) => ({ ...prev, storefrontToken: "" })); setTestResult(null); }}>Clear</button>
                            )}
                          </div>
                          {credentials["storefrontToken"] && !credentials["storefrontToken"].startsWith("shpss_") && !credentials["storefrontToken"].startsWith("shpat_") && (
                            <p className="text-xs text-red-600">Storefront tokens start with <code>shpss_</code></p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-muted-foreground bg-muted/50 border rounded p-3 space-y-1">
                          <p>Find these in your Shopify Partners dashboard → Apps → your app → <strong>Settings</strong>.</p>
                          <p>Client Secret starts with <code>shpss_</code> — that's correct for this field.</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cred-clientId">Client ID</Label>
                          <Input
                            id="cred-clientId"
                            value={credentials["clientId"] ?? ""}
                            onChange={(e) => { setCredentials((prev) => ({ ...prev, clientId: e.target.value, storefrontToken: "" })); setTestResult(null); }}
                            placeholder="d4090ea1..."
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cred-clientSecret">Client Secret</Label>
                          <Input
                            id="cred-clientSecret"
                            type="password"
                            value={credentials["clientSecret"] ?? ""}
                            onChange={(e) => { setCredentials((prev) => ({ ...prev, clientSecret: e.target.value, storefrontToken: "" })); setTestResult(null); }}
                            placeholder="shpss_••••••••"
                          />
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  drawer.def.credentialFields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={`cred-${field.key}`}>{field.label}</Label>
                      <Input
                        id={`cred-${field.key}`}
                        type={field.type ?? "text"}
                        value={credentials[field.key] ?? ""}
                        onChange={(e) => {
                          setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }));
                          setTestResult(null);
                        }}
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={testEnteredCredentials}
                    disabled={isTesting}
                    className="flex-1"
                  >
                    {isTesting ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : null}
                    Test Connection
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                    {isSaving && <Loader2 size={14} className="mr-2 animate-spin" />}
                    {drawer.isNew ? "Save" : "Save Changes"}
                  </Button>
                </div>

                {testResult && (
                  <div
                    className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                      testResult.success
                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    ) : (
                      <XCircle size={16} className="mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p>{testResult.message}</p>
                      {testResult.domain && (
                        <p className="text-xs mt-0.5 opacity-75">{testResult.domain}</p>
                      )}
                    </div>
                  </div>
                )}

                {!drawer.isNew && drawer.integration && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 size={14} className="mr-1" />
                      Remove Integration
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
