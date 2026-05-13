// Runs in Node.js (Replit server). Imports component registry for app_block resolution.
import { findComponent } from "../config/componentRegistry";
import { SNIPPET_MAP } from "../config/snippets";
import { markdownToHtml } from "../utils/markdown";

export interface ContentBlock {
  id: string;
  type: string;
  order: number;
  content: Record<string, any>;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  status: string;
  meta_description?: string | null;
  content_json?: any;
  content_markdown?: string | null;
  featured_image?: string | null;
  og_image?: string | null;
  og_title?: string | null;
  canonical_url?: string | null;
  page_template?: string | null;
  structured_data?: any;
  custom_css?: string | null;
  redirect_from?: string[] | null;
  published_at?: string | null;
  updated_at?: string;
}

// Typed payloads returned by ShopifyFetcher (matches server/services/shopify.ts output)
export interface ShopifyVariant {
  id: string;
  title: string;
  price?: string;
  available: boolean;
  options?: Array<{ name: string; value: string }>;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description?: string | null;
  price: string;
  currencyCode: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  variants: ShopifyVariant[];
}

export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  products: Array<{
    id: string;
    title: string;
    handle: string;
    price: string;
    currencyCode: string;
    imageUrl?: string | null;
    imageAlt?: string | null;
  }>;
}

export type ShopifyFetcher = {
  fetchProduct: (id: string) => Promise<ShopifyProduct>;
  fetchCollection: (id: string, count?: number) => Promise<ShopifyCollection>;
} | null;

function escHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(str: string): string {
  if (!str) return "";
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// ── URL sanitization ─────────────────────────────────────────────────────────

function sanitizeUrl(url: string): string {
  if (!url) return "#";
  const lower = url.trim().toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:")) return "#";
  return url;
}

// ── Recursive block traversal (supports nested structures like two_column) ───

function collectAllBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = [];
  for (const block of blocks) {
    result.push(block);
    const c = block.content || {};
    for (const key of Object.keys(c)) {
      const val = c[key];
      if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0].type === "string") {
        result.push(...collectAllBlocks(val as ContentBlock[]));
      }
    }
  }
  return result;
}

// ── Shopify helpers ──────────────────────────────────────────────────────────

function gidNumericId(gid: string): string {
  const m = gid.match(/\/(\d+)$/);
  return m ? m[1] : gid;
}

function fmtPrice(amount: string, code: string): string {
  const n = parseFloat(amount || "0");
  const sym = code === "GBP" ? "£" : code === "EUR" ? "€" : "$";
  return `${sym}${n.toFixed(2)}`;
}

// ── Inline style helpers ──────────────────────────────────────────────────────

const FONT_SIZE_MAP: Record<string, string> = {
  sm: "12px", md: "14px", lg: "16px", xl: "20px",
  "2xl": "24px", "3xl": "32px", "4xl": "40px",
};

function buildTextStyle(c: Record<string, any>): string {
  const parts: string[] = ["word-wrap:break-word", "overflow-wrap:break-word"];
  if (c.backgroundColor) parts.push(`background-color:${escAttr(c.backgroundColor)}`);
  if (c.backgroundImageUrl) parts.push(`background-image:url('${escAttr(c.backgroundImageUrl)}')`);
  if (c.textColor) parts.push(`color:${escAttr(c.textColor)}`);
  if (c.fontFamily) parts.push(`font-family:${escAttr(c.fontFamily)}`);
  if (c.fontSize && FONT_SIZE_MAP[c.fontSize]) parts.push(`font-size:${FONT_SIZE_MAP[c.fontSize]}`);
  if (c.fontWeight) parts.push(`font-weight:${escAttr(c.fontWeight)}`);
  if (c.textAlign) parts.push(`text-align:${escAttr(c.textAlign)}`);
  if (c.fontStyle && c.fontStyle !== "normal") parts.push(`font-style:${escAttr(c.fontStyle)}`);
  if (c.textDecoration && c.textDecoration !== "none") parts.push(`text-decoration:${escAttr(c.textDecoration)}`);
  if (c.textTransform && c.textTransform !== "none") parts.push(`text-transform:${escAttr(c.textTransform)}`);
  if (c.opacity !== undefined && c.opacity !== 100) parts.push(`opacity:${Number(c.opacity) / 100}`);
  // Width constraint
  const cw = Number(c.customWidth) || 0;
  if (c.widthMode === "px" && cw > 0) { parts.push(`max-width:${cw}px`); parts.push("margin-left:auto"); parts.push("margin-right:auto"); }
  else if (c.widthMode === "percent" && cw > 0) { parts.push(`max-width:${cw}%`); parts.push("margin-left:auto"); parts.push("margin-right:auto"); }
  if (c.minHeight) {
    parts.push(`min-height:${escAttr(c.minHeight)}`);
    parts.push("display:flex");
    parts.push("flex-direction:column");
    parts.push("justify-content:center");
  }
  return ` style="${parts.join(";")}"`;
}

