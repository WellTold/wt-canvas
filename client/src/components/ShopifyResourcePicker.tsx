import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "wouter";

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  price: string;
  currencyCode: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
}

interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  description?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
}

interface ShopifyPage {
  id: string;
  title: string;
  handle: string;
  bodySummary: string;
  url: string;
}

interface ShopifyImage {
  id: string;
  url: string;
  altText: string | null;
  mimeType: string;
}

type PickerTab = "products" | "collections" | "pages" | "images";

export type ShopifyResource =
  | { type: "product"; id: string; title: string; handle: string; imageUrl?: string | null; price?: string; currencyCode?: string }
  | { type: "collection"; id: string; title: string; handle: string; imageUrl?: string | null }
  | { type: "page"; id: string; title: string; handle: string; bodySummary?: string; url?: string }
  | { type: "image"; id: string; url: string; altText?: string | null };

interface ShopifyResourcePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (resource: ShopifyResource) => void;
  allowedTabs?: PickerTab[];
  title?: string;
}

function fmtPrice(amount: string, code: string): string {
  const n = parseFloat(amount || "0");
  const sym = code === "GBP" ? "£" : code === "EUR" ? "€" : "$";
  return `${sym}${n.toFixed(2)}`;
}

interface PagedResult<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor: string | null;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function shopifyTitleQuery(term: string): string {
  return `title:*${term}*`;
}

function ProductsTab({ onSelect }: { onSelect: (r: ShopifyResource) => void }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [extraItems, setExtraItems] = useState<ShopifyProduct[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const prevSearch = useRef(debouncedSearch);

  const shopifyQ = debouncedSearch.trim() ? shopifyTitleQuery(debouncedSearch.trim()) : "";
  const qs = shopifyQ ? `?q=${encodeURIComponent(shopifyQ)}` : "";
  const { data, isLoading, isError, error } = useQuery<PagedResult<ShopifyProduct>>({
    queryKey: ["/api/shopify/products", debouncedSearch],
    queryFn: () => apiRequest("GET", `/api/shopify/products${qs}`).then((r) => r.json()),
    staleTime: 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (prevSearch.current !== debouncedSearch) {
      setExtraItems([]);
      setCursor(null);
      setHasMore(false);
      setLoadMoreError(null);
      prevSearch.current = debouncedSearch;
    } else if (data) {
      setHasMore(data.hasNextPage);
      setCursor(data.endCursor ?? null);
    }
  }, [data, debouncedSearch]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const q = shopifyQ ? `&q=${encodeURIComponent(shopifyQ)}` : "";
      const res = await apiRequest("GET", `/api/shopify/products?after=${encodeURIComponent(cursor)}${q}`);
      const json: PagedResult<ShopifyProduct> = await res.json();
      setExtraItems((prev) => [...prev, ...json.items]);
      setHasMore(json.hasNextPage);
      setCursor(json.endCursor ?? null);
    } catch (err) {
      setLoadMoreError((err as Error).message || "Failed to load more products");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, shopifyQ, loadingMore]);

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading products…</p>;
  if (isError) return <p className="text-sm text-red-500 p-4">Failed to load products: {(error as Error)?.message || "unknown error"}.</p>;

  const allItems = [...(data?.items ?? []), ...extraItems];
  const total = allItems.length;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 text-sm"
          placeholder="Search all products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {allItems.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect({ type: "product", id: p.id, title: p.title, handle: p.handle, imageUrl: p.imageUrl, price: p.price, currencyCode: p.currencyCode })}
            className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50 text-left transition-colors"
          >
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.imageAlt || p.title} className="w-10 h-10 object-cover rounded border flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 bg-muted rounded border flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground">?</div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground">{fmtPrice(p.price, p.currencyCode)}</p>
            </div>
          </button>
        ))}
        {allItems.length === 0 && <p className="col-span-2 text-sm text-muted-foreground text-center py-4">No products found.</p>}
      </div>
      {total > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {total} result{total !== 1 ? "s" : ""}{hasMore ? " — load more or refine your search" : ""}
        </p>
      )}
      {hasMore && (
        <Button variant="outline" size="sm" className="w-full" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
          Load more
        </Button>
      )}
      {loadMoreError && <p className="text-xs text-red-500 text-center">{loadMoreError}</p>}
    </div>
  );
}

