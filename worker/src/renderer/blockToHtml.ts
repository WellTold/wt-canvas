// Zero external dependencies — runs in Cloudflare Workers and Node.js.
//
// COMPONENT REGISTRY (inlined — Cloudflare Workers cannot import from the server)
// SOURCE OF TRUTH: server/config/componentRegistry.ts
// When adding or removing components, update BOTH files.
// Fields: assetUrl — publicly reachable CDN URL for the component ES bundle.
const WORKER_COMPONENT_REGISTRY: Record<string, { assetUrl: string }> = {
  coming_soon:          { assetUrl: "https://cdn.welltold.design/components/coming-soon.js" },
  product_personaliser: { assetUrl: "https://cdn.welltold.design/components/product-personaliser.js" },
};

// SNIPPET MAP (inlined — mirrors server/config/snippets.ts)
const WORKER_SNIPPET_MAP: Record<string, string> = {
  email_header_standard: `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;"><tr><td align="center" style="padding:24px 20px;"><a href="https://welltold.design" target="_blank" style="text-decoration:none;"><img src="https://cdn.welltold.design/brand/welltold-logo.png" alt="Well Told" width="140" height="auto" style="display:block;border:0;max-width:140px;" /></a></td></tr></table>`,
  email_footer_standard: `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0ebe7;border-top:1px solid #e0d8d2;"><tr><td align="center" style="padding:32px 20px 24px;"><a href="https://welltold.design" target="_blank" style="text-decoration:none;"><img src="https://cdn.welltold.design/brand/welltold-logo.png" alt="Well Told" width="100" height="auto" style="display:block;margin:0 auto 20px;border:0;max-width:100px;" /></a><table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;"><tr><td style="padding:0 10px;"><a href="https://www.instagram.com/welltolddesign" target="_blank" style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;text-decoration:none;">Instagram</a></td><td style="padding:0 2px;font-family:Arial,sans-serif;font-size:13px;color:#999999;">|</td><td style="padding:0 10px;"><a href="https://www.pinterest.com/welltolddesign" target="_blank" style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;text-decoration:none;">Pinterest</a></td><td style="padding:0 2px;font-family:Arial,sans-serif;font-size:13px;color:#999999;">|</td><td style="padding:0 10px;"><a href="https://welltold.design" target="_blank" style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;text-decoration:none;">Website</a></td></tr></table><p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;color:#666666;line-height:1.5;text-align:center;">Well Told Design Ltd &middot; London, United Kingdom</p><p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#999999;line-height:1.5;text-align:center;">You're receiving this because you opted in at welltold.design.&nbsp;<a href="{{unsubscribe_url}}" style="color:#666666;text-decoration:underline;">Unsubscribe</a></p></td></tr></table>`,
};

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
  structured_data_type?: string | null;
}

// Typed payloads returned by ShopifyFetcher (mirrors server/services/shopify.ts output)
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

// ── Inline style helpers (mirrors server/renderer/blockToHtml.ts) ─────────────

const FONT_SIZE_MAP: Record<string, string> = {
  sm: "12px", md: "14px", lg: "16px", xl: "20px",
  "2xl": "24px", "3xl": "32px", "4xl": "40px",
};