function buildCTAButtonStyle(c: Record<string, any>): string {
  const btnStyle = c.buttonStyle || "filled";
  const radii: Record<string, string> = { pill: "999px", rounded: "8px", sharp: "0px" };
  const borderRadius = radii[c.borderRadius || "rounded"] ?? "8px";
  const buttonColor = escAttr(c.buttonColor || "#f15822");
  const buttonTextColor = escAttr(c.buttonTextColor || "#ffffff");
  const padding = c.buttonSize === "sm" ? "8px 16px" : c.buttonSize === "lg" ? "16px 32px" : "12px 24px";
  const shadow = c.dropShadow ? "box-shadow:2px 4px 8px rgba(0,0,0,0.2);" : "";
  const base = `display:inline-block;padding:${padding};border-radius:${borderRadius};text-decoration:none;font-family:Arial,sans-serif;font-size:14px;${shadow}`;
  if (btnStyle === "outline") return `${base}background-color:transparent;color:${buttonColor};border:2px solid ${buttonColor};`;
  if (btnStyle === "ghost")   return `${base}background-color:transparent;color:${buttonColor};border:none;text-decoration:underline;`;
  return `${base}background-color:${buttonColor};color:${buttonTextColor};border:none;`;
}

export function renderBlock(block: ContentBlock, shopifyData: Map<string, ShopifyProduct | ShopifyCollection> = new Map()): string {
  const c = block.content || {};
  switch (block.type) {
    case "heading": {
      const level = c.level || 2;
      const tag = `h${Math.min(Math.max(Number(level), 1), 6)}`;
      return `<${tag} class="wt-heading wt-h${level}"${buildTextStyle(c)}>${escHtml(c.text || "")}</${tag}>`;
    }
    case "text":
    case "paragraph":
      return `<p class="wt-paragraph"${buildTextStyle(c)}>${escHtml(c.text || "")}</p>`;
    case "image": {
      const wm: string = c.widthMode || "full";
      const cw: number = Number(c.customWidth) || 0;
      let imgPx: number;
      if (wm === "px") imgPx = Math.min(cw || 552, 552);
      else if (wm === "percent") imgPx = Math.round(552 * (cw || 100) / 100);
      else imgPx = 0;
      const al: string = c.align || "center";
      const figStyle = wm !== "full"
        ? `style="text-align:${escAttr(al)};"`
        : "";
      const ch: number = Number(c.customHeight) || 0;
      const hCss = ch > 0 ? `height:${ch}px;object-fit:cover;` : "height:auto;";
      const imgStyle = wm !== "full"
        ? `style="width:${imgPx}px;max-width:100%;${hCss}" width="${imgPx}"`
        : `style="width:100%;max-width:100%;${hCss}"`;
      return `<figure class="wt-figure" ${figStyle}>
        <img src="${escAttr(c.url || c.src || "")}" alt="${escAttr(c.alt || "")}" loading="lazy" ${imgStyle} />
        ${c.caption ? `<figcaption class="wt-caption">${escHtml(c.caption)}</figcaption>` : ""}
      </figure>`;
    }
    case "quote":
      return `<blockquote class="wt-quote"${buildTextStyle(c)}>
        <p>${escHtml(c.text || "")}</p>
        ${c.author ? `<cite class="wt-cite">— ${escHtml(c.author)}</cite>` : ""}
      </blockquote>`;
    case "list": {
      const items: string[] = Array.isArray(c.items) ? c.items : [];
      const ordered = c.style === "numbered" || !!c.ordered;
      const tag = ordered ? "ol" : "ul";
      const listStyle = c.style === "check" ? ` class="wt-list wt-list--check"` : ` class="wt-list"`;
      return `<${tag}${listStyle}${buildTextStyle(c)}>${items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</${tag}>`;
    }
    case "cta": {
      const ctaLink = sanitizeUrl(c.link || c.url || "#");
      const containerStyle = buildTextStyle(c);
      const btnLabel = c.buttonText || c.text || "";
      const btnStyle = buildCTAButtonStyle(c);
      // bodyText sits above the button inside the same container
      const bodyHtml = c.bodyText ? `<p style="margin:0 0 16px 0;font-family:Arial,sans-serif;">${escHtml(c.bodyText)}</p>` : "";
      // Legacy: if style=link, render as plain link
      if (c.style === "link" && !c.buttonStyle) {
        return `<div class="wt-cta"${containerStyle}>${bodyHtml}<a href="${escAttr(ctaLink)}" class="wt-cta-link">${escHtml(btnLabel)}</a></div>`;
      }
      return `<div class="wt-cta"${containerStyle}>${bodyHtml}<a href="${escAttr(ctaLink)}" style="${btnStyle}">${escHtml(btnLabel)}</a></div>`;
    }
    case "divider": {
      const style = c.style || "line";
      if (style === "space") {
        const spacing = c.spacing || "medium";
        return `<div class="wt-divider-space wt-divider-space--${escAttr(spacing)}"></div>`;
      }
      return `<hr class="wt-divider" />`;
    }
    case "spacer":
      return `<div class="wt-spacer" style="height:${Number(c.height) || 40}px;" aria-hidden="true"></div>`;
    case "html_block":
      if (c.snippetName && SNIPPET_MAP[c.snippetName]) return SNIPPET_MAP[c.snippetName];
      return c.html || "";

    // ── Web-only blocks (Tier 2) ─────────────────────────────────────────────
    case "hero": {
      const img = c.imageUrl
        ? `<img src="${escAttr(c.imageUrl)}" alt="${escAttr(c.imageAlt || "")}" class="wt-hero-image" loading="lazy" />`
        : "";
      const cta = c.ctaText
        ? `<a href="${escAttr(c.ctaLink || "#")}" class="wt-hero-cta">${escHtml(c.ctaText)}</a>`
        : "";
      return `<section class="wt-hero">
        ${img}
        <div class="wt-hero-body">
          <h1 class="wt-hero-headline">${escHtml(c.headline || "")}</h1>
          ${c.subtext ? `<p class="wt-hero-subtext">${escHtml(c.subtext)}</p>` : ""}
          ${cta}
        </div>
      </section>`;
    }

    case "two_column": {
      const leftBlocks: ContentBlock[] = Array.isArray(c.leftBlocks)  ? c.leftBlocks  : [];
      const rightBlocks: ContentBlock[] = Array.isArray(c.rightBlocks) ? c.rightBlocks : [];
      const leftHtml  = leftBlocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(b => renderBlock(b, shopifyData)).join("\n");
      const rightHtml = rightBlocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(b => renderBlock(b, shopifyData)).join("\n");
      return `<div class="wt-two-col">
        <div class="wt-two-col-left">${leftHtml}</div>
        <div class="wt-two-col-right">${rightHtml}</div>
      </div>`;
    }

    case "accordion": {
      const items: Array<{ question: string; answer: string }> = Array.isArray(c.items) ? c.items : [];
      const rows = items.map((item) => `<details class="wt-accordion-item">
          <summary class="wt-accordion-question">${escHtml(item.question || "")}</summary>
          <div class="wt-accordion-answer">${escHtml(item.answer || "")}</div>
        </details>`).join("\n");
      return `<div class="wt-accordion">${rows}</div>`;
    }

    case "banner": {
      const style = ["info", "sale", "warning"].includes(c.style) ? c.style : "info";
      const link = c.link
        ? `<a href="${escAttr(c.link)}" class="wt-banner-link">${escHtml(c.linkText || "Learn more")}</a>`
        : "";
      return `<div class="wt-banner wt-banner--${escAttr(style)}"${buildTextStyle(c)}>
        <p class="wt-banner-text">${escHtml(c.text || "")}</p>
        ${link}
      </div>`;
    }

    case "icon_text_row": {
      const cols = c.columns === 4 ? 4 : 3;
      const items: Array<{ icon: string; headline: string; body: string }> = Array.isArray(c.items) ? c.items : [];
      const cards = items.map((item) => {
        const iconEl = item.icon
          ? `<div class="wt-icon-item-icon"><img src="${escAttr(item.icon)}" alt="" aria-hidden="true" /></div>`
          : "";
        return `<div class="wt-icon-item">
            ${iconEl}
            <h3 class="wt-icon-item-headline">${escHtml(item.headline || "")}</h3>
            <p class="wt-icon-item-body">${escHtml(item.body || "")}</p>
          </div>`;
      }).join("\n");
      return `<div class="wt-icon-row wt-icon-row--${cols}">${cards}</div>`;
    }

    case "author_bio": {
      const avatar = c.avatarUrl
        ? `<img src="${escAttr(c.avatarUrl)}" alt="${escAttr(c.name || "")}" class="wt-author-avatar" />`
        : "";
      const links: Array<{ label: string; url: string }> = Array.isArray(c.links) ? c.links : [];
      const linksHtml = links.length
        ? `<div class="wt-author-links">${links.map((l) => `<a href="${escAttr(l.url)}">${escHtml(l.label)}</a>`).join("")}</div>`
        : "";
      return `<div class="wt-author">
        ${avatar}
        <div class="wt-author-info">
          <p class="wt-author-name">${escHtml(c.name || "")}</p>
          <p class="wt-author-bio">${escHtml(c.bio || "")}</p>
          ${linksHtml}
        </div>
      </div>`;
    }

    case "breadcrumb": {
      const items: Array<{ label: string; url: string }> = Array.isArray(c.items) ? c.items : [];
      const listItems = items.flatMap((item, i) => {
        const li = `<li class="wt-breadcrumb-item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
            <a href="${escAttr(item.url)}" itemprop="item"><span itemprop="name">${escHtml(item.label)}</span></a>
            <meta itemprop="position" content="${i + 1}" />
          </li>`;
        return i < items.length - 1
          ? [li, `<li class="wt-breadcrumb-sep" aria-hidden="true">/</li>`]
          : [li];
      }).join("\n");
      const schema = safeJsonLd({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.label,
          item: item.url,
        })),
      });
      return `<nav class="wt-breadcrumb" aria-label="Breadcrumb">
        <ol class="wt-breadcrumb-list" itemscope itemtype="https://schema.org/BreadcrumbList">
          ${listItems}
        </ol>
      </nav>
      <script type="application/ld+json">${schema}</script>`;
    }

    case "related_content": {
      const items: Array<{ title: string; url: string; image?: string; contentType?: string }> = Array.isArray(c.items) ? c.items : [];
      const cards = items.map((item) => {
        const img = item.image
          ? `<img src="${escAttr(item.image)}" alt="${escAttr(item.title || "")}" class="wt-related-card-img" loading="lazy" />`
          : "";
        return `<a href="${escAttr(item.url)}" class="wt-related-card">
            ${img}
            <div class="wt-related-card-body">
              ${item.contentType ? `<p class="wt-related-card-type">${escHtml(item.contentType)}</p>` : ""}
              <p class="wt-related-card-title">${escHtml(item.title || "")}</p>
            </div>
          </a>`;
      }).join("\n");
      return `<div class="wt-related">
        <p class="wt-related-label">Related</p>
        <div class="wt-related-cards">${cards}</div>
      </div>`;
    }

    // ── Shopify blocks (Tier 4) ──────────────────────────────────────────────

    case "shopify_product_card": {
      const rawProduct = shopifyData.get(block.id);
      if (!rawProduct || !("variants" in rawProduct)) {
        return `<div class="wt-shopify-placeholder"><p>Shopify Product — ID: <code>${escHtml(c.productId || "")}</code></p></div>`;
      }
      const product = rawProduct;
      const link = sanitizeUrl(c.ctaLink || `/products/${product.handle}`);
      const imgHtml = product.imageUrl
        ? `<a href="${escAttr(link)}" class="wt-shopify-card-img-link" tabindex="-1" aria-hidden="true"><img src="${escAttr(product.imageUrl)}" alt="${escAttr(product.imageAlt || product.title)}" class="wt-shopify-card-img" loading="lazy" /></a>`
        : "";
      const descHtml = c.showDescription !== false && product.description
        ? `<p class="wt-shopify-card-desc">${escHtml(product.description)}</p>`
        : "";
      const priceHtml = c.showPrice !== false
        ? `<p class="wt-shopify-card-price">${escHtml(fmtPrice(product.price, product.currencyCode))}</p>`
        : "";
      return `<div class="wt-shopify-card">
        ${imgHtml}
        <div class="wt-shopify-card-body">
          <h3 class="wt-shopify-card-title">${escHtml(product.title)}</h3>
          ${descHtml}
          ${priceHtml}
          <a href="${escAttr(link)}" class="wt-shopify-card-cta wt-cta-button">${escHtml(c.ctaText || "Shop Now")}</a>
        </div>
      </div>`;
    }

    case "shopify_product_grid": {
      const rawCollection = shopifyData.get(block.id);
      if (!rawCollection || !("products" in rawCollection)) {
        return `<div class="wt-shopify-placeholder"><p>Shopify Collection — ID: <code>${escHtml(c.collectionId || "")}</code></p></div>`;
      }
      const collection = rawCollection;
      // Apply local sort based on sortOrder setting
      let products = [...collection.products];
      const sortOrder = c.sortOrder || "default";
      if (sortOrder === "price_asc") products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      else if (sortOrder === "price_desc") products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      else if (sortOrder === "title") products.sort((a, b) => a.title.localeCompare(b.title));
      const miniCards = products.map((p) => {
        const imgEl = p.imageUrl
          ? `<img src="${escAttr(p.imageUrl)}" alt="${escAttr(p.title)}" class="wt-shopify-mini-img" loading="lazy" />`
          : `<div class="wt-shopify-mini-img-placeholder"></div>`;
        return `<a href="/products/${escAttr(p.handle)}" class="wt-shopify-mini-card">
          ${imgEl}
          <div class="wt-shopify-mini-body">
            <p class="wt-shopify-mini-title">${escHtml(p.title)}</p>
            <p class="wt-shopify-mini-price">${escHtml(fmtPrice(p.price, p.currencyCode))}</p>
          </div>
        </a>`;
      }).join("\n");
      return `<div class="wt-shopify-grid">${miniCards}</div>`;
    }

    case "shopify_collection_feature": {
      const collection = shopifyData.get(block.id);
      const style = c.style === "dark" ? "dark" : "light";
      const imageUrl = c.imageUrl || collection?.imageUrl || "";
      const imageAlt = collection?.imageAlt || collection?.title || "";
      const headline = c.headline || collection?.title || "";
      const subtext = c.subtext || collection?.description || "";
      const ctaText = c.ctaText || "Shop the Collection";
      const ctaLink = sanitizeUrl(c.ctaLink || (collection?.handle ? `/collections/${collection.handle}` : "#"));
      const imgHtml = imageUrl
        ? `<div class="wt-shopify-feature-img-wrap"><img src="${escAttr(imageUrl)}" alt="${escAttr(imageAlt)}" class="wt-shopify-feature-img" loading="lazy" /></div>`
        : "";
      return `<section class="wt-shopify-feature wt-shopify-feature--${escAttr(style)}">
        ${imgHtml}
        <div class="wt-shopify-feature-body">
          <h2 class="wt-shopify-feature-headline">${escHtml(headline)}</h2>
          ${subtext ? `<p class="wt-shopify-feature-subtext">${escHtml(subtext)}</p>` : ""}
          <a href="${escAttr(ctaLink)}" class="wt-shopify-feature-cta wt-cta-button">${escHtml(ctaText)}</a>
        </div>
      </section>`;
    }

    case "shopify_variant_selector": {
      const rawProduct = shopifyData.get(block.id);
      if (!rawProduct || !("variants" in rawProduct)) {
        return `<div class="wt-shopify-placeholder"><p>Shopify Variant Selector — ID: <code>${escHtml(c.productId || "")}</code></p></div>`;
      }
      const product = rawProduct;
      const safeId = block.id.replace(/[^a-zA-Z0-9_-]/g, "_");
      const ctaText = c.ctaText || "Add to Bag";
      const baseLink = sanitizeUrl(c.ctaLink || `/products/${product.handle}`);
      // Filter variants by selectorType
      const selectorType: string = c.selectorType || "all";
      let variants: ShopifyVariant[] = [...product.variants];
      if (selectorType === "colour") {
        variants = variants.filter((v) => v.options?.some((o) => /colou?r/i.test(o.name)));
      } else if (selectorType === "size") {
        variants = variants.filter((v) => v.options?.some((o) => /size/i.test(o.name)));
      }
      const btnHtml = variants.map((v) => {
        const numId = gidNumericId(v.id);
        const cls = `wt-shopify-variant-btn${!v.available ? " wt-shopify-variant-btn--unavailable" : ""}`;
        return `<button class="${cls}" data-variant-id="${escAttr(numId)}" aria-pressed="false"${!v.available ? ' disabled' : ""}>${escHtml(v.title)}</button>`;
      }).join("\n");
      const script = `(function(){var c=document.getElementById("wt-vs-${safeId}");if(!c)return;var bs=c.querySelectorAll(".wt-shopify-variant-btn:not([disabled])"),a=c.querySelector(".wt-shopify-variant-cta");var base=a?a.getAttribute("data-base-href")||"#":"#";bs.forEach(function(b){b.addEventListener("click",function(){bs.forEach(function(x){x.classList.remove("wt-shopify-variant-btn--active");x.setAttribute("aria-pressed","false");});b.classList.add("wt-shopify-variant-btn--active");b.setAttribute("aria-pressed","true");if(a){a.href=base+(b.getAttribute("data-variant-id")?"?variant="+b.getAttribute("data-variant-id"):"");}});});})();`;
      return `<div class="wt-shopify-variants" id="wt-vs-${safeId}">
        <h3 class="wt-shopify-variants-title">${escHtml(product.title)}</h3>
        <div class="wt-shopify-variant-btns">${btnHtml}</div>
        <a href="${escAttr(baseLink)}" data-base-href="${escAttr(baseLink)}" class="wt-shopify-variant-cta wt-cta-button">${escHtml(ctaText)}</a>
      </div>
      <script>${script}</script>`;
    }

    case "shopify_page": {
      const title = c.titleOverride || c.title || "";
      const excerpt = c.excerptOverride || c.bodySummary || "";
      const link = sanitizeUrl(c.url || (c.handle ? `/pages/${c.handle}` : "#"));
      const ctaText = c.ctaText || "Read More";
      return `<div class="wt-shopify-page-card">
        <div class="wt-shopify-page-card-body">
          <h3 class="wt-shopify-page-card-title">${escHtml(title)}</h3>
          ${excerpt ? `<p class="wt-shopify-page-card-excerpt">${escHtml(excerpt)}</p>` : ""}
          <a href="${escAttr(link)}" class="wt-shopify-page-card-cta wt-cta-button">${escHtml(ctaText)}</a>
        </div>
      </div>`;
    }

    case "shopify_image": {
      const imgUrl = c.url || c.src || "";
      const alt = c.alt || c.altText || "";
      if (!imgUrl) return `<div class="wt-shopify-placeholder"><p>Shopify Image — no URL set</p></div>`;
      return `<figure class="wt-shopify-image">
        <img src="${escAttr(imgUrl)}" alt="${escAttr(alt)}" loading="lazy" />
      </figure>`;
    }

    case "app_block": {
      const rawName = c.componentName ? String(c.componentName) : "";
      if (!rawName) return `<!-- app_block: missing componentName -->`;
      const comp = findComponent(rawName);
      if (!comp) return `<!-- app_block: unknown component "${escHtml(rawName)}" -->`;
      const compName = escAttr(rawName);
      const configObj: Record<string, string> = {};
      if (c.config && typeof c.config === "object") {
        for (const k of Object.keys(c.config)) {
          configObj[k] = String(c.config[k]);
        }
      }
      const configAttr = escAttr(JSON.stringify(configObj));
      const assetUrl = escAttr(comp.assetUrl);
      // Load component bundle once; call window.__WTC_RUN() on load so that
      // initialization runs even if DOMContentLoaded already fired.
      const scriptTag = `<script>!function(){var n="${compName}",w=window.__WTC=window.__WTC||{};if(!w[n]){w[n]=1;var s=document.createElement("script");s.src="${assetUrl}";s.defer=true;s.onload=function(){if(typeof window.__WTC_RUN==="function")window.__WTC_RUN();};document.head.appendChild(s);}}();</script>`;
      return `<div data-wt-component="${compName}" data-wt-config="${configAttr}" class="wt-app-block"></div>${scriptTag}`;
    }

    default:
      return "";
  }
}

