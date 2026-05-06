import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Trash2, Pencil, Plus, Upload, Sparkles, Check, X, ExternalLink, Loader2, Zap, LayoutList, Library, ChevronRight, ChevronDown } from "lucide-react";
import type { Keyword, ContentItem } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  untargeted: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  published: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const TYPE_COLORS: Record<string, string> = {
  primary: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  secondary: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog_article: "Blog Article",
  landing_page: "Landing Page",
  lead_magnet: "Lead Magnet",
};

const PRIORITY_COLORS: Record<string, string> = {
  primary: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  supporting: "border border-sky-400 text-sky-700 dark:border-sky-500 dark:text-sky-300 bg-transparent",
};

const ARTICLE_ANGLES = [
  "Gift Guide — Standard",
  "Gift Guide — Passion-Led",
  "Story-Led — Mark the Moment",
  "Personal — The Gift That Actually Means Something",
  "Contrarian — Why These Gifts Are Always Boring",
  "Reframe — Gifts for the Parents, Not the Baby",
  "Informational — Build Authority",
] as const;

function kdColor(kd: number | null | undefined): string {
  if (kd == null) return "text-gray-500";
  if (kd <= 25) return "text-green-600 dark:text-green-400 font-medium";
  if (kd <= 35) return "text-amber-600 dark:text-amber-400 font-medium";
  return "text-red-600 dark:text-red-400 font-medium";
}

interface SuggestionItem {
  keyword: string;
  type: "primary" | "secondary";
  cluster: string;
  contentTypeTarget: "blog_article" | "landing_page" | "lead_magnet";
  rationale: string;
  selected?: boolean;
}

interface RowState {
  keyword: string;
  type: string;
  volume: string;
  kd: string;
  cluster: string;
  articleAngle: string;
  priority: string;
  contentTypeTarget: string;
  status: string;
}

const BLANK_ROW: RowState = {
  keyword: "",
  type: "primary",
  volume: "",
  kd: "",
  cluster: "",
  articleAngle: "none",
  priority: "supporting",
  contentTypeTarget: "none",
  status: "untargeted",
};

function rowStateToPayload(r: RowState) {
  const vol = r.volume.trim() ? parseInt(r.volume, 10) : null;
  const kdVal = r.kd.trim() ? parseInt(r.kd, 10) : null;
  return {
    keyword: r.keyword.trim(),
    type: r.type,
    volume: Number.isFinite(vol as number) ? vol : null,
    kd: Number.isFinite(kdVal as number) ? kdVal : null,
    cluster: r.cluster.trim() || null,
    articleAngle: r.articleAngle === "none" ? null : r.articleAngle,
    priority: r.priority,
    contentTypeTarget: r.contentTypeTarget === "none" ? null : r.contentTypeTarget,
    status: r.status,
  };
}

function keywordToRowState(kw: Keyword): RowState {
  return {
    keyword: kw.keyword,
    type: kw.type,
    volume: kw.volume != null ? String(kw.volume) : "",
    kd: kw.kd != null ? String(kw.kd) : "",
    cluster: kw.cluster ?? "",
    articleAngle: kw.articleAngle ?? "none",
    priority: kw.priority ?? "supporting",
    contentTypeTarget: kw.contentTypeTarget ?? "none",
    status: kw.status,
  };
}

