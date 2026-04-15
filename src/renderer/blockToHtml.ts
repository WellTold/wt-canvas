// Zero external dependencies — runs in both Node.js (Replit) and Cloudflare Workers

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
  meta_description?: string;
  content_json: ContentBlock[] | { blocks: ContentBlock[] };
  featured_image?: string;
  og_image?: string;
  og_title?: string;
  canonical_url?: string;
  page_template?: string;
  structured_data?: Record<string, any>;
  custom_css?: string;
  published_at?: string;
  updated_at?: string;
}

export function renderBlock(block: ContentBlock): string {
  const c = block.content || {};
  switch (block.type) {
    case "heading": {
      const level = c.level || 2;
      return `<h${level} class="wt-heading wt-h${level}">${escHtml(c.text || "")}</h${level}>`;
    }
    case "text":
    case "paragraph":
      return `<p class="wt-paragraph">${escHtml(c.text || "")}</p>`;
    case "image":
    case "figure":
      return `<figure class="wt-figure">
  <img src="${escAttr(c.url || c.src || "")}" alt="${escAttr(c.alt || "")}" loading="lazy" />
  ${c.caption ? `<figcaption>${escHtml(c.caption)}</figcaption>` : ""}
</figure>`;
    case "quote":
      return `<blockquote class="wt-quote">
  <p>${escHtml(c.text || "")}</p>
  ${c.author ? `<cite>${escHtml(c.author)}</cite>` : ""}
</blockquote>`;
    case "list": {
      const tag = c.ordered ? "ol" : "ul";
      const items: string[] = Array.isArray(c.items) ? c.items : [];
      return `<${tag} class="wt-list">${items.map((i: string) => `<li>${escHtml(i)}</li>`).join("")}</${tag}>`;
    }
    case "cta":
      return `<div class="wt-cta">
  <p class="wt-cta-text">${escHtml(c.text || "")}</p>
  ${c.buttonText ? `<a href="${escAttr(c.link || "#")}" class="wt-cta-button">${escHtml(c.buttonText)}</a>` : ""}
</div>`;
    case "html_block":
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
      const leftHtml = (Array.isArray(c.leftBlocks) ? c.leftBlocks : [])
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((b: any) => renderBlock(b)).join("\n");
      const rightHtml = (Array.isArray(c.rightBlocks) ? c.rightBlocks : [])
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((b: any) => renderBlock(b)).join("\n");
      return `<div class="wt-two-col"><div class="wt-two-col-left">${leftHtml}</div><div class="wt-two-col-right">${rightHtml}</div></div>`;
    }
    case "accordion": {
      const rows = (Array.isArray(c.items) ? c.items : []).map((item: any) =>
        `<details class="wt-accordion-item"><summary class="wt-accordion-question">${escHtml(item.question || "")}</summary><div class="wt-accordion-answer">${escHtml(item.answer || "")}</div></details>`
      ).join("");
      return `<div class="wt-accordion">${rows}</div>`;
    }
    case "banner": {
      const style = ["info", "sale", "warning"].includes(c.style) ? c.style : "info";
      const link = c.link ? `<a href="${escAttr(c.link)}" class="wt-banner-link">${escHtml(c.linkText || "Learn more")}</a>` : "";
      return `<div class="wt-banner wt-banner--${escAttr(style)}"><p class="wt-banner-text">${escHtml(c.text || "")}</p>${link}</div>`;
    }
    case "icon_text_row": {
      const cols = c.columns === 4 ? 4 : 3;
      const cards = (Array.isArray(c.items) ? c.items : []).map((item: any) => {
        const iconEl = item.icon ? `<div class="wt-icon-item-icon"><img src="${escAttr(item.icon)}" alt="" aria-hidden="true" /></div>` : "";
        return `<div class="wt-icon-item">${iconEl}<h3 class="wt-icon-item-headline">${escHtml(item.headline || "")}</h3><p class="wt-icon-item-body">${escHtml(item.body || "")}</p></div>`;
      }).join("");
      return `<div class="wt-icon-row wt-icon-row--${cols}">${cards}</div>`;
    }
    case "author_bio": {
      const avatar = c.avatarUrl ? `<img src="${escAttr(c.avatarUrl)}" alt="${escAttr(c.name || "")}" class="wt-author-avatar" />` : "";
      const links = Array.isArray(c.links) ? c.links.map((l: any) => `<a href="${escAttr(l.url)}">${escHtml(l.label)}</a>`).join("") : "";
      return `<div class="wt-author">${avatar}<div class="wt-author-info"><p class="wt-author-name">${escHtml(c.name || "")}</p><p class="wt-author-bio">${escHtml(c.bio || "")}</p>${links ? `<div class="wt-author-links">${links}</div>` : ""}</div></div>`;
    }
    case "breadcrumb": {
      const items: Array<{ label: string; url: string }> = Array.isArray(c.items) ? c.items : [];
      const listItems = items.flatMap((item, i) => {
        const li = `<li class="wt-breadcrumb-item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="${escAttr(item.url)}" itemprop="item"><span itemprop="name">${escHtml(item.label)}</span></a><meta itemprop="position" content="${i + 1}" /></li>`;
        return i < items.length - 1 ? [li, `<li class="wt-breadcrumb-sep" aria-hidden="true">/</li>`] : [li];
      }).join("");
      const schema = safeJsonLd({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.label, item: item.url })),
      });
      return `<nav class="wt-breadcrumb" aria-label="Breadcrumb"><ol class="wt-breadcrumb-list" itemscope itemtype="https://schema.org/BreadcrumbList">${listItems}</ol></nav><script type="application/ld+json">${schema}</script>`;
    }
    case "related_content": {
      const cards = (Array.isArray(c.items) ? c.items : []).map((item: any) => {
        const img = item.image ? `<img src="${escAttr(item.image)}" alt="${escAttr(item.title || "")}" class="wt-related-card-img" loading="lazy" />` : "";
        return `<a href="${escAttr(item.url)}" class="wt-related-card">${img}<div class="wt-related-card-body">${item.contentType ? `<p class="wt-related-card-type">${escHtml(item.contentType)}</p>` : ""}<p class="wt-related-card-title">${escHtml(item.title || "")}</p></div></a>`;
      }).join("");
      return `<div class="wt-related"><p class="wt-related-label">Related</p><div class="wt-related-cards">${cards}</div></div>`;
    }

    default:
      return "";
  }
}

export function renderPageHtml(page: Page, baseUrl: string): string {
  const blocks: ContentBlock[] = Array.isArray(page.content_json)
    ? page.content_json
    : (page.content_json as any)?.blocks || [];

  const body = blocks
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(renderBlock)
    .join("\n");

  const canonical = page.canonical_url || `${baseUrl}/${page.slug}`;
  const ogTitle = page.og_title || page.title;
  const ogImage = page.og_image || page.featured_image || "";
  const schema = page.structured_data || buildDefaultSchema(page, baseUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(page.title)}</title>
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

  <script type="application/ld+json">${safeJsonLd(schema)}</script>

  <link rel="stylesheet" href="${baseUrl}/styles/wt-pages.css" />
  ${page.custom_css ? `<style>${page.custom_css}</style>` : ""}
</head>
<body class="wt-page wt-template-${escAttr(page.page_template || "default")}">
  <main class="wt-content">
    ${body}
  </main>
</body>
</html>`;
}

function buildDefaultSchema(page: Page, baseUrl: string): Record<string, any> {
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

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(str: string): string {
  return String(str)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