function buildDefaultSchema(page: Page, baseUrl: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.title,
    description: page.meta_description,
    url: `${baseUrl}/${page.slug}`,
    datePublished: page.published_at,
    dateModified: page.updated_at,
    image: page.og_image || page.featured_image,
    publisher: {
      "@type": "Organization",
      name: "Well Told",
      url: baseUrl,
    },
  };
}

export async function renderPageHtml(page: Page, baseUrl: string, shopifyFetcher: ShopifyFetcher = null): Promise<string> {
  const canonical = page.canonical_url || `${baseUrl}/a/articles/${page.slug}`;
  const ogTitle = page.og_title || page.title;
  const ogImage = page.og_image || page.featured_image || "";
  const template = page.page_template || "default";

  // ── Markdown rendering path ──────────────────────────────────────────────────
  // When content_markdown is set (generated by "Generate Page" / ai-quick-create),
  // render the full article with FAQ, product cards, CTAs, and brand context —
  // exactly matching what the Cloudflare Worker produces on the live site.
  if (page.content_markdown && page.content_markdown.trim()) {
    const schema = page.structured_data || {};
    const sd = typeof schema === 'object' && !Array.isArray(schema) ? (schema as Record<string, any>) : {};

    const wtFaq: Array<{ question: string; answer: string }> = Array.isArray(sd._wt_faq) ? sd._wt_faq : [];
    const wtProducts: Array<{ title: string; handle: string; imageUrl: string | null; price: string; url: string }> = Array.isArray(sd._wt_products) ? sd._wt_products : [];
    const wtCta: any = sd._wt_cta || null;

    // Build clean Article JSON-LD (strip _wt_ private keys)
    const articleSchema: Record<string, any> = {};
    for (const [k, v] of Object.entries(sd)) {
      if (!k.startsWith('_wt_')) articleSchema[k] = v;
    }
    if (ogImage && !articleSchema.image) articleSchema.image = ogImage;
    if (!articleSchema.description && page.meta_description) articleSchema.description = page.meta_description;

    // FAQPage JSON-LD
    const faqSchema = wtFaq.length > 0 ? {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": wtFaq.map(f => ({
        "@type": "Question",
        "name": escHtml(f.question),
        "acceptedAnswer": { "@type": "Answer", "text": escHtml(f.answer) },
      })),
    } : null;

    const allSchemas = [
      Object.keys(articleSchema).length > 1 ? articleSchema : null,
      faqSchema,
    ].filter(Boolean);

    // Brand context block (after H1)
    const brandContextHtml = `<div class="wt-brand-context" aria-label="About Well Told Design">
  <p><strong>Well Told Design</strong> is a Boston-based gift brand specialising in story-driven objects — glassware, drinkware, and textiles engraved with maps, constellations, and topographic designs. Every piece is personalised to a specific place, date, or memory.</p>
</div>`;

    // Inline CTA (Type A)
    const inlineCtaHtml = wtCta?.inline ? `
<div class="wt-cta-inline">
  <p class="wt-cta-inline__body">${escHtml(wtCta.inline.body)}</p>
  <a href="${escAttr(wtCta.inline.url)}" class="wt-cta-inline__btn" rel="noopener">${escHtml(wtCta.inline.buttonText)}</a>
</div>` : '';

    // Bottom CTA (Type B)
    const bottomCtaHtml = wtCta?.bottom ? `
<section class="wt-cta-bottom">
  <h2 class="wt-cta-bottom__headline">${escHtml(wtCta.bottom.headline)}</h2>
  <p class="wt-cta-bottom__body">${escHtml(wtCta.bottom.body)}</p>
  <a href="${escAttr(wtCta.bottom.primaryUrl)}" class="wt-cta-bottom__btn" rel="noopener">${escHtml(wtCta.bottom.primaryButtonText)}</a>
  <a href="${escAttr(wtCta.bottom.secondaryUrl)}" class="wt-cta-bottom__link" rel="noopener">${escHtml(wtCta.bottom.secondaryText)}</a>
</section>` : '';

    // Product cards grid
    const productsHtml = wtProducts.length > 0 ? `
<section class="wt-products-grid" aria-label="Featured Products">
  <h2 class="wt-products-grid__heading">Featured Products</h2>
  <div class="wt-products-grid__cards">
    ${wtProducts.map(p => `<div class="wt-product-card">
      <a href="${escAttr(p.url)}" class="wt-product-card__link" rel="noopener">
        ${p.imageUrl ? `<div class="wt-product-card__img-wrap"><img src="${escAttr(p.imageUrl)}" alt="${escAttr(p.title)}" loading="lazy" class="wt-product-card__img" /></div>` : ''}
        <div class="wt-product-card__body">
          <p class="wt-product-card__title">${escHtml(p.title)}</p>
          <p class="wt-product-card__price">${escHtml(p.price)}</p>
        </div>
      </a>
    </div>`).join('\n    ')}
  </div>
</section>` : '';

    // FAQ section — always render as accordion from _wt_faq structured data.
    // FAQ is NOT embedded in the markdown body; it lives only in structured_data._wt_faq.
    const faqHtml = wtFaq.length > 0 ? `
<div class="wt-accordion" aria-label="Frequently Asked Questions">
  <h2 class="wt-accordion-title">Frequently Asked Questions</h2>
  ${wtFaq.map(f => `<details class="wt-accordion-item">
    <summary class="wt-accordion-question">${escHtml(f.question)}</summary>
    <div class="wt-accordion-answer">${escHtml(f.answer)}</div>
  </details>`).join('\n  ')}
</div>` : '';

    // Strip legacy inline FAQ from markdown body — FAQ is now rendered as accordion from _wt_faq.
    let markdownForRender = page.content_markdown ?? '';
    if (wtFaq.length > 0) {
      const faqHeadingIdx = markdownForRender.indexOf('\n\n## Frequently Asked Questions');
      if (faqHeadingIdx !== -1) markdownForRender = markdownForRender.slice(0, faqHeadingIdx);
    }

    // Render markdown to HTML, inject hero image then brand context after H1
    let body = markdownToHtml(markdownForRender);
    const heroHtml = page.featured_image
      ? `<div class="wt-hero-image"><img src="${escAttr(page.featured_image)}" alt="${escAttr(page.title || "")}" loading="eager" /></div>`
      : '';
    const h1End = body.indexOf('</h1>');
    if (h1End !== -1) {
      const insertAt = h1End + '</h1>'.length;
      body = body.slice(0, insertAt)
        + (heroHtml ? '\n' + heroHtml : '')
        + '\n' + brandContextHtml
        + body.slice(insertAt);
    } else {
      body = (heroHtml ? heroHtml + '\n' : '') + brandContextHtml + '\n' + body;
    }

    // Inject inline CTA after 2nd </h2> in body
    if (inlineCtaHtml) {
      const h2Regex = /<\/h2>/g;
      let matchCount = 0;
      let insertAt = -1;
      let m: RegExpExecArray | null;
      while ((m = h2Regex.exec(body)) !== null) {
        matchCount++;
        if (matchCount === 2) { insertAt = m.index + m[0].length; break; }
        insertAt = m.index + m[0].length;
      }
      if (insertAt !== -1) {
        body = body.slice(0, insertAt) + '\n' + inlineCtaHtml + body.slice(insertAt);
      }
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(ogTitle)} | Well Told</title>
  <meta name="description" content="${escAttr(page.meta_description || "")}" />
  <link rel="canonical" href="${escAttr(canonical)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escAttr(ogTitle)}" />
  <meta property="og:description" content="${escAttr(page.meta_description || "")}" />
  <meta property="og:url" content="${escAttr(canonical)}" />
  ${ogImage ? `<meta property="og:image" content="${escAttr(ogImage)}" />` : ""}
  <meta property="og:site_name" content="Well Told Design" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escAttr(ogTitle)}" />
  <meta name="twitter:description" content="${escAttr(page.meta_description || "")}" />
  ${ogImage ? `<meta name="twitter:image" content="${escAttr(ogImage)}" />` : ""}
  ${allSchemas.map(s => `<script type="application/ld+json">${safeJsonLd(s)}</script>`).join('\n  ')}
  <link rel="stylesheet" href="${escAttr(baseUrl)}/styles/wt-pages.css" />
  ${page.custom_css ? `<style>${page.custom_css}</style>` : ""}
