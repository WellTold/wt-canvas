import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MapPin, Plus, Sparkles, Trash2, Zap, ExternalLink } from "lucide-react";
import type { LocationTarget } from "@shared/schema";

const KINDS = ["city", "state", "neighborhood", "national_park", "trail", "race", "college", "lake", "region", "other"] as const;

const STATUS_STYLES: Record<string, string> = {
  untargeted: "bg-gray-100 text-gray-700",
  in_progress: "bg-amber-100 text-amber-800",
  published: "bg-green-100 text-green-800",
};

async function checked(res: Response): Promise<Response> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? res.statusText);
  }
  return res;
}

// One target per line: "Name, kind, region, search phrase" — only the name is required.
function parseLines(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, kind, region, keyword] = line.split(",").map((p) => p?.trim() ?? "");
      const normalizedKind = (kind || "city").toLowerCase().replace(/\s+/g, "_");
      return {
        name,
        kind: (KINDS as readonly string[]).includes(normalizedKind) ? normalizedKind : "other",
        region: region || null,
        keyword: keyword || null,
      };
    })
    .filter((t) => t.name);
}

export default function LocationTargets() {
  const { toast } = useToast();
  const [bulkText, setBulkText] = useState("");
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  const { data: targets = [], isLoading } = useQuery<LocationTarget[]>({ queryKey: ["/api/location-targets"] });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/location-targets"] });

  const addMutation = useMutation({
    mutationFn: async (rows: ReturnType<typeof parseLines>) =>
      (await checked(await apiRequest("POST", "/api/location-targets/bulk", { targets: rows }))).json(),
    onSuccess: (created: LocationTarget[]) => {
      setBulkText("");
      refresh();
      toast({ title: `${created.length} location target${created.length === 1 ? "" : "s"} added` });
    },
    onError: (err: Error) => toast({ title: "Couldn't add targets", description: err.message, variant: "destructive" }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => (await checked(await apiRequest("POST", "/api/location-targets/seed-from-catalog"))).json(),
    onSuccess: (result: { created: number }) => {
      refresh();
      toast({
        title: result.created > 0 ? `${result.created} places added from the product catalog` : "Catalog places are already in the list",
      });
    },
    onError: (err: Error) => toast({ title: "Couldn't seed from catalog", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => checked(await apiRequest("DELETE", `/api/location-targets/${id}`)),
    onSuccess: refresh,
    onError: (err: Error) => toast({ title: "Couldn't delete", description: err.message, variant: "destructive" }),
  });

  const generate = async (target: LocationTarget) => {
    setGeneratingId(target.id);
    try {
      const res = await checked(await apiRequest("POST", `/api/location-targets/${target.id}/generate`));
      const result = (await res.json()) as { id: string | number; title: string };
      refresh();
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      toast({ title: "Draft created", description: result.title });
    } catch (err) {
      toast({ title: "Generation failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGeneratingId(null);
    }
  };

  const parsed = parseLines(bulkText);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MapPin className="h-6 w-6" /> Location Targets
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Places Well Told can personalize for: hometowns, parks, races, campuses. Searches like "Acadia National Park
            gifts" are where the map, star and topo products are the actual answer, and they're far easier to rank for than
            "gifts for dad". Generating from a place creates a draft using the place-guide format.
          </p>
        </div>
        <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
          {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Add places from product catalog
        </Button>
      </div>

      <div className="border rounded-md p-4 space-y-3">
        <label className="text-sm font-medium" htmlFor="bulk-targets">
          Add places — one per line: <span className="font-mono text-xs">Name, kind, region, search phrase</span>
        </label>
        <Textarea
          id="bulk-targets"
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"Boston, city, Massachusetts\nAppalachian Trail, trail\nUniversity of Michigan, college, Michigan, university of michigan gifts"}
          className="font-mono text-sm min-h-[96px]"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Kinds: {KINDS.join(", ")}. Search phrase defaults to "[name] gifts".
          </p>
          <Button onClick={() => addMutation.mutate(parsed)} disabled={parsed.length === 0 || addMutation.isPending}>
            {addMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Add {parsed.length > 0 ? parsed.length : ""}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : targets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No location targets yet. Add some above, or start from the product catalog.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Place</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Search phrase</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  {t.name}
                  {t.region && <span className="text-muted-foreground font-normal">, {t.region}</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.kind.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-sm">{t.keyword || `${t.name.toLowerCase()} gifts`}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[t.status] ?? ""}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {t.contentItemId ? (
                    <Button asChild variant="ghost" size="sm">
                      <a href={`/content-editor/${t.contentItemId}`}>
                        <ExternalLink className="h-4 w-4 mr-1" /> Open draft
                      </a>
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => generate(t)} disabled={generatingId !== null}>
                      {generatingId === t.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                      Generate
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${t.name}`}
                    onClick={() => deleteMutation.mutate(t.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
