import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Swatch {
  color?: string;
  label: string;
  folder?: string;
  color_hex?: string;
  image?: string;
}

interface Product {
  id: string;
  name: string;
  folder: string;
  color_hex?: string;
  swatches?: Swatch[];
}

const PRODUCTS: Product[] = [
  { id: "rocks",            name: "Home Town Map Rocks Glass",                    folder: "Rocks" },
  { id: "pint",             name: "Home Town Map Pint Glass",                     folder: "Pint" },
  { id: "stemless-wine",    name: "Home Town Map Stemless Wine Glass",            folder: "Stemless-Wine" },
  { id: "stemmed-wine",     name: "Home Town Map Stemmed Wine Glass",             folder: "Stemmed-Wine" },
  { id: "can-glass",        name: "Home Town Map Can Glass",                      folder: "Can-Glass" },
  { id: "mason-jar",        name: "Home Town Map Mason Jar",                      folder: "Mason-Jar" },
  { id: "coffee-mug",       name: "Home Town Map Glass Coffee Mug",               folder: "Coffee-Mug" },
  {
    id: "ceramic-mug",
    name: "Home Town Map Ceramic Coffee Mug",
    folder: "Printed-Mug-15oz",
    color_hex: "#666666",
    swatches: [
      { color: "#666666", label: "Gray",  color_hex: "#666666" },
      { color: "#0e494c", label: "Teal",  color_hex: "#0e494c" },
      { color: "#1e2a58", label: "Blue",  color_hex: "#1e2a58" },
      { color: "#3f1032", label: "Plum",  color_hex: "#3f1032" },
    ],
  },
  {
    id: "white-tumbler-12oz",
    name: "Home Town Map Insulated Wine Tumbler 12oz",
    folder: "White-Tumbler-12oz",
    swatches: [
      { color: "#ffffff", label: "White",         folder: "White-Tumbler-12oz" },
      { color: "#000000", label: "Black",         folder: "Black-Tumbler-12oz" },
      { color: "#01205B", label: "Midnight Blue", folder: "Midnight-Blue-Tumbler-12oz" },
      { color: "#999999", label: "Dockside Gray", folder: "Dockside-Gray-Tumbler-12oz" },
      { color: "#FFFC06", label: "Sunrise Yellow",folder: "Sunrise-Yellow-Tumbler-12oz" },
      { color: "#47D698", label: "Sunday Green",  folder: "Sunday-Green-Tumbler-12oz" },
      { color: "#CF578B", label: "Sunset Pink",   folder: "Sunset-Pink-Tumbler-12oz" },
    ],
  },
  {
    id: "white-tumbler-16oz",
    name: "Home Town Map Insulated Coffee Tumbler 16oz",
    folder: "White-Coffee-Tumbler-16oz",
    swatches: [
      { color: "#ffffff", label: "White",         folder: "White-Coffee-Tumbler-16oz" },
      { color: "#47D698", label: "Sunday Green",  folder: "Sunday-Green-Coffee-Tumbler-16oz" },
      { color: "#000000", label: "Black",         folder: "Black-Coffee-Tumbler-16oz" },
      { color: "#999999", label: "Dockside Gray", folder: "Dockside-Gray-Coffee-Tumbler-16oz" },
    ],
  },
  {
    id: "white-tumbler-20oz",
    name: "Home Town Map Insulated Tumbler 20oz",
    folder: "White-Tumbler-20oz",
    swatches: [
      { color: "#ffffff", label: "White",         folder: "White-Tumbler-20oz" },
      { color: "#01205B", label: "Midnight Blue", folder: "Midnight-Blue-Tumbler-20oz" },
      { color: "#000000", label: "Black",         folder: "Black-Tumbler-20oz" },
      { color: "#999999", label: "Dockside Gray", folder: "Dockside-Gray-Tumbler-20oz" },
    ],
  },
  {
    id: "white-bottle-21oz",
    name: "Home Town Map Insulated Bottle 21oz",
    folder: "White-Bottle-21oz",
    swatches: [
      { color: "#ffffff", label: "White",         folder: "White-Bottle-21oz" },
      { color: "#000000", label: "Black",         folder: "Black-Bottle-21oz" },
      { color: "#01205B", label: "Midnight Blue", folder: "Midnight-Blue-Bottle-21oz" },
      { color: "#999999", label: "Dockside Gray", folder: "Dockside-Gray-Bottle-21oz" },
      { color: "#47D698", label: "Sunday Green",  folder: "Sunday-Green-Bottle-21oz" },
      { color: "#CF578B", label: "Sunset Pink",   folder: "Sunset-Pink-Bottle-21oz" },
    ],
  },
  { id: "radius-board",   name: "Home Town Map Radius Board",         folder: "Radius-Board" },
  { id: "essential-board",name: "Home Town Map Essential Board",       folder: "Essential-Board" },
  { id: "modern-tray",    name: "Hometown Map Modern Tray",            folder: "Tray-9x5-5" },
  { id: "handle-board",   name: "Hometown Map Handle Board",           folder: "Handle-Board" },
  { id: "host-server",    name: "Hometown Map Cherry Host Server",     folder: "Host-Server" },
  { id: "coaster",        name: "Home Town Map Cork Coaster 4in",      folder: "Cork-Round-Coaster-4in" },
  {
    id: "flask",
    name: "Home Town Map Pocket Flask",
    folder: "Matte-Black-Flask",
    swatches: [
      { color: "#ffffff", label: "White", folder: "Matte-White-Flask" },
      { color: "#1a1a1a", label: "Black", folder: "Matte-Black-Flask" },
    ],
  },
  {
    id: "ornament",
    name: "Home Town Map Ornament",
    folder: "Black-Silver-Ornament-3-75in",
    swatches: [
      { image: "https://welltolddesign.com/cdn/shop/t/87/assets/rustic-brown-gold_50x.png?v=8273587647294364701697636772", label: "Rustic Brown & Gold", folder: "Rustic-Brown-Gold-Ornament-3-75in" },
      { image: "https://welltolddesign.com/cdn/shop/t/87/assets/black-silver_50x.png?v=107865746675365322791697638012",   label: "Black & Silver",       folder: "Black-Silver-Ornament-3-75in" },
      { image: "https://welltolddesign.com/cdn/shop/t/87/assets/brown-black_50x.png?v=150914186938840480871697638029",    label: "Brown & Black",        folder: "Brown-Black-Ornament-3-75in" },
      { image: "https://welltolddesign.com/cdn/shop/t/87/assets/gray-black_50x.png?v=154765627514705511141697638039",     label: "Gray & Black",         folder: "Gray-Black-Ornament-3-75in" },
    ],
  },
  {
    id: "candle",
    name: "Home Town Map Candle 7.5oz",
    folder: "Amber-Black-Candle-2x7-7-5oz",
    swatches: [
      { color: "#FFFFFF", label: "Clear Gold", folder: "Clear-Gold-Candle-2x7-7-5oz" },
      { color: "#C87941", label: "Amber",      folder: "Amber-Black-Candle-2x7-7-5oz" },
    ],
  },
];