</head>
<body class="wt-page wt-template-${escAttr(template)}">
  <main class="wt-content">
    ${body}
    ${bottomCtaHtml}
    ${productsHtml}
    ${faqHtml}
  </main>
</body>
</html>`;
  }

  // ── Block rendering path (legacy block-based content) ───────────────────────
  // Extract blocks from content_json
  const contentJson = page.content_json || {};
  const blocks: ContentBlock[] = Array.isArray(contentJson)
    ? contentJson
    : Array.isArray(contentJson.blocks)
    ? contentJson.blocks
    : [];

  // Pre-fetch Shopify data with entity-level dedup: same product/collection fetched only once
  const shopifyData = new Map<string, ShopifyProduct | ShopifyCollection>();
  if (shopifyFetcher) {
    const shopifyBlocks = collectAllBlocks(blocks).filter((b) => b.type.startsWith("shopify_"));
    // Step 1: build one promise per unique entity key
    //   product_card / variant_selector → productId
    //   product_grid → collectionId:itemCount (count affects the returned products)
    //   collection_feature → collectionId only (it doesn't use itemCount)
    const fetchCache = new Map<string, Promise<ShopifyProduct | ShopifyCollection | null>>();
    for (const block of shopifyBlocks) {
      const c = block.content || {};
      if ((block.type === "shopify_product_card" || block.type === "shopify_variant_selector") && c.productId) {
        if (!fetchCache.has(c.productId)) {
          fetchCache.set(c.productId, shopifyFetcher.fetchProduct(c.productId).catch(() => null));
        }
      } else if (block.type === "shopify_product_grid" && c.collectionId) {
        const key = `${c.collectionId}:${c.itemCount || 8}`;
        if (!fetchCache.has(key)) {
          fetchCache.set(key, shopifyFetcher.fetchCollection(c.collectionId, c.itemCount || 8).catch(() => null));
        }
      } else if (block.type === "shopify_collection_feature" && c.collectionId) {
        if (!fetchCache.has(c.collectionId)) {
          fetchCache.set(c.collectionId, shopifyFetcher.fetchCollection(c.collectionId).catch(() => null));
        }
      }
    }
    // Step 2: execute all unique fetches concurrently
    await Promise.all(fetchCache.values());
    // Step 3: assign resolved data to each block by its entity reference
    for (const block of shopifyBlocks) {
      const c = block.content || {};
      let result: ShopifyProduct | ShopifyCollection | null = null;
      if ((block.type === "shopify_product_card" || block.type === "shopify_variant_selector") && c.productId) {
        result = (await fetchCache.get(c.productId)) ?? null;
      } else if (block.type === "shopify_product_grid" && c.collectionId) {
        result = (await fetchCache.get(`${c.collectionId}:${c.itemCount || 8}`)) ?? null;
      } else if (block.type === "shopify_collection_feature" && c.collectionId) {
        result = (await fetchCache.get(c.collectionId)) ?? null;
      }
      if (result) shopifyData.set(block.id, result);
    }
  }

  const sortedBlocks = blocks.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const body = sortedBlocks.map((block) => renderBlock(block, shopifyData)).join("\n");
  const hasAppBlocks = collectAllBlocks(sortedBlocks).some((b) => b.type === "app_block");

  const schema = page.structured_data || buildDefaultSchema(page, baseUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(page.title)}</title>
  <meta name="description" content="${escAttr(page.meta_description || "")}" />
  <link rel="canonical" href="${escAttr(canonical)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escAttr(ogTitle)}" />
  <meta property="og:description" content="${escAttr(page.meta_description || "")}" />
  <meta property="og:url" content="${escAttr(canonical)}" />
  ${ogImage ? `<meta property="og:image" content="${escAttr(ogImage)}" />` : ""}
  <meta property="og:site_name" content="Well Told" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escAttr(ogTitle)}" />
  <meta name="twitter:description" content="${escAttr(page.meta_description || "")}" />
  ${ogImage ? `<meta name="twitter:image" content="${escAttr(ogImage)}" />` : ""}

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">${safeJsonLd(schema)}</script>

  <link rel="stylesheet" href="${escAttr(baseUrl)}/styles/wt-pages.css" />
  ${hasAppBlocks ? `<script src="${escAttr(baseUrl)}/components/loader.js" defer></script>` : ""}
  ${page.custom_css ? `<style>${page.custom_css}</style>` : ""}
</head>
<body class="wt-page wt-template-${escAttr(template)}">
  <main class="wt-content">
    ${body}
  </main>
</body>
</html>`;
}

export function render404(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Page Not Found — Well Told</title>
  <meta name="robots" content="noindex" />
</head>
<body>
  <h1>Page Not Found</h1>
  <p>The page you were looking for doesn't exist.</p>
  <a href="/">Return home</a>
</body>
</html>`;
}
