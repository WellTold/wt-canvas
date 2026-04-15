import { useState, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Type, X, ChevronDown } from "lucide-react";

// ─── Font catalogue ──────────────────────────────────────────────────────────

export type FontSource = "brand" | "google" | "websafe";

export interface FontOption {
  name: string;
  css: string;
  source: FontSource;
}

export const BRAND_FONTS: FontOption[] = [
  { name: "Cera Pro",   css: '"Cera Pro", sans-serif',   source: "brand" },
  { name: "Cera Basic", css: '"Cera Basic", sans-serif', source: "brand" },
];

export const WEBSAFE_FONTS: FontOption[] = [
  { name: "Arial",            css: "Arial, sans-serif",                    source: "websafe" },
  { name: "Georgia",          css: "Georgia, serif",                       source: "websafe" },
  { name: "Times New Roman",  css: '"Times New Roman", serif',             source: "websafe" },
  { name: "Helvetica",        css: "Helvetica, Arial, sans-serif",         source: "websafe" },
  { name: "Courier New",      css: '"Courier New", monospace',             source: "websafe" },
  { name: "Trebuchet MS",     css: '"Trebuchet MS", sans-serif',           source: "websafe" },
  { name: "Verdana",          css: "Verdana, sans-serif",                  source: "websafe" },
];

export const GOOGLE_FONTS: FontOption[] = [
  { name: "Barlow",                css: "Barlow, sans-serif",                          source: "google" },
  { name: "Bricolage Grotesque",   css: '"Bricolage Grotesque", sans-serif',            source: "google" },
  { name: "Cabin",                 css: "Cabin, sans-serif",                           source: "google" },
  { name: "Cormorant Garamond",    css: '"Cormorant Garamond", serif',                  source: "google" },
  { name: "Crimson Text",          css: '"Crimson Text", serif',                        source: "google" },
  { name: "DM Sans",               css: '"DM Sans", sans-serif',                        source: "google" },
  { name: "EB Garamond",           css: '"EB Garamond", serif',                         source: "google" },
  { name: "Exo 2",                 css: '"Exo 2", sans-serif',                          source: "google" },
  { name: "Figtree",               css: "Figtree, sans-serif",                          source: "google" },
  { name: "Inter",                 css: "Inter, sans-serif",                            source: "google" },
  { name: "Josefin Sans",          css: '"Josefin Sans", sans-serif',                   source: "google" },
  { name: "Jost",                  css: "Jost, sans-serif",                             source: "google" },
  { name: "Karla",                 css: "Karla, sans-serif",                            source: "google" },
  { name: "Lato",                  css: "Lato, sans-serif",                             source: "google" },
  { name: "Libre Baskerville",     css: '"Libre Baskerville", serif',                   source: "google" },
  { name: "Manrope",               css: "Manrope, sans-serif",                          source: "google" },
  { name: "Merriweather",          css: "Merriweather, serif",                          source: "google" },
  { name: "Montserrat",            css: "Montserrat, sans-serif",                       source: "google" },
  { name: "Mulish",                css: "Mulish, sans-serif",                           source: "google" },
  { name: "Noto Sans",             css: '"Noto Sans", sans-serif',                      source: "google" },
  { name: "Nunito",                css: "Nunito, sans-serif",                           source: "google" },
  { name: "Open Sans",             css: '"Open Sans", sans-serif',                      source: "google" },
  { name: "Oswald",                css: "Oswald, sans-serif",                           source: "google" },
  { name: "Playfair Display",      css: '"Playfair Display", serif',                    source: "google" },
  { name: "Plus Jakarta Sans",     css: '"Plus Jakarta Sans", sans-serif',              source: "google" },
  { name: "Poppins",               css: "Poppins, sans-serif",                          source: "google" },
  { name: "PT Sans",               css: '"PT Sans", sans-serif',                        source: "google" },
  { name: "Quicksand",             css: "Quicksand, sans-serif",                        source: "google" },
  { name: "Raleway",               css: "Raleway, sans-serif",                          source: "google" },
  { name: "Roboto",                css: "Roboto, sans-serif",                           source: "google" },
  { name: "Source Sans Pro",       css: '"Source Sans Pro", sans-serif',                source: "google" },
  { name: "Space Grotesk",         css: '"Space Grotesk", sans-serif',                  source: "google" },
  { name: "Tenor Sans",            css: '"Tenor Sans", sans-serif',                     source: "google" },
  { name: "Ubuntu",                css: "Ubuntu, sans-serif",                           source: "google" },
  { name: "Work Sans",             css: '"Work Sans", sans-serif',                      source: "google" },
];