const BASE_URL = "https://welltold.s3.us-east-1.amazonaws.com";
const NASHVILLE_SLUG = "nashville_tn_united-states";

function buildSlug(city: string): string {
  const parts = city.split(",").map((s) => s.trim());
  const [cityPart = "", statePart = "", countryPart = ""] = parts;
  // Normalize each segment: lowercase, strip non-alphanumeric except spaces/hyphens, then collapse to underscores
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")  // strip punctuation/special chars
      .trim()
      .replace(/[\s-]+/g, "_");       // spaces and hyphens → underscore
  // Country words separated by hyphens per spec
  const normalizeCountry = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")   // strip punctuation
      .trim()
      .replace(/\s+/g, "-");          // spaces → hyphen
  const citySlug = normalize(cityPart);
  const stateSlug = normalize(statePart);
  const countrySlug = normalizeCountry(countryPart);
  return [citySlug, stateSlug, countrySlug].filter(Boolean).join("_");
}

async function tryImageUrl(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

async function resolveProductImage(folder: string, slug: string, colorHex?: string): Promise<{ url: string | null; isFallback: boolean }> {
  const suffix = colorHex ? `_${colorHex.replace("#", "")}` : "";
  const candidates = [
    `${BASE_URL}/photography-new/Hometown/Curated/${folder}/${slug}_0${suffix}.jpg`,
    `${BASE_URL}/photography-new/Hometown/Curated/${folder}/${slug}_90${suffix}.jpg`,
    `${BASE_URL}/photography-new/Hometown/Curated/${folder}/${slug}_180${suffix}.jpg`,
    `${BASE_URL}/photography-new/Hometown/Curated/${folder}/${slug}_270${suffix}.jpg`,
    `${BASE_URL}/photography/Hometown/${folder}/${slug}_1${suffix}.jpg`,
    `${BASE_URL}/photography/Hometown/${folder}/${slug}_2${suffix}.jpg`,
    `${BASE_URL}/photography/Hometown/${folder}/${slug}_3${suffix}.jpg`,
  ];

  for (const url of candidates) {
    if (await tryImageUrl(url)) return { url, isFallback: false };
  }

  // Try Nashville as geographic fallback
  if (slug !== NASHVILLE_SLUG) {
    const fallbackResult = await resolveProductImage(folder, NASHVILLE_SLUG, colorHex);
    if (fallbackResult.url) return { url: fallbackResult.url, isFallback: true };
  }

  // No image found for this product/location combination
  return { url: null, isFallback: true };
}

interface WTProductRenderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
}