function CollectionsTab({ onSelect }: { onSelect: (r: ShopifyResource) => void }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [extraItems, setExtraItems] = useState<ShopifyCollection[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const prevSearch = useRef(debouncedSearch);

  const shopifyQ = debouncedSearch.trim() ? shopifyTitleQuery(debouncedSearch.trim()) : "";
  const qs = shopifyQ ? `?q=${encodeURIComponent(shopifyQ)}` : "";
  const { data, isLoading, isError, error } = useQuery<PagedResult<ShopifyCollection>>({
    queryKey: ["/api/shopify/collections", debouncedSearch],
    queryFn: () => apiRequest("GET", `/api/shopify/collections${qs}`).then((r) => r.json()),
    staleTime: 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (prevSearch.current !== debouncedSearch) {
      setExtraItems([]);
      setCursor(null);
      setHasMore(false);
      setLoadMoreError(null);
      prevSearch.current = debouncedSearch;
    } else if (data) {
      setHasMore(data.hasNextPage);
      setCursor(data.endCursor ?? null);
    }
  }, [data, debouncedSearch]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const q = shopifyQ ? `&q=${encodeURIComponent(shopifyQ)}` : "";
      const res = await apiRequest("GET", `/api/shopify/collections?after=${encodeURIComponent(cursor)}${q}`);
      const json: PagedResult<ShopifyCollection> = await res.json();
      setExtraItems((prev) => [...prev, ...json.items]);
      setHasMore(json.hasNextPage);
      setCursor(json.endCursor ?? null);
    } catch (err) {
      setLoadMoreError((err as Error).message || "Failed to load more collections");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, shopifyQ, loadingMore]);

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading collections…</p>;
  if (isError) return <p className="text-sm text-red-500 p-4">Failed to load collections: {(error as Error)?.message || "unknown error"}.</p>;

  const allItems = [...(data?.items ?? []), ...extraItems];
  const total = allItems.length;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 text-sm"
          placeholder="Search all collections…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {allItems.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect({ type: "collection", id: c.id, title: c.title, handle: c.handle, imageUrl: c.imageUrl })}
            className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50 text-left transition-colors"
          >
            {c.imageUrl ? (
              <img src={c.imageUrl} alt={c.imageAlt || c.title} className="w-10 h-10 object-cover rounded border flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 bg-muted rounded border flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground">?</div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{c.title}</p>
            </div>
          </button>
        ))}
        {allItems.length === 0 && <p className="col-span-2 text-sm text-muted-foreground text-center py-4">No collections found.</p>}
      </div>
      {total > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {total} result{total !== 1 ? "s" : ""}{hasMore ? " — load more or refine your search" : ""}
        </p>
      )}
      {hasMore && (
        <Button variant="outline" size="sm" className="w-full" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
          Load more
        </Button>
      )}
      {loadMoreError && <p className="text-xs text-red-500 text-center">{loadMoreError}</p>}
    </div>
  );
}

function PagesTab({ onSelect }: { onSelect: (r: ShopifyResource) => void }) {
  const [search, setSearch] = useState("");
  const { data: pages = [], isLoading, isError, error } = useQuery<ShopifyPage[]>({
    queryKey: ["/api/shopify/pages"],
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const filtered = pages.filter((p) =>
    !search.trim() || p.title.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading pages…</p>;
  if (isError) return <p className="text-sm text-red-500 p-4">Failed to load pages: {(error as Error)?.message || "unknown error"}.</p>;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 text-sm"
          placeholder="Search pages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect({ type: "page", id: p.id, title: p.title, handle: p.handle, bodySummary: p.bodySummary, url: p.url })}
            className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 text-left transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{p.title}</p>
              {p.bodySummary && <p className="text-xs text-muted-foreground truncate">{p.bodySummary}</p>}
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-2" />
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No pages found.</p>}
      </div>
    </div>
  );
}

function ImagesTab({ onSelect }: { onSelect: (r: ShopifyResource) => void }) {
  const [search, setSearch] = useState("");
  const { data: images = [], isLoading, isError, error } = useQuery<ShopifyImage[]>({
    queryKey: ["/api/shopify/images"],
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const filtered = images.filter((img) =>
    !search.trim() || (img.altText || "").toLowerCase().includes(search.toLowerCase()) || img.url.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading images…</p>;
  if (isError) return <p className="text-sm text-red-500 p-4">Failed to load images: {(error as Error)?.message || "unknown error"}.</p>;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 text-sm"
          placeholder="Search by alt text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
        {filtered.map((img) => (
          <button
            key={img.id}
            onClick={() => onSelect({ type: "image", id: img.id, url: img.url, altText: img.altText })}
            className="relative group border rounded overflow-hidden hover:ring-2 hover:ring-primary transition-all"
          >
            <img src={img.url} alt={img.altText || ""} className="w-full h-16 object-cover" />
            {img.altText && (
              <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {img.altText}
              </div>
            )}
          </button>
        ))}
        {filtered.length === 0 && <p className="col-span-3 text-sm text-muted-foreground text-center py-4">No images found.</p>}
      </div>
    </div>
  );
}

export function ShopifyResourcePicker({ isOpen, onClose, onSelect, allowedTabs, title = "Browse Shopify" }: ShopifyResourcePickerProps) {
  const { data: statusData } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/integrations/shopify-status"],
    staleTime: 60 * 1000,
    enabled: isOpen,
  });
  const shopifyConfigured = statusData?.configured === true;

  const tabs: PickerTab[] = allowedTabs ?? ["products", "collections", "pages", "images"];

  const handleSelect = (resource: ShopifyResource) => {
    onSelect(resource);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {!shopifyConfigured ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No Shopify integration is configured.</p>
            <Link href="/integrations">
              <Button variant="outline" size="sm" onClick={onClose}>
                Connect Shopify
              </Button>
            </Link>
          </div>
        ) : (
          <Tabs defaultValue={tabs[0]}>
            <TabsList className="w-full">
              {tabs.includes("products") && <TabsTrigger value="products" className="flex-1">Products</TabsTrigger>}
              {tabs.includes("collections") && <TabsTrigger value="collections" className="flex-1">Collections</TabsTrigger>}
              {tabs.includes("pages") && <TabsTrigger value="pages" className="flex-1">Pages</TabsTrigger>}
              {tabs.includes("images") && <TabsTrigger value="images" className="flex-1">Images</TabsTrigger>}
            </TabsList>
            {tabs.includes("products") && (
              <TabsContent value="products">
                <ProductsTab onSelect={handleSelect} />
              </TabsContent>
            )}
            {tabs.includes("collections") && (
              <TabsContent value="collections">
                <CollectionsTab onSelect={handleSelect} />
              </TabsContent>
            )}
            {tabs.includes("pages") && (
              <TabsContent value="pages">
                <PagesTab onSelect={handleSelect} />
              </TabsContent>
            )}
            {tabs.includes("images") && (
              <TabsContent value="images">
                <ImagesTab onSelect={handleSelect} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