function buildTextStyle(c: Record<string, any>): string {
  const parts: string[] = ["word-wrap:break-word", "overflow-wrap:break-word"];
  if (c.backgroundColor) parts.push(`background-color:${escAttr(c.backgroundColor)}`);
  if (c.backgroundImageUrl) parts.push(`background-image:url('${escAttr(c.backgroundImageUrl)}')`);
  if (c.textColor) parts.push(`color:${escAttr(c.textColor)}`);
  if (c.fontSize && FONT_SIZE_MAP[c.fontSize]) parts.push(`font-size:${FONT_SIZE_MAP[c.fontSize]}`);
  if (c.fontWeight) parts.push(`font-weight:${escAttr(c.fontWeight)}`);
  if (c.textAlign) parts.push(`text-align:${escAttr(c.textAlign)}`);
  if (c.fontStyle && c.fontStyle !== "normal") parts.push(`font-style:${escAttr(c.fontStyle)}`);
  if (c.textDecoration && c.textDecoration !== "none") parts.push(`text-decoration:${escAttr(c.textDecoration)}`);
  if (c.textTransform && c.textTransform !== "none") parts.push(`text-transform:${escAttr(c.textTransform)}`);
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

export function renderBlock(block: ContentBlock, shopifyData: Map<string, ShopifyProduct | ShopifyCollection> = new Map(), context: "web" | "email" = "web"): string {
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
      const imgStyle = wm !== "full"
        ? `style="width:${imgPx}px;max-width:100%;height:auto;" width="${imgPx}"`
        : `style="width:100%;max-width:100%;height:auto;"`;
      return `<figure class="wt-figure" ${figStyle}>
        <img src="${escAttr(c.url || c.src || "")}" alt="${escAttr(c.alt || "")}" loading="lazy" ${imgStyle} />
        ${c.caption ? `<figcaption class="wt-caption">${escHtml(c.caption)}</figcaption>` : ""}
      </figure>`;
    }
    case "quote":
      return `<blockquote class="wt-quote"${buildTextStyle(c)}>
        <p>${escHtml(c.text || "")}</p>
        ${(c.author || c.attribution) ? `<cite class="wt-cite">— ${escHtml(c.author || c.attribution)}</cite>` : ""}
      </blockquote>`;
    case "list": {
      const items: string[] = Array.isArray(c.items) ? c.items : [];
      const style = c.style || (c.ordered ? "numbered" : "bullet");
      const tag = style === "numbered" ? "ol" : "ul";
      const listClass = `wt-list wt-list--${escAttr(style)}`;
      return `<${tag} class="${listClass}"${buildTextStyle(c)}>${items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</${tag}>`;
    }
    case "cta": {
      const ctaLink = sanitizeUrl(c.link || c.url || "#");
      const containerStyle = buildTextStyle(c);
      const btnLabel = c.buttonText || c.text || "";
      const btnStyle = buildCTAButtonStyle(c);
      const bodyHtml = c.bodyText ? `<p style="margin:0 0 16px 0;font-family:Arial,sans-serif;">${escHtml(c.bodyText)}</p>` : "";
      if (c.style === "link" && !c.buttonStyle) {
        return `<div class="wt-cta"${containerStyle}>${bodyHtml}<a href="${escAttr(ctaLink)}" class="wt-cta-link">${escHtml(btnLabel)}</a></div>`;
      }
      return `<div class="wt-cta"${containerStyle}>${bodyHtml}<a href="${escAttr(ctaLink)}" style="${btnStyle}">${escHtml(btnLabel)}</a></div>`;
    }
    case "divider": {
      const style = c.style || "line";
      if (style === "space") {
        const height = Number(c.height) || 24;
        return `<div class="wt-divider-space" style="height:${height}px"></div>`;
      }
      const color = c.color || "#e0d8d2";
      const height = Number(c.height) || 1;
      return `<hr class="wt-divider" style="border-top:${height}px solid ${escAttr(color)}" />`;
    }
    case "spacer":
      return `<div class="wt-spacer" style="height:${Number(c.height) || 40}px;" aria-hidden="true"></div>`;
    case "html_block":
      return c.html || "";

    // ── Email blocks (rendering in web context) ────────────────────────────────
    case "promo_code": {
      return `<div class="wt-promo-code">
        ${c.headline ? `<h4 class="wt-promo-headline">${escHtml(c.headline)}</h4>` : ""}
        <div class="wt-promo-box">
          <code class="wt-promo-value">${escHtml(c.code || "")}</code>
          <button class="wt-promo-copy" onclick="navigator.clipboard.writeText('${escAttr(c.code || "")}')">Copy</button>
        </div>
        ${(c.expiry || c.expires) ? `<p class="wt-promo-expires">Expires ${escHtml(c.expiry || c.expires)}</p>` : ""}
      </div>`;
    }
    case "countdown_timer": {
      const label = c.label || "Offer ends in";
      const deadline = c.deadline ? new Date(c.deadline).toLocaleString() : "soon";
      return `<div class="wt-countdown">
        <p class="wt-countdown-label">${escHtml(label)}</p>
        <p class="wt-countdown-value">${escHtml(deadline)}</p>
      </div>`;
    }
    case "testimonial": {
      const rating = Number(c.rating) || 0;
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      return `<div class="wt-testimonial">
        ${rating > 0 ? `<div class="wt-testimonial-rating">${escHtml(stars)}</div>` : ""}
        <blockquote class="wt-testimonial-quote">${escHtml(c.quote || "")}</blockquote>
        <div class="wt-testimonial-author">
          ${c.avatar_url ? `<img src="${escAttr(c.avatar_url)}" alt="" class="wt-testimonial-avatar" />` : ""}
          <cite>${escHtml(c.author || "")}</cite>
        </div>
      </div>`;
    }

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
      const leftHtml  = leftBlocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(b => renderBlock(b, shopifyData, context)).join("\n");
      const rightHtml = rightBlocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(b => renderBlock(b, shopifyData, context)).join("\n");
      return `<div class="wt-two-col">
        <div class="wt-two-col-left">${leftHtml}</div>
        <div class="wt-two-col-right">${rightHtml}</div>
      </div>`;
    }

    case "accordion": {
      const items: Array<{ question: string; answer: string }> = Array.isArray(c.items) ? c.items : [];
      const title = c.title || c.heading || "";
      if (context === "email") {
        const titleHtml = title
          ? `<p style="font-family:'Cera Pro',Arial,sans-serif;font-size:18px;font-weight:700;color:#000;margin:0 0 20px 0;">${escHtml(title)}</p>`
          : "";
        const rows = items.map((item) =>
          `<div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #e5e5e5;">
            <p style="font-family:'Cera Pro',Arial,sans-serif;font-size:15px;font-weight:700;color:#000;margin:0 0 8px 0;">${escHtml(item.question || "")}</p>
            <p style="font-family:'Cera Pro',Arial,sans-serif;font-size:15px;color:#444;line-height:1.6;margin:0;">${escHtml(item.answer || "")}</p>
          </div>`
        ).join("\n");
        return `<div style="margin:2rem 0;">${titleHtml}${rows}</div>`;
      }
      const titleHtml = title
        ? `<h2 class="wt-accordion-title">${escHtml(title)}</h2>`
        : "";
      const rows = items.map((item) => `<details class="wt-accordion-item">
          <summary class="wt-accordion-question">${escHtml(item.question || "")}</summary>
          <div class="wt-accordion-answer">${escHtml(item.answer || "")}</div>
        </details>`).join("\n");
      return `<div class="wt-accordion">${titleHtml}${rows}</div>`;
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
      const sortOrder: string = c.sortOrder || "default";
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
      const comp = WORKER_COMPONENT_REGISTRY[rawName];
      if (!comp) return `<!-- app_block: unknown component "${escHtml(rawName)}" -->`;
      const compName = escAttr(rawName);
      const configObj: Record<string, string> = {};
      if (c.config && typeof c.config === "object") {
        const cfg = c.config as Record<string, unknown>;
        for (const k of Object.keys(cfg)) {
          configObj[k] = String(cfg[k]);
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

function buildDefaultSchema(page: Page, baseUrl: string): object | null {
  const type = page.structured_data_type || "None";
  if (type === "None") return null;

  const base = {
    "@context": "https://schema.org",
    "@type": type,
    headline: page.title,
    description: page.meta_description,
    url: page.canonical_url || `${baseUrl}/pages/${page.slug}`,
    datePublished: page.published_at,
    dateModified: page.updated_at,
    image: page.og_image || page.featured_image,
    publisher: {
      "@type": "Organization",
      name: "Well Told",
      url: baseUrl,
    },
  };

  if (type === "FAQPage") {
    return { ...base, mainEntity: [] };
  }
  
  if (type === "Product") {
    return {
      ...base,
      name: page.title,
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/InStock"
      }
    };
  }

  return base;
}

export interface SiteSettings {
  logoUrl?: string | null;
  logoLink?: string | null;
  announcementText?: string | null;
  announcementLink?: string | null;
  announcementBgColor?: string | null;
  announcementTextColor?: string | null;
  announcementEnabled?: boolean | null;
  navLinks?: Array<{ label: string; href?: string; url?: string }> | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  footerLogoUrl?: string | null;
  footerBgColor?: string | null;
  footerColumns?: Array<{ heading: string; links: Array<{ label: string; href: string }> }> | null;
  footerAddress?: string | null;
  footerLinks?: Array<{ label: string; href?: string; url?: string }> | null;
  footerCopyright?: string | null;
  footerAnnouncementEnabled?: boolean | null;
  footerAnnouncementText?: string | null;
  footerAnnouncementLink?: string | null;
  footerAnnouncementBgColor?: string | null;
  footerAnnouncementTextColor?: string | null;
  socialHandle?: string | null;
  socialLinks?: Array<{ platform: string; url: string }> | null;
}

const SOCIAL_SVGS: Record<string, string> = {
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-label="Instagram"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
  facebook: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-label="Facebook"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  youtube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-label="YouTube"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>`,
  pinterest: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-label="Pinterest"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.987 0-6.62-5.367-11.988-11.99-11.988z"/></svg>`,
  tiktok: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-label="TikTok"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
};

function socialIcon(platform: string): string {
  return SOCIAL_SVGS[platform.toLowerCase()]
    ?? `<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1.5px solid #000;font-size:11px;font-weight:700;">${escHtml(platform.charAt(0).toUpperCase())}</span>`;
}

/** Sanitize HTML to allow only <strong>, <em>, <a href="..."> and their closing tags. */
function sanitizeAnnouncementHtml(raw: string): string {
  const parts: string[] = [];
  const tagRe = /<[^>]{0,500}>/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(raw)) !== null) {
    parts.push(escHtml(raw.slice(lastIdx, m.index)));
    const tag = m[0];
    if (/^<\/?(strong|em)>$/i.test(tag)) {
      parts.push(tag);
    } else if (/^<a\b[^>]*>$/i.test(tag)) {
      const hm = tag.match(/\bhref=(["'])([^"'<>]{0,500})\1/i);
      if (hm) {
        const href = hm[2].trim();
        const safe = /^(https?:\/\/|\/)/.test(href) ? href : "#";
        parts.push(`<a href="${safe}" style="color:inherit;text-decoration:none;">`);
      }
    } else if (/^<\/a>$/i.test(tag)) {
      parts.push("</a>");
    }
    lastIdx = m.index + tag.length;
  }
  parts.push(escHtml(raw.slice(lastIdx)));
  return parts.join("");
}

export function renderSiteHeader(settings: SiteSettings): string {
  const fg = escAttr(settings.announcementTextColor || "#fff");
  const announcementHtml = settings.announcementEnabled && settings.announcementText
    ? (() => {
        const inner = sanitizeAnnouncementHtml(settings.announcementText);
        const content = settings.announcementLink
          ? `<a href="${escAttr(settings.announcementLink)}" style="color:${fg};text-decoration:none;">${inner}</a>`
          : inner;
        return `<div style="background:${escAttr(settings.announcementBgColor || "#000")};color:${fg};text-align:center;padding:10px 20px;font-size:13px;font-weight:700;letter-spacing:0.05em;">${content}</div>`;
      })()
    : "";

  const logoHtml = settings.logoUrl
    ? `<a href="${escAttr(settings.logoLink || "/")}" style="display:flex;align-items:center;">
      <img src="${escAttr(settings.logoUrl)}" alt="Well Told" style="height:60px;width:auto;" />
    </a>`
    : "";

  const navLinksHtml = (settings.navLinks || [])
    .map((l) => `<a href="${escAttr(l.href || l.url || "#")}" style="font-family:'Cera Pro',sans-serif;font-size:14px;font-weight:400;color:#000;text-decoration:none;letter-spacing:0.02em;">${escHtml(l.label)}</a>`)
    .join("\n      ");

  return `${announcementHtml}
<header style="background:#f8f8f6;border-bottom:1px solid #e5e5e5;">
  <div style="max-width:1400px;margin:0 auto;padding:0 60px;display:flex;align-items:center;justify-content:space-between;height:96px;">
    ${logoHtml}
    <nav style="display:flex;gap:28px;align-items:center;">
      ${navLinksHtml}
    </nav>
  </div>
</header>`;
}

export function renderSiteFooter(settings: SiteSettings): string {
  const footerBg = escAttr(settings.footerBgColor || "#F5F5F5");

  // Footer logo falls back to header logo if not set
  const footerLogoSrc = settings.footerLogoUrl || settings.logoUrl;

  const footerColumnsHtml = (settings.footerColumns || []).map((col) => `
    <div>
      <h4 style="font-family:'Cera Pro',sans-serif;font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 16px;">${escHtml(col.heading)}</h4>
      <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;">
        ${(col.links || []).map((l) => `<li><a href="${escAttr(l.href)}" style="font-family:'Cera Pro',sans-serif;font-size:14px;color:#000;text-decoration:none;">${escHtml(l.label)}</a></li>`).join("")}
      </ul>
    </div>`).join("\n");

  const socialHtml = (settings.socialLinks?.length || settings.socialHandle)
    ? `<div>
      ${settings.socialHandle ? `<p style="font-size:14px;font-weight:700;margin:0 0 12px;">${escHtml(settings.socialHandle)}</p>` : ""}
      <div style="display:flex;gap:12px;">
        ${(settings.socialLinks || []).map((s) => `<a href="${escAttr(s.url)}" style="color:#000;text-decoration:none;">${socialIcon(s.platform)}</a>`).join("")}
      </div>
    </div>`
    : "";

  const logoColHtml = footerLogoSrc
    ? `<div>
      <a href="${escAttr(settings.logoLink || "/")}">
        <img src="${escAttr(footerLogoSrc)}" alt="Well Told" style="height:100px;width:auto;" />
      </a>
    </div>`
    : "";

  const copyrightHtml = settings.footerCopyright
    ? `<span style="font-size:13px;color:#666;">${escHtml(settings.footerCopyright)}</span>`
    : "";

  const bottomLinksHtml = (settings.footerLinks || []).map((l) => {
    const href = l.href || l.url || "#";
    return `<a href="${escAttr(href)}" style="font-family:'Cera Pro',sans-serif;font-size:13px;color:#666;text-decoration:none;">${escHtml(l.label)}</a>`;
  }).join(`<span style="color:#ccc;">|</span>`);

  const hasBottomBar = copyrightHtml || bottomLinksHtml;

  // Footer announcement banner (just above the footer block)
  const footerAnnouncementHtml = settings.footerAnnouncementEnabled && settings.footerAnnouncementText
    ? (() => {
        const bg = escAttr(settings.footerAnnouncementBgColor || "#f0ebe7");
        const fg = escAttr(settings.footerAnnouncementTextColor || "#000000");
        const text = escHtml(settings.footerAnnouncementText);
        const link = settings.footerAnnouncementLink;
        const inner = link
          ? `<a href="${escAttr(link)}" style="color:${fg};text-decoration:none;font-family:'Cera Pro',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.05em;">${text}</a>`
          : `<span style="font-family:'Cera Pro',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.05em;">${text}</span>`;
        return `<div style="background:${bg};color:${fg};text-align:center;padding:12px 20px;">${inner}</div>`;
      })()
    : "";

  return `${footerAnnouncementHtml}<footer style="background:${footerBg};padding:60px 40px 30px;">
  <div style="max-width:1200px;margin:0 auto;">
    <div style="display:grid;grid-template-columns:220px repeat(auto-fit,minmax(180px,1fr));gap:40px;margin-bottom:48px;">
      ${logoColHtml}
      ${footerColumnsHtml}
      ${socialHtml}
    </div>
    ${hasBottomBar ? `<div style="border-top:1px solid #e5e5e5;padding-top:20px;display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;">
      ${copyrightHtml}
      ${bottomLinksHtml ? `<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">${bottomLinksHtml}</div>` : ""}
    </div>` : ""}
  </div>
</footer>`;
}

export async function renderPageHtml(page: Page, baseUrl: string, shopifyFetcher: ShopifyFetcher = null, siteSettings: SiteSettings = {}): Promise<string> {
  // content_json may be stored as a JSON string in Supabase rather than a parsed object
  let rawContentJson = page.content_json || {};
  if (typeof rawContentJson === "string") {
    try { rawContentJson = JSON.parse(rawContentJson); } catch { rawContentJson = {}; }
  }
  const contentJson = rawContentJson as Record<string, unknown> | unknown[];
  const blocks: ContentBlock[] = Array.isArray(contentJson)
    ? (contentJson as ContentBlock[])
    : Array.isArray((contentJson as Record<string, unknown>).blocks)
    ? ((contentJson as Record<string, unknown>).blocks as ContentBlock[])
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
    // Step 3: assign resolved data to each block
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
  const body = sortedBlocks.map((block) => renderBlock(block, shopifyData, "web")).join("\n");
  const hasAppBlocks = collectAllBlocks(sortedBlocks).some((b) => b.type === "app_block");

  const canonical = page.canonical_url || `${baseUrl}/pages/${page.slug}`;
  const ogTitle = page.og_title || page.title;
  const ogImage = page.og_image || page.featured_image || "";
  let rawSchema = page.structured_data || buildDefaultSchema(page, baseUrl);
  if (typeof rawSchema === "string") {
    try { rawSchema = JSON.parse(rawSchema); } catch { /* keep as-is */ }
  }
  const schema = rawSchema;
  const template = page.page_template || "default";

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
  <meta property="og:site_name" content="Well Told" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escAttr(ogTitle)}" />
  <meta name="twitter:description" content="${escAttr(page.meta_description || "")}" />
  ${ogImage ? `<meta name="twitter:image" content="${escAttr(ogImage)}" />` : ""}

  ${schema ? `<script type="application/ld+json">${safeJsonLd(schema)}</script>` : ""}

  <link rel="stylesheet" href="${escAttr(baseUrl)}/styles/wt-pages.css" />
  ${hasAppBlocks ? `<script src="${escAttr(baseUrl)}/components/loader.js" defer></script>` : ""}
  ${page.custom_css ? `<style>${page.custom_css}</style>` : ""}
</head>
<body class="wt-page wt-template-${escAttr(template)}">
  ${renderSiteHeader(siteSettings)}
  <main class="wt-content">
    ${body}
  </main>
  ${renderSiteFooter(siteSettings)}
</body>
</html>`;
}

export function render404(siteSettings: SiteSettings = {}, baseUrl = "https://welltold.design"): string {
  const header = renderSiteHeader(siteSettings);
  const footer = renderSiteFooter(siteSettings);
  const accent = escAttr(siteSettings.accentColor || "#04a7cd");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page Not Found — Well Told</title>
  <meta name="robots" content="noindex" />
  <link rel="stylesheet" href="${escAttr(baseUrl)}/styles/wt-pages.css" />
</head>
<body class="wt-page" style="margin:0;padding:0;font-family:'Cera Pro',-apple-system,BlinkMacSystemFont,sans-serif;">
  ${header}
  <main style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:80px 24px;">
    <div style="text-align:center;max-width:480px;">
      <p style="font-size:64px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accent};margin:0 0 16px;">404</p>
      <h1 style="font-family:'Cera Pro',sans-serif;font-size:40px;font-weight:700;color:#000;margin:0 0 16px;line-height:1.15;">Page not found</h1>
      <p style="font-size:16px;color:#666;line-height:1.6;margin:0 0 36px;">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <a href="${escAttr(baseUrl)}"
        style="display:inline-block;background:${accent};color:#fff;font-family:'Cera Pro',sans-serif;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:2px;">
        Back to Well Told
      </a>
    </div>
  </main>
  ${footer}
</body>
</html>`;
}

export function renderEmailHtml(page: Page): string {
  let rawContentJson = page.content_json || {};
  if (typeof rawContentJson === "string") {
    try { rawContentJson = JSON.parse(rawContentJson); } catch { rawContentJson = {}; }
  }
  const contentJson = rawContentJson as Record<string, unknown> | unknown[];
  const blocks: ContentBlock[] = Array.isArray(contentJson)
    ? (contentJson as ContentBlock[])
    : Array.isArray((contentJson as Record<string, unknown>).blocks)
    ? ((contentJson as Record<string, unknown>).blocks as ContentBlock[])
    : [];

  const sortedBlocks = blocks.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const body = sortedBlocks.map((block) => renderBlock(block, new Map(), "email")).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(page.title)}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Cera Pro',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:0;">
              ${body}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