export function WTProductRenderPicker({ isOpen, onClose, onConfirm }: WTProductRenderPickerProps) {
  const [cityInput, setCityInput] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>(PRODUCTS[0].id);
  const [selectedSwatch, setSelectedSwatch] = useState<Swatch | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const selectedProduct = PRODUCTS.find((p) => p.id === selectedProductId) ?? PRODUCTS[0];

  useEffect(() => {
    setSelectedSwatch(null);
    setResolvedUrl(null);
    setNotFound(false);
  }, [selectedProductId]);

  const activeFolder = selectedSwatch?.folder ?? selectedProduct.folder;
  const activeColorHex = selectedSwatch?.color_hex ?? selectedProduct.color_hex;

  const handleResolve = async () => {
    const slug = cityInput.trim() ? buildSlug(cityInput) : NASHVILLE_SLUG;
    setIsResolving(true);
    setResolvedUrl(null);
    setNotFound(false);
    const result = await resolveProductImage(activeFolder, slug, activeColorHex);
    if (result.url) {
      setResolvedUrl(result.url);
      setIsFallback(result.isFallback || !cityInput.trim());
    } else {
      setNotFound(true);
    }
    setIsResolving(false);
  };

  const handleConfirm = () => {
    if (resolvedUrl) {
      onConfirm(resolvedUrl);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AWS Product Render Picker</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Location (City, State, Country)</Label>
            <Input
              placeholder='e.g. Nashville, TN, United States'
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              className="mt-1"
            />
            {cityInput.trim() && (
              <p className="text-xs text-muted-foreground mt-1">
                Slug: <code>{buildSlug(cityInput)}</code>
              </p>
            )}
          </div>

          <div>
            <Label>Product</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCTS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct.swatches && selectedProduct.swatches.length > 0 && (
            <div>
              <Label>Color / Variant</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedProduct.swatches.map((swatch) => {
                  const isActive = selectedSwatch?.label === swatch.label;
                  return (
                    <button
                      key={swatch.label}
                      onClick={() => setSelectedSwatch(isActive ? null : swatch)}
                      className={`flex items-center gap-1.5 px-2 py-1 border text-xs transition-colors ${
                        isActive ? "border-black bg-black text-white" : "border-gray-300 hover:border-black"
                      }`}
                      title={swatch.label}
                    >
                      {swatch.image ? (
                        <img src={swatch.image} alt={swatch.label} className="w-5 h-5 object-cover" />
                      ) : swatch.color ? (
                        <span
                          className="w-4 h-4 inline-block border border-gray-300"
                          style={{ backgroundColor: swatch.color }}
                        />
                      ) : null}
                      {swatch.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Button onClick={handleResolve} disabled={isResolving} className="w-full">
            {isResolving ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              "Preview Image"
            )}
          </Button>

          {notFound && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">
              No product render found for this location or its Nashville fallback. Try a different city or product.
            </div>
          )}

          {resolvedUrl && (
            <div className="space-y-2">
              {isFallback && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2">
                  Sample Image - using Nashville as fallback
                </div>
              )}
              <div className="border border-black overflow-hidden aspect-square bg-[#f0ebe7]">
                <img
                  src={resolvedUrl}
                  alt="Product render"
                  className="w-full h-full object-contain"
                  onError={() => { setResolvedUrl(null); setNotFound(true); }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={!resolvedUrl}>
              Use This Image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