export const ALL_FONTS: FontOption[] = [...BRAND_FONTS, ...WEBSAFE_FONTS, ...GOOGLE_FONTS];

// ─── Google Font loader (client-side preview only) ───────────────────────────

const loadedFonts = new Set<string>();

function loadGoogleFont(name: string): void {
  if (loadedFonts.has(name)) return;
  loadedFonts.add(name);
  const id = `gf-${name.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

// ─── FontPicker component ────────────────────────────────────────────────────

interface Props {
  value?: string;
  onChange: (css: string | undefined) => void;
  className?: string;
}

function sourceLabel(source: FontSource): string {
  if (source === "brand") return "Brand";
  if (source === "google") return "GF";
  return "Web";
}

function sourceLabelClass(source: FontSource): string {
  if (source === "brand") return "bg-amber-100 text-amber-700";
  if (source === "google") return "bg-blue-100 text-blue-600";
  return "bg-gray-100 text-gray-500";
}

/** Resolve a CSS font-family string to the matched FontOption, if any. */
function findByCSS(css: string): FontOption | undefined {
  return ALL_FONTS.find((f) => f.css === css);
}

/** Display label for the trigger button. */
function triggerLabel(css: string | undefined): string {
  if (!css) return "Default font";
  return findByCSS(css)?.name ?? css;
}

export function FontPicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Load any Google Font that is already selected (on mount or value change)
  useEffect(() => {
    if (!value) return;
    const match = findByCSS(value);
    if (match?.source === "google") loadGoogleFont(match.name);
  }, [value]);

  const handleSelect = useCallback((font: FontOption) => {
    if (font.source === "google") loadGoogleFont(font.name);
    onChange(font.css);
    setOpen(false);
    setSearch("");
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  }, [onChange]);

  // Filter fonts by search query
  const q = search.toLowerCase().trim();
  const visible = q
    ? ALL_FONTS.filter((f) => f.name.toLowerCase().includes(q))
    : ALL_FONTS;

  const groups: { label: string; fonts: FontOption[] }[] = q
    ? [{ label: "Results", fonts: visible }]
    : [
        { label: "Brand",     fonts: BRAND_FONTS   },
        { label: "Web-safe",  fonts: WEBSAFE_FONTS },
        { label: "Google Fonts", fonts: GOOGLE_FONTS },
      ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 h-7 px-2 border border-gray-300 bg-white text-xs text-left w-full min-w-0 hover:bg-gray-50 transition-colors",
            className
          )}
        >
          <Type className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span
            className="flex-1 truncate"
            style={{ fontFamily: value || undefined }}
          >
            {triggerLabel(value)}
          </span>
          {value ? (
            <X
              className="h-3 w-3 text-gray-400 shrink-0 hover:text-gray-700"
              onClick={handleClear}
            />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        className="w-64 p-0 shadow-lg border border-gray-200"
        style={{ borderRadius: 0 }}
      >
        {/* Search */}
        <div className="p-2 border-b border-gray-200">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fonts…"
            className="h-7 text-xs"
          />
        </div>

        {/* Font list */}
        <div className="max-h-72 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide sticky top-0 bg-white z-10">
                {group.label}
              </p>
              {group.fonts.map((font) => {
                const isSelected = value === font.css;
                return (
                  <button
                    key={font.css}
                    type="button"
                    onClick={() => handleSelect(font)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 transition-colors",
                      isSelected && "bg-gray-100 font-semibold"
                    )}
                    style={{ fontFamily: font.source !== "brand" ? font.css : undefined }}
                  >
                    <span className="truncate">{font.name}</span>
                    <span
                      className={cn(
                        "text-[9px] font-bold px-1 py-0.5 shrink-0",
                        sourceLabelClass(font.source)
                      )}
                    >
                      {sourceLabel(font.source)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

          {visible.length === 0 && (
            <div className="px-3 py-4 text-xs text-gray-400 text-center">
              No fonts match "{search}"
            </div>
          )}
        </div>

        {/* Custom font entry */}
        <div className="p-2 border-t border-gray-200">
          <p className="text-[10px] text-gray-400 mb-1">Custom CSS font-family</p>
          <Input
            placeholder='"My Font", sans-serif'
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = e.currentTarget.value.trim();
                if (v) { onChange(v); setOpen(false); }
              }
            }}
          />
          <p className="text-[10px] text-gray-400 mt-1">Press Enter to apply</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