function InlineRowFields({
  row,
  onChange,
}: {
  row: RowState;
  onChange: (updated: RowState) => void;
}) {
  return (
    <>
      <TableCell>
        <Input
          value={row.keyword}
          onChange={(e) => onChange({ ...row, keyword: e.target.value })}
          placeholder="Enter keyword…"
          className="h-8 text-sm"
          autoFocus
        />
      </TableCell>
      <TableCell>
        <Select value={row.type} onValueChange={(v) => onChange({ ...row, type: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={row.volume}
          onChange={(e) => onChange({ ...row, volume: e.target.value })}
          placeholder="Vol"
          className="h-8 text-xs w-20"
          type="number"
          min={0}
        />
      </TableCell>
      <TableCell>
        <Input
          value={row.kd}
          onChange={(e) => onChange({ ...row, kd: e.target.value })}
          placeholder="KD"
          className="h-8 text-xs w-16"
          type="number"
          min={0}
          max={100}
        />
      </TableCell>
      <TableCell>
        <Input
          value={row.cluster}
          onChange={(e) => onChange({ ...row, cluster: e.target.value })}
          placeholder="Cluster"
          className="h-8 text-xs"
        />
      </TableCell>
      <TableCell>
        <Select value={row.articleAngle} onValueChange={(v) => onChange({ ...row, articleAngle: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Angle…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {ARTICLE_ANGLES.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={row.priority} onValueChange={(v) => onChange({ ...row, priority: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="supporting">Supporting</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={row.contentTypeTarget}
          onValueChange={(v) => onChange({ ...row, contentTypeTarget: v })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Any</SelectItem>
            <SelectItem value="blog_article">Blog Article</SelectItem>
            <SelectItem value="landing_page">Landing Page</SelectItem>
            <SelectItem value="lead_magnet">Lead Magnet</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={row.status} onValueChange={(v) => onChange({ ...row, status: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="untargeted">Untargeted</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
    </>
  );
}

export default function Keywords() {
  const { toast } = useToast();

  const [filterCluster, setFilterCluster] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortCol, setSortCol] = useState<"volume" | "kd" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [showAddRow, setShowAddRow] = useState(false);
  const [newKw, setNewKw] = useState<RowState>({ ...BLANK_ROW });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<RowState>({ ...BLANK_ROW });

  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkType, setBulkType] = useState("primary");
  const [bulkCluster, setBulkCluster] = useState("");
  const [bulkContentType, setBulkContentType] = useState("none");

  const csvInputRef = useRef<HTMLInputElement>(null);

  const [showSuggestPanel, setShowSuggestPanel] = useState(false);
  const [suggestCluster, setSuggestCluster] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

  // ── Tabs & Content Plan ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"library" | "plan">("library");
  const [planClusterFilter, setPlanClusterFilter] = useState("");
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());

  const toggleCluster = (cluster: string) =>
    setCollapsedClusters((prev) => {
      const next = new Set(prev);
      next.has(cluster) ? next.delete(cluster) : next.add(cluster);
      return next;
    });

  // ── Batch generation ────────────────────────────────────────────────────────
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchN, setBatchN] = useState(3);
  const [batchClusterFilter, setBatchClusterFilter] = useState("");
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    total: number;
    completed: number;
    done: boolean;
    items: Array<{ keywordId: number; keyword: string; status: string; title?: string; contentItemId?: string; error?: string }>;
  } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (filterCluster) params.set("cluster", filterCluster);
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    const qs = params.toString();
    return `/api/keywords${qs ? `?${qs}` : ""}`;
  };

  const { data: keywords = [], isLoading } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords", filterCluster, filterType, filterStatus],
    queryFn: async () => {
      const res = await apiRequest("GET", buildQuery());
      return res.json();
    },
  });

  const { data: contentItems = [] } = useQuery<ContentItem[]>({
    queryKey: ["/api/content-items"],
    staleTime: 30_000,
  });

  const publishedContentItemIds = new Set(
    contentItems.filter((ci) => ci.status === "published" || ci.publishedAt != null).map((ci) => String(ci.id))
  );

  const clusters = Array.from(new Set(keywords.map((k) => k.cluster).filter(Boolean))) as string[];

  const toggleSort = (col: "volume" | "kd") => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const sortedKeywords = sortCol
    ? [...keywords].sort((a, b) => {
        const av = a[sortCol] ?? -1;
        const bv = b[sortCol] ?? -1;
        return sortDir === "asc" ? av - bv : bv - av;
      })
    : keywords;

  async function checkResponse(res: Response): Promise<Response> {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(body.message ?? res.statusText);
    }
    return res;
  }

  const createMutation = useMutation({
    mutationFn: async (data: RowState) => {
      const res = await checkResponse(await apiRequest("POST", "/api/keywords", rowStateToPayload(data)));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      setShowAddRow(false);
      setNewKw({ ...BLANK_ROW });
      toast({ title: "Keyword added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, row }: { id: number; row: RowState }) => {
      const res = await checkResponse(await apiRequest("PATCH", `/api/keywords/${id}`, rowStateToPayload(row)));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      setEditingId(null);
      toast({ title: "Keyword updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await checkResponse(await apiRequest("DELETE", `/api/keywords/${id}`));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      toast({ title: "Keyword deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: async (kws: string[]) => {
      const res = await checkResponse(await apiRequest("POST", "/api/keywords/bulk", {
        keywords: kws,
        type: bulkType,
        cluster: bulkCluster.trim() || undefined,
        contentTypeTarget: bulkContentType === "none" ? undefined : bulkContentType,
      }));
      return res.json() as Promise<Keyword[]>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      setShowBulkPanel(false);
      setBulkText("");
      toast({ title: `${data.length} keywords added` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const res = await checkResponse(await apiRequest("POST", "/api/keywords/suggest", {
        cluster: suggestCluster.trim() || undefined,
      }));
      const data = await res.json();
      return data.suggestions as SuggestionItem[];
    },
    onSuccess: (data) => {
      setSuggestions(data.map((s) => ({ ...s, selected: true })));
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const acceptSuggestionsMutation = useMutation({
    mutationFn: async (items: SuggestionItem[]) => {
      const res = await checkResponse(await apiRequest("POST", "/api/keywords/bulk", {
        keywords: items.map((s) => ({
          keyword: s.keyword,
          type: s.type,
          cluster: s.cluster,
          contentTypeTarget: s.contentTypeTarget,
          status: "untargeted",
        })),
      }));
      return res.json() as Promise<Keyword[]>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      setShowSuggestPanel(false);
      setSuggestions([]);
      toast({ title: `${data.length} keywords added from AI suggestions` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const markPublishedMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await checkResponse(await apiRequest("PATCH", `/api/keywords/${id}`, { status: "published" }));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-items"] });
      toast({ title: "Marked as published" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetInProgressMutation = useMutation({
    mutationFn: async () => {
      const res = await checkResponse(await apiRequest("POST", "/api/keywords/reset-in-progress", {}));
      return res.json() as Promise<{ reset: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      toast({ title: "Keywords reset", description: `${data.reset} keyword${data.reset !== 1 ? "s" : ""} set back to untargeted.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const batchMutation = useMutation({
    mutationFn: async ({ n, clusterFilter }: { n: number; clusterFilter?: string }) => {
      const res = await checkResponse(await apiRequest("POST", "/api/keywords/batch-create", { n, clusterFilter }));
      return res.json() as Promise<{ jobId: string; total: number; keywords: string[] }>;
    },
    onSuccess: (data) => {
      setBatchJobId(data.jobId);
      setBatchProgress({ total: data.total, completed: 0, done: false, items: data.keywords.map((k, i) => ({ keywordId: i, keyword: k, status: "pending" })) });
      toast({ title: `Generating ${data.total} article${data.total !== 1 ? "s" : ""}…`, description: "This may take a few minutes." });
    },
    onError: (err: Error) => toast({ title: "Batch failed", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!batchJobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiRequest("GET", `/api/keywords/batch-status/${batchJobId}`);
        const data = await res.json();
        setBatchProgress(data);
        if (data.done) {
          clearInterval(interval);
          pollIntervalRef.current = null;
          queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
          const doneCount = data.items.filter((i: { status: string }) => i.status === "done").length;
          const errCount = data.items.filter((i: { status: string }) => i.status === "error").length;
          toast({
            title: `Batch complete: ${doneCount} created${errCount ? `, ${errCount} failed` : ""}`,
          });
        }
      } catch {
        clearInterval(interval);
        pollIntervalRef.current = null;
      }
    }, 4000);
    pollIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [batchJobId]);

  const handleBulkSubmit = () => {
    const lines = bulkText
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    bulkMutation.mutate(lines);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.text();

    // RFC 4180-compliant CSV parser — handles quoted fields containing commas/newlines
    const parseCSV = (text: string): string[][] => {
      const rows: string[][] = [];
      let row: string[] = [];
      let cell = "";
      let inQuotes = false;
      // Normalise line endings
      const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inQuotes) {
          if (ch === '"') {
            if (src[i + 1] === '"') { cell += '"'; i++; } // escaped quote
            else inQuotes = false;
          } else {
            cell += ch;
          }
        } else {
          if (ch === '"') { inQuotes = true; }
          else if (ch === ',') { row.push(cell.trim()); cell = ""; }
          else if (ch === '\n') {
            row.push(cell.trim()); cell = "";
            if (row.some(Boolean)) rows.push(row);
            row = [];
          } else { cell += ch; }
        }
      }
      // Final cell/row
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      return rows;
    };

    const allRows = parseCSV(raw);
    if (allRows.length < 2) {
      toast({ title: "CSV file is empty or invalid", variant: "destructive" });
      return;
    }

    const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const header = allRows[0].map(normalize);

    const col = (name: string) => {
      const idx = header.indexOf(normalize(name));
      return idx === -1 ? null : idx;
    };

    const kwIdx = col("keyword");
    if (kwIdx === null) {
      toast({ title: "CSV must have a 'keyword' column", variant: "destructive" });
      return;
    }

    const typeIdx = col("type");
    const volumeIdx = col("volume");
    const kdIdx = col("kd");
    const clusterIdx = col("cluster");
    const angleIdx = col("articleAngle") ?? col("article_angle") ?? col("articleangle");
    const priorityIdx = col("priority");
    const ctIdx = col("contentTypeTarget") ?? col("content_type_target") ?? col("contenttypetarget");
    const statusIdx = col("status");

    // Strip thousands-separator commas before parsing (e.g. "1,234,567" → 1234567)
    const cleanNum = (v: string) => v.replace(/,/g, "").trim();
    const parseMaybeInt = (v: string) => {
      const n = parseInt(cleanNum(v), 10);
      return Number.isFinite(n) ? n : null;
    };
    const parseMaybePositiveInt = (v: string) => {
      const n = parseInt(cleanNum(v), 10);
      if (!Number.isFinite(n) || n < 0) return null;
      return n;
    };

    const validAngles = new Set<string>(ARTICLE_ANGLES);
    const validTypes = new Set(["primary", "secondary"]);
    const validPriorities = new Set(["primary", "supporting"]);
    const validStatuses = new Set(["untargeted", "in_progress", "published"]);

    const normaliseStatus = (v: string): string => {
      const s = v.toLowerCase().trim();
      if (s === "" || s === "unassigned" || s === "none" || s === "-") return "untargeted";
      if (s === "in progress" || s === "inprogress" || s === "active") return "in_progress";
      if (s === "live" || s === "complete" || s === "completed") return "published";
      return validStatuses.has(s) ? s : "untargeted";
    };

    const items = allRows
      .slice(1)
      .map((cols) => {
        const kw = cols[kwIdx] ?? "";
        if (!kw) return null;
        const rawStatus = statusIdx !== null ? (cols[statusIdx] ?? "") : "";
        const rawAngle = angleIdx !== null ? (cols[angleIdx] ?? "") : "";
        const rawType = (typeIdx !== null ? cols[typeIdx] : "").toLowerCase();
        const rawPriority = (priorityIdx !== null ? cols[priorityIdx] : "").toLowerCase();
        return {
          keyword: kw,
          type: validTypes.has(rawType) ? rawType : "primary",
          volume: volumeIdx !== null ? parseMaybeInt(cols[volumeIdx] ?? "") : null,
          kd: kdIdx !== null ? parseMaybePositiveInt(cols[kdIdx] ?? "") : null,
          cluster: clusterIdx !== null ? cols[clusterIdx] || null : null,
          articleAngle: rawAngle && validAngles.has(rawAngle) ? rawAngle : null,
          priority: validPriorities.has(rawPriority) ? rawPriority : "supporting",
          contentTypeTarget: ctIdx !== null ? cols[ctIdx] || null : null,
          status: normaliseStatus(rawStatus),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (items.length === 0) {
      toast({ title: "No valid keywords found in CSV", variant: "destructive" });
      return;
    }

    // Send in batches of 500 to avoid hitting PostgreSQL's parameter limit
    const BATCH_SIZE = 500;
    let totalImported = 0;
    try {
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const res = await apiRequest("POST", "/api/keywords/bulk", { keywords: batch });
        const checked = await checkResponse(res);
        const created = await checked.json() as Keyword[];
        totalImported += created.length;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      toast({ title: `${totalImported} keywords imported from CSV` });
    } catch (err: unknown) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
    }

    e.target.value = "";
  };

  const toggleSuggestion = (idx: number) => {
    setSuggestions((prev) => prev.map((s, i) => (i === idx ? { ...s, selected: !s.selected } : s)));
  };

  const startEdit = (kw: Keyword) => {
    setEditingId(kw.id);
    setEditRow(keywordToRowState(kw));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRow({ ...BLANK_ROW });
  };

  // Content plan helpers
  const allClusters = Array.from(new Set(keywords.map((k) => k.cluster).filter(Boolean))) as string[];

  const planKeywords = keywords
    .filter((k) => !planClusterFilter || k.cluster === planClusterFilter)
    .sort((a, b) => {
      if (a.priority === "primary" && b.priority !== "primary") return -1;
      if (b.priority === "primary" && a.priority !== "primary") return 1;
      const clusterCmp = (a.cluster ?? "").localeCompare(b.cluster ?? "");
      if (clusterCmp !== 0) return clusterCmp;
      return (b.volume ?? 0) - (a.volume ?? 0);
    });

  const planGrouped = planKeywords.reduce((acc, kw) => {
    const key = kw.cluster || "Unclustered";
    if (!acc[key]) acc[key] = [];
    acc[key].push(kw);
    return acc;
  }, {} as Record<string, Keyword[]>);

  const contentItemUrl = (contentItemId: string) => {
    const isNumeric = /^\d+$/.test(contentItemId);
    if (isNumeric) return `/content/${contentItemId}`;
    return `/pages/builder?id=${contentItemId}`;
  };

  const untargetedCount = keywords.filter((k) => k.status === "untargeted").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Keywords</h1>
          <p className="text-sm text-gray-500 mt-1">Keyword library and content planning</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "plan" && (
            <Button
              size="sm"
              className="bg-black hover:bg-gray-800 text-white"
              onClick={() => setShowBatchDialog(true)}
              disabled={untargetedCount === 0}
            >
              <Zap size={15} className="mr-1.5" />
              Generate Next Articles
            </Button>
          )}
          {activeTab === "library" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowSuggestPanel(true)}>
                <Sparkles size={15} className="mr-1.5" />
                AI Suggest
              </Button>
              <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()}>
                <Upload size={15} className="mr-1.5" />
                Import CSV
              </Button>
              <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
              <Button variant="outline" size="sm" onClick={() => setShowBulkPanel(!showBulkPanel)}>
                <Plus size={15} className="mr-1.5" />
                Bulk Add
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowAddRow(true);
                  setNewKw({ ...BLANK_ROW });
                  setEditingId(null);
                }}
              >
                <Plus size={15} className="mr-1.5" />
                Add Keyword
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "library" ? "border-black text-black dark:border-white dark:text-white" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
          onClick={() => setActiveTab("library")}
        >
          <Library size={14} />
          Keyword Library
          <span className="ml-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">{keywords.length}</span>
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "plan" ? "border-black text-black dark:border-white dark:text-white" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
          onClick={() => setActiveTab("plan")}
        >
          <LayoutList size={14} />
          Content Plan
          {untargetedCount > 0 && (
            <span className="ml-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded-full">{untargetedCount} to do</span>
          )}
        </button>
      </div>

      {/* Batch generation dialog */}
      <Dialog open={showBatchDialog} onOpenChange={(v) => { if (!v) setShowBatchDialog(false); }}>
        <DialogContent className="max-w-md border-black rounded-none bg-[#fbfaf9]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Generate Next Articles</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!batchJobId || batchProgress?.done ? (
              <>
                <p className="text-sm text-gray-500">
                  AI will pick the next untargeted keywords (primary priority first → then by cluster → then highest volume), generate a full article for each, and save them as drafts.
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  {untargetedCount} untargeted keyword{untargetedCount !== 1 ? "s" : ""} available.
                </p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider mb-1.5 block">How many articles?</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 2, 3, 5, 10].filter((v) => v <= untargetedCount || v === 1).map((v) => (
                        <button
                          key={v}
                          className={`px-4 py-2 text-sm border font-medium transition-all ${batchN === v ? "border-black bg-black text-white" : "border-gray-300 bg-white hover:border-black"}`}
                          onClick={() => setBatchN(v)}
                        >
                          {v}
                        </button>
                      ))}
                      <Input
                        type="number"
                        min={1}
                        max={Math.min(10, untargetedCount)}
                        value={batchN}
                        onChange={(e) => setBatchN(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-20 h-9 text-sm rounded-none border-gray-300"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider mb-1.5 block">Cluster (optional)</Label>
                    <Select value={batchClusterFilter || "all"} onValueChange={(v) => setBatchClusterFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm rounded-none"><SelectValue placeholder="Any cluster" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any cluster</SelectItem>
                        {allClusters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    className="bg-black hover:bg-gray-800 text-white rounded-none"
                    disabled={batchMutation.isPending}
                    onClick={() => batchMutation.mutate({ n: batchN, clusterFilter: batchClusterFilter || undefined })}
                  >
                    {batchMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Starting…</> : <><Zap size={15} className="mr-1.5" />Generate {batchN} article{batchN !== 1 ? "s" : ""}</>}
                  </Button>
                  <Button variant="outline" className="rounded-none" onClick={() => setShowBatchDialog(false)}>Cancel</Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                  <span className="text-sm font-medium">Generating {batchProgress.total} article{batchProgress.total !== 1 ? "s" : ""}…</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2">
                  <div
                    className="bg-black h-2 transition-all"
                    style={{ width: `${batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{batchProgress.completed} of {batchProgress.total} complete</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {batchProgress.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      {item.status === "done" && <Check size={14} className="text-green-600 mt-0.5 shrink-0" />}
                      {item.status === "error" && <X size={14} className="text-red-500 mt-0.5 shrink-0" />}
                      {item.status === "processing" && <Loader2 size={14} className="animate-spin text-blue-500 mt-0.5 shrink-0" />}
                      {item.status === "pending" && <div className="w-3.5 h-3.5 rounded-full border border-gray-300 mt-0.5 shrink-0" />}
                      <div>
                        <span className="font-medium">{item.keyword}</span>
                        {item.title && <span className="text-gray-500 ml-1">→ {item.title}</span>}
                        {item.error && <p className="text-xs text-red-500">{item.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="rounded-none w-full" onClick={() => setShowBatchDialog(false)}>
                  Hide (continues in background)
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CONTENT PLAN TAB ─────────────────────────────────────────────────── */}
      {activeTab === "plan" && (
        <div className="space-y-4">
          {/* Batch progress banner (if running) */}
          {batchJobId && batchProgress && !batchProgress.done && (
            <div className="flex items-center gap-3 border border-black bg-[#f0ebe7] px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Generating articles… {batchProgress.completed}/{batchProgress.total}</p>
                <div className="w-full bg-gray-200 h-1.5 mt-1">
                  <div className="bg-black h-1.5 transition-all" style={{ width: `${(batchProgress.completed / batchProgress.total) * 100}%` }} />
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-7 rounded-none" onClick={() => setShowBatchDialog(true)}>Details</Button>
            </div>
          )}

          {/* Cluster filter */}
          <div className="flex items-center gap-3">
            <Select value={planClusterFilter || "all"} onValueChange={(v) => setPlanClusterFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-52 h-8 text-xs rounded-none border-black"><SelectValue placeholder="All clusters" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clusters</SelectItem>
                {allClusters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-500">{planKeywords.length} keyword{planKeywords.length !== 1 ? "s" : ""} · {planKeywords.filter((k) => k.status === "untargeted").length} untargeted</span>
          </div>

          {/* Grouped clusters */}
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : Object.keys(planGrouped).length === 0 ? (
            <div className="border border-dashed border-gray-300 p-12 text-center text-gray-500">
              <p className="text-sm">No keywords yet. Add some in the Keyword Library tab.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(planGrouped).map(([cluster, kws]) => {
                const doneCount = kws.filter((k) => k.status === "published").length;
                const inProgressCount = kws.filter((k) => k.status === "in_progress").length;
                const gapCount = kws.filter((k) => k.status === "untargeted").length;
                const withArticles = kws.filter((k) => !!k.contentItemId).length;
                const isCollapsed = collapsedClusters.has(cluster);
                return (
                  <div key={cluster} className="border border-black overflow-hidden">
                    {/* Cluster header — click anywhere to collapse/expand */}
                    <button
                      onClick={() => toggleCluster(cluster)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-[#f0ebe7] border-b border-black hover:bg-[#e8e2dd] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronRight size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
                        <span className="text-sm font-bold">{cluster || "Uncategorised"}</span>
                        <span className="text-xs text-gray-500">{kws.length} keyword{kws.length !== 1 ? "s" : ""}</span>
                        <span className="text-xs text-gray-400 border border-gray-300 px-1.5 py-0.5 rounded-full">{withArticles}/{kws.length} have articles</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {doneCount > 0 && <span className="text-green-700 font-medium">{doneCount} published</span>}
                        {inProgressCount > 0 && <span className="text-blue-700 font-medium">{inProgressCount} in progress</span>}
                        {gapCount > 0 && <span className="text-amber-700 font-medium">{gapCount} gap{gapCount !== 1 ? "s" : ""}</span>}
                      </div>
                    </button>
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {kws.map((kw) => (
                          <div key={kw.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-900 group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate">{kw.keyword}</span>
                                {kw.volume != null && (
                                  <span className="text-xs text-gray-400 tabular-nums">{kw.volume.toLocaleString()}/mo</span>
                                )}
                                {kw.kd != null && (
                                  <span className={`text-xs tabular-nums ${kdColor(kw.kd)}`}>KD {kw.kd}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[kw.priority ?? "supporting"]}`}>
                                  {kw.priority === "primary" ? "Primary" : "Supporting"}
                                </span>
                                {kw.contentTypeTarget && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                    {CONTENT_TYPE_LABELS[kw.contentTypeTarget] ?? kw.contentTypeTarget}
                                  </span>
                                )}
                                {kw.articleAngle && (
                                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={kw.articleAngle}>
                                    {kw.articleAngle}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Per-keyword status badge — always shown */}
                              {kw.status === "published" && (
                                <span className="text-xs px-2 py-0.5 font-medium bg-green-100 text-green-800 border border-green-300">Live</span>
                              )}
                              {kw.status === "in_progress" && (
                                <span className="text-xs px-2 py-0.5 font-medium bg-blue-100 text-blue-800 border border-blue-300">Draft</span>
                              )}
                              {kw.status === "untargeted" && (
                                <span className="text-xs px-2 py-0.5 font-medium border border-dashed border-gray-300 text-gray-400 italic">Gap</span>
                              )}
                              {/* Article link — shown when a content item is linked */}
                              {kw.contentItemId ? (
                                <a
                                  href={contentItemUrl(kw.contentItemId)}
                                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2 py-1 max-w-[200px] truncate"
                                  title={kw.contentItemTitle || "View article"}
                                >
                                  <ExternalLink size={11} className="shrink-0" />
                                  <span className="truncate">{kw.contentItemTitle || "View article"}</span>
                                </a>
                              ) : null}
                              {/* Mark published — shown when linked article is live but keyword not yet marked published */}
                              {kw.contentItemId && kw.status !== "published" && publishedContentItemIds.has(kw.contentItemId) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs px-2 rounded-none border-green-400 text-green-700 hover:bg-green-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                  disabled={markPublishedMutation.isPending}
                                  onClick={() => markPublishedMutation.mutate(kw.id)}
                                >
                                  <Check size={11} className="mr-1 shrink-0" />
                                  Mark published
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LIBRARY TAB ──────────────────────────────────────────────────────── */}
      {activeTab === "library" && (
        <div className="space-y-4">

      {/* Bulk paste panel */}
      {showBulkPanel && (
        <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900 space-y-3">
          <p className="text-sm font-medium">Paste keywords (one per line or comma-separated)</p>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"gift ideas for her\npersonalised gifts uk\nunique birthday presents"}
            className="h-28"
          />
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Type</Label>
              <Select value={bulkType} onValueChange={setBulkType}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Cluster (optional)</Label>
              <Input
                value={bulkCluster}
                onChange={(e) => setBulkCluster(e.target.value)}
                className="w-40 h-8 text-xs"
                placeholder="e.g. gift ideas"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Content Target (optional)</Label>
              <Select value={bulkContentType} onValueChange={setBulkContentType}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any</SelectItem>
                  <SelectItem value="blog_article">Blog Article</SelectItem>
                  <SelectItem value="landing_page">Landing Page</SelectItem>
                  <SelectItem value="lead_magnet">Lead Magnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleBulkSubmit}
              disabled={bulkMutation.isPending || !bulkText.trim()}
            >
              {bulkMutation.isPending ? "Adding…" : "Add Keywords"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowBulkPanel(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* AI Suggest panel */}
      {showSuggestPanel && (
        <div className="border rounded-lg p-4 bg-purple-50 dark:bg-purple-950 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-600" />
            <p className="text-sm font-medium text-purple-800 dark:text-purple-200">AI Keyword Suggestions</p>
          </div>
          <p className="text-xs text-purple-700 dark:text-purple-300">
            Claude will analyse your existing keyword library and suggest new long-tail keywords grouped by cluster.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Focus cluster (optional)</Label>
              <Input
                value={suggestCluster}
                onChange={(e) => setSuggestCluster(e.target.value)}
                placeholder="e.g. gift ideas"
                className="w-52 h-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={() => suggestMutation.mutate()}
              disabled={suggestMutation.isPending}
              className="bg-purple-700 hover:bg-purple-800 text-white"
            >
              {suggestMutation.isPending ? "Thinking…" : "Suggest Keywords"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowSuggestPanel(false); setSuggestions([]); }}
            >
              Close
            </Button>
          </div>

          {suggestions.length > 0 && (() => {
            const clusterGroups = Array.from(
              suggestions.reduce((map, s, idx) => {
                const key = s.cluster || "Unclustered";
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push({ ...s, _idx: idx });
                return map;
              }, new Map<string, Array<SuggestionItem & { _idx: number }>>())
            );
            const selectedCount = suggestions.filter((s) => s.selected).length;
            return (
              <div className="space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-purple-800 dark:text-purple-200">
                    {suggestions.length} suggestions in {clusterGroups.length} cluster{clusterGroups.length !== 1 ? "s" : ""} — tick the ones to add
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => setSuggestions((s) => s.map((x) => ({ ...x, selected: true })))}
                    >
                      Select all
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => setSuggestions((s) => s.map((x) => ({ ...x, selected: false })))}
                    >
                      Deselect all
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7 bg-purple-700 hover:bg-purple-800 text-white"
                      disabled={acceptSuggestionsMutation.isPending || selectedCount === 0}
                      onClick={() => acceptSuggestionsMutation.mutate(suggestions.filter((s) => s.selected))}
                    >
                      {acceptSuggestionsMutation.isPending
                        ? "Adding…"
                        : `Add ${selectedCount} to library`}
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {clusterGroups.map(([clusterName, items]) => (
                    <div key={clusterName} className="border rounded-lg bg-white dark:bg-gray-900 overflow-hidden">
                      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{clusterName}</span>
                        <span className="text-xs text-gray-400">{items.filter((i) => i.selected).length}/{items.length} selected</span>
                      </div>
                      <div className="divide-y">
                        {items.map((s) => (
                          <div key={s._idx} className="flex items-start gap-3 px-3 py-2">
                            <Checkbox
                              checked={!!s.selected}
                              onCheckedChange={() => toggleSuggestion(s._idx)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{s.keyword}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{s.rationale}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${TYPE_COLORS[s.type] ?? ""}`}>
                                {s.type}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                {CONTENT_TYPE_LABELS[s.contentTypeTarget] ?? s.contentTypeTarget}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
        <Select
          value={filterCluster || "all"}
          onValueChange={(v) => setFilterCluster(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="All clusters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clusters</SelectItem>
            {clusters.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterType || "all"}
          onValueChange={(v) => setFilterType(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterStatus || "all"}
          onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="untargeted">Untargeted</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        {(filterCluster || filterType || filterStatus) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => { setFilterCluster(""); setFilterType(""); setFilterStatus(""); }}
          >
            <X size={12} className="mr-1" /> Clear filters
          </Button>
        )}
        <span className="text-xs text-gray-500 self-center ml-auto">
          {keywords.length} keyword{keywords.length !== 1 ? "s" : ""}
        </span>
        {keywords.some((k) => k.status === "in_progress") && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-orange-400 text-orange-700 hover:bg-orange-50 shrink-0"
            disabled={resetInProgressMutation.isPending}
            onClick={() => resetInProgressMutation.mutate()}
          >
            Reset all in-progress ({keywords.filter((k) => k.status === "in_progress").length})
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[22%]">Keyword</TableHead>
              <TableHead className="w-[7%]">Type</TableHead>
              <TableHead className="w-[7%] text-right cursor-pointer select-none" onClick={() => toggleSort("volume")}>
                Vol {sortCol === "volume" ? (sortDir === "desc" ? "↓" : "↑") : ""}
              </TableHead>
              <TableHead className="w-[5%] text-right cursor-pointer select-none" onClick={() => toggleSort("kd")}>
                KD {sortCol === "kd" ? (sortDir === "desc" ? "↓" : "↑") : ""}
              </TableHead>
              <TableHead className="w-[10%]">Cluster</TableHead>
              <TableHead className="w-[14%]">Article Angle</TableHead>
              <TableHead className="w-[8%]">Priority</TableHead>
              <TableHead className="w-[11%]">Content Target</TableHead>
              <TableHead className="w-[9%]">Status</TableHead>
              <TableHead className="w-[7%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Inline add row */}
            {showAddRow && (
              <TableRow className="bg-blue-50 dark:bg-blue-950">
                <InlineRowFields row={newKw} onChange={setNewKw} />
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-green-600"
                      disabled={createMutation.isPending || !newKw.keyword.trim()}
                      onClick={() => createMutation.mutate(newKw)}
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-gray-400"
                      onClick={() => setShowAddRow(false)}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Existing keywords */}
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : keywords.length === 0 && !showAddRow ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                  <p className="text-sm">No keywords yet.</p>
                  <p className="text-xs mt-1">
                    Add keywords one at a time, bulk paste, import a CSV, or use AI Suggest.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedKeywords.map((kw) =>
                editingId === kw.id ? (
                  <TableRow key={kw.id} className="bg-yellow-50 dark:bg-yellow-950">
                    <InlineRowFields row={editRow} onChange={setEditRow} />
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-green-600"
                          disabled={updateMutation.isPending || !editRow.keyword.trim()}
                          onClick={() => updateMutation.mutate({ id: kw.id, row: editRow })}
                        >
                          <Check size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-gray-400"
                          onClick={cancelEdit}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={kw.id} className="group">
                    <TableCell className="font-medium text-sm">{kw.keyword}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[kw.type] ?? ""}`}>
                        {kw.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-right text-gray-700 dark:text-gray-300 tabular-nums">
                      {kw.volume != null ? kw.volume.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className={`text-sm text-right tabular-nums ${kdColor(kw.kd)}`}>
                      {kw.kd != null ? kw.kd : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                      {kw.cluster || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 dark:text-gray-400 max-w-[140px] truncate" title={kw.articleAngle ?? undefined}>
                      {kw.articleAngle
                        ? <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300 truncate block">{kw.articleAngle}</span>
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[kw.priority ?? "supporting"] ?? ""}`}>
                        {kw.priority === "primary" ? "Primary" : "Supporting"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                      {kw.contentTypeTarget ? (CONTENT_TYPE_LABELS[kw.contentTypeTarget] ?? kw.contentTypeTarget) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[kw.status] ?? ""}`}>
                        {kw.status === "in_progress"
                          ? "In Progress"
                          : kw.status.charAt(0).toUpperCase() + kw.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {kw.status === "in_progress" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            title="Reset to untargeted and unlink article"
                            onClick={() => updateMutation.mutate({ id: kw.id, row: { ...keywordToRowState(kw), status: "untargeted" } })}
                            disabled={updateMutation.isPending}
                          >
                            Reset
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => startEdit(kw)}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => deleteMutation.mutate(kw.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )
            )}
          </TableBody>
        </Table>
      </div>
      </div>
      )}
    </div>
  );
}
