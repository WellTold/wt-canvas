/**
 * emailToHtml.ts
 * MSO-safe, table-based HTML email renderer.
 * Works with all 7 email-only block types plus the shared base blocks.
 * Inline styles throughout — no external CSS dependencies.
 */

import type { EmailHeader, EmailFooter } from "../services/supabase-templates";
import { SNIPPET_MAP } from "../config/snippets";

// ─── helpers ─────────────────────────────────────────────────────────────────

type BlockBg = {
  color?: string;
  imageUrl?: string;
  imageSize?: string;
  fallbackColor?: string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
} | undefined;

type EmailBlock = { type: string; id?: string; content: any; _bg?: BlockBg };

function collectAllEmailBlocks(blocks: EmailBlock[]): EmailBlock[] {
  const result: EmailBlock[] = [];
  for (const block of blocks) {
    result.push(block);
    const c = block.content || {};
    for (const key of Object.keys(c)) {
      const val = c[key];
      if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0].type === "string") {
        result.push(...collectAllEmailBlocks(val as EmailBlock[]));
      }
    }
  }
  return result;
}

function esc(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stars(n: number): string {
  const filled = "★".repeat(Math.max(0, Math.min(5, n)));
  const empty  = "☆".repeat(5 - Math.max(0, Math.min(5, n)));
  return filled + empty;
}

// Wrapper table row at 600 px width — used by every block
// bg: optional BlockBackground for per-block background color/image/padding
function row(
  inner: string,
  bgColor = "#ffffff",
  defaultPadding = "20px 24px",
  bg?: BlockBg
): string {
  // Build padding string from individual bg padding fields if any are set
  const hasPadding = bg && (bg.paddingTop !== undefined || bg.paddingRight !== undefined || bg.paddingBottom !== undefined || bg.paddingLeft !== undefined);
  const padding = hasPadding
    ? `${bg!.paddingTop ?? 20}px ${bg!.paddingRight ?? 24}px ${bg!.paddingBottom ?? 20}px ${bg!.paddingLeft ?? 24}px`
    : defaultPadding;
  const rowBg = (bg?.color) || bgColor;
  const fallback = bg?.fallbackColor || "#ffffff";

  if (bg?.imageUrl) {
    const size = bg.imageSize === "contain" ? "contain" : "cover";
    // VML background for Outlook + CSS background-image for modern clients
    const vmlOpen = `<!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;"><v:fill type="frame" src="${esc(bg.imageUrl)}" color="${esc(fallback)}" /><v:textbox inset="0,0,0,0"><![endif]-->`;
    const vmlClose = `<!--[if gte mso 9]></v:textbox></v:rect><![endif]-->`;
    return /* html */`
<tr>
  <td align="center" style="padding:0;background-color:#f4f1ef;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-container" style="width:100%;max-width:600px;background-color:${esc(rowBg)};">
      <tr>
        <td style="padding:0;background-color:${esc(rowBg)};">
          ${vmlOpen}
          <div style="background-color:${esc(rowBg)};background-image:url('${esc(bg.imageUrl)}');background-size:${size};background-position:center;background-repeat:no-repeat;">
            <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-container" style="width:100%;max-width:600px;">
              <tr>
                <td style="padding:${padding};">
                  ${inner}
                </td>
              </tr>
            </table>
          </div>
          ${vmlClose}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
  }

  return /* html */`
<tr>
  <td align="center" style="padding:0;background-color:#f4f1ef;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-container" style="width:100%;max-width:600px;background-color:${rowBg};">
      <tr>
        <td style="padding:${padding};">
          ${inner}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

// ─── text-style helper ────────────────────────────────────────────────────────

const EMAIL_FONT_SIZES: Record<string, string> = {
  sm: "12px", md: "14px", lg: "16px", xl: "20px",
  "2xl": "24px", "3xl": "32px", "4xl": "40px",
};

/** Resolve a fontSize value — named key, raw number, or "Npx" string */
function resolveFontSize(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (EMAIL_FONT_SIZES[value]) return EMAIL_FONT_SIZES[value];
  // Strip trailing "px" if present, then treat as raw px number
  const n = parseFloat(value.replace(/px$/i, ""));
  if (!isNaN(n) && n > 0) return `${n}px`;
  return fallback;
}

/** Build inline CSS string from the block's text-style content fields */
function textStyle(
  c: any,
  defaults: { color: string; fontSize: string; fontWeight: string; fontFamily: string; lineHeight: string }
): string {
  const parts: string[] = [
    `font-family:${(c.fontFamily || defaults.fontFamily).replace(/"/g, "'")}`,
    `font-size:${resolveFontSize(c.fontSize, defaults.fontSize)}`,
    `line-height:${defaults.lineHeight}`,
    `color:${c.textColor || defaults.color}`,
    `font-weight:${c.fontWeight || defaults.fontWeight}`,
  ];
  if (c.textAlign) parts.push(`text-align:${c.textAlign}`);
  if (c.fontStyle && c.fontStyle !== "normal") parts.push(`font-style:${c.fontStyle}`);
  if (c.textDecoration && c.textDecoration !== "none") parts.push(`text-decoration:${c.textDecoration}`);
  if (c.textTransform && c.textTransform !== "none") parts.push(`text-transform:${c.textTransform}`);
  if (c.opacity !== undefined && c.opacity !== 100) parts.push(`opacity:${Number(c.opacity) / 100}`);
  return parts.join(";");
}

// Known Google Font names (for injecting <link> tags into the email head)
const KNOWN_GOOGLE_FONTS = new Set([
  "Barlow","Bricolage Grotesque","Cabin","Cormorant Garamond","Crimson Text",
  "DM Sans","EB Garamond","Exo 2","Figtree","Inter","Josefin Sans","Jost",
  "Karla","Lato","Libre Baskerville","Manrope","Merriweather","Montserrat",
  "Mulish","Noto Sans","Nunito","Open Sans","Oswald","Playfair Display",
  "Plus Jakarta Sans","Poppins","PT Sans","Quicksand","Raleway","Roboto",
  "Source Sans Pro","Space Grotesk","Tenor Sans","Ubuntu","Work Sans",
]);

/** Extract the primary font name from a CSS font-family value. */
function extractFontName(css: string): string {
  const first = css.split(",")[0].trim().replace(/^["']|["']$/g, "");
  return first;
}

/** Collect all unique Google Font names referenced in a block tree. */
function collectGoogleFonts(blocks: EmailBlock[]): string[] {
  const found = new Set<string>();
  for (const block of collectAllEmailBlocks(blocks)) {
    const c = block.content || {};
    if (c.fontFamily) {
      const name = extractFontName(c.fontFamily);
      if (KNOWN_GOOGLE_FONTS.has(name)) found.add(name);
    }
  }
  return [...found];
}

/** Build Google Fonts <link> tags for the email head. */
function buildGoogleFontLinks(fontNames: string[]): string {
  if (fontNames.length === 0) return "";
  return fontNames
    .map((name) => {
      const encoded = encodeURIComponent(name);
      return `  <link href="https://fonts.googleapis.com/css2?family=${encoded}:wght@400;600;700&amp;display=swap" rel="stylesheet" type="text/css" />`;
    })
    .join("\n");
}

// ─── block renderers ──────────────────────────────────────────────────────────

function renderHeading(c: any, bg?: BlockBg): string {
  const rawLevel = Number(c.level) || 2;
  const level: 1 | 2 | 3 = rawLevel <= 1 ? 1 : rawLevel >= 3 ? 3 : 2;
  const defaultSizes: Record<1 | 2 | 3, string> = { 1: "28px", 2: "22px", 3: "18px" };
  const tags: Record<1 | 2 | 3, string> = { 1: "h1", 2: "h2", 3: "h3" };
  const tag = tags[level];
  const style = textStyle(c, {
    color: "#1a1a1a", fontSize: defaultSizes[level],
    fontWeight: "bold", fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", lineHeight: "1.3",
  });
  const bgColor = c.backgroundColor || "#ffffff";
  // If rich HTML is stored, strip outer <p> wrappers and convert paragraph breaks to <br>
  const headingContent = c.html
    ? c.html.replace(/<\/p>\s*<p>/g, "<br>").replace(/^<p>/, "").replace(/<\/p>$/, "")
    : esc(c.text);
  return row(`<${tag} style="margin:0;${style}">${headingContent}</${tag}>`, bgColor, "20px 24px", bg);
}

function renderParagraph(c: any, bg?: BlockBg): string {
  const style = textStyle(c, {
    color: "#333333", fontSize: "15px",
    fontWeight: "normal", fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", lineHeight: "1.7",
  });
  const bgColor = c.backgroundColor || "#ffffff";

  // Width constraint
  const widthMode: string = c.widthMode || "full";
  const customWidth: number = Number(c.customWidth) || 0;
  let widthCss = "";
  if (widthMode === "px" && customWidth > 0) {
    widthCss = `max-width:${Math.min(customWidth, 552)}px;margin-left:auto;margin-right:auto;`;
  } else if (widthMode === "percent" && customWidth > 0) {
    widthCss = `max-width:${customWidth}%;margin-left:auto;margin-right:auto;`;
  }

  // Min height (vertically centers content via table)
  const minH = c.minHeight ? parseInt(c.minHeight) : 0;

  const textEl = c.html
    ? `<div style="margin:0;${style}${widthCss}">${c.html}</div>`
    : `<p style="margin:0;${style}${widthCss}">${esc(c.text)}</p>`;

  const inner = minH > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="min-height:${minH}px;height:${minH}px;vertical-align:middle;">${textEl}</td></tr></table>`
    : textEl;

  return row(inner, bgColor, "20px 24px", bg);
}

function renderImage(c: any, bg?: BlockBg): string {
  // Accept url, src, or imageUrl — different block types use different field names
  const src = c.url || c.src || c.imageUrl || "";
  if (!src) {
    // Visible placeholder so the block doesn't silently disappear
    return row(
      `<div style="background:#f0ebe7;border:2px dashed #c8bfb8;padding:32px 24px;text-align:center;color:#a09080;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;">[ No image selected ]</div>`,
      "#ffffff", "8px 24px", bg
    );
  }
  // Compute width from widthMode
  const widthMode: string = c.widthMode || "full";
  const customWidth: number = Number(c.customWidth) || 0;
  let imgWidth: number;
  if (widthMode === "px") {
    imgWidth = Math.min(customWidth || 552, 552);
  } else if (widthMode === "percent") {
    imgWidth = Math.round(552 * (customWidth || 100) / 100);
  } else {
    imgWidth = 552;
  }
  const align: string = c.align || "center";
  const alignStyle = align === "left" ? "text-align:left;" : align === "right" ? "text-align:right;" : "text-align:center;";
  const isFullWidth = widthMode === "full";
  const customHeight: number = Number(c.customHeight) || 0;
  const heightCss = customHeight > 0 ? `height:${customHeight}px;object-fit:cover;` : "height:auto;";
  const imgStyle = isFullWidth
    ? `display:block;width:100%;${heightCss}border:0;`
    : `display:inline-block;width:${imgWidth}px;max-width:100%;${heightCss}border:0;`;
  const caption = c.caption
    ? `<p style="margin:8px 0 0;font-size:12px;color:#888888;font-family:'Plus Jakarta Sans',Arial,sans-serif;${alignStyle}">${esc(c.caption)}</p>`
    : "";
  const inner = isFullWidth
    ? `<img src="${esc(src)}" alt="${esc(c.alt || "")}" width="${imgWidth}" style="${imgStyle}" />${caption}`
    : `<div style="${alignStyle}"><img src="${esc(src)}" alt="${esc(c.alt || "")}" width="${imgWidth}" style="${imgStyle}" /></div>${caption}`;
  return row(inner, "#ffffff", isFullWidth ? "0" : "16px 24px", bg);
}

/** Hero block — full-width image with optional headline above or below */
function renderHero(c: any, bg?: BlockBg): string {
  const src      = c.imageUrl || c.url || c.src || "";
  const headline = c.text || c.headline || "";
  const subtext  = c.subtext || c.body || "";
  const above    = c.textPosition === "above";

  // Headline style
  const hs = c.headlineStyle || {};
  const headlineStyleStr = textStyle(hs, {
    fontSize: "28px", color: "#1a1a1a", fontWeight: "bold",
    fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", lineHeight: "1.25",
  });
  // Subtext style
  const ss = c.subtextStyle || {};
  const subtextStyleStr = textStyle(ss, {
    fontSize: "15px", color: "#555555", fontWeight: "normal",
    fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", lineHeight: "1.6",
  });

  const imgHtml = src
    ? `<img src="${esc(src)}" alt="${esc(c.alt || c.imageAlt || headline || "")}" width="600" style="display:block;width:100%;height:auto;border:0;" />`
    : `<div style="background:#f0ebe7;border:2px dashed #c8bfb8;padding:60px 24px;text-align:center;color:#a09080;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;">[ No hero image selected ]</div>`;

  const headlineHtml = headline
    ? `<h1 style="margin:0 0 ${subtext ? "10px" : "0"};${headlineStyleStr}">${esc(headline)}</h1>`
    : "";
  const subtextHtml = subtext
    ? `<p style="margin:0;${subtextStyleStr}">${esc(subtext)}</p>`
    : "";

  // Text section background and padding — _bg padding applies here
  const textBg = hs.backgroundColor || ss.backgroundColor || "#ffffff";
  const hasBgPadding = bg && (bg.paddingTop !== undefined || bg.paddingRight !== undefined || bg.paddingBottom !== undefined || bg.paddingLeft !== undefined);
  const textPadding = hasBgPadding
    ? `${bg!.paddingTop ?? 20}px ${bg!.paddingRight ?? 24}px ${bg!.paddingBottom ?? 20}px ${bg!.paddingLeft ?? 24}px`
    : "20px 24px";

  // Outer email-body background — use _bg.color only for the background strip, never white-pollutes the image row
  const outerBg = bg?.color || "#f4f1ef";

  // Single table, two rows — no inter-table gap in email clients
  const imgRow  = `<tr><td style="padding:0;font-size:0;line-height:0;">${imgHtml}</td></tr>`;
  const textRow = (headlineHtml || subtextHtml)
    ? `<tr><td style="padding:${textPadding};background-color:${textBg};">${headlineHtml}${subtextHtml}</td></tr>`
    : "";

  return `
<tr>
  <td align="center" style="padding:0;background-color:${outerBg};">
    <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-container" style="width:100%;max-width:600px;background-color:#ffffff;">
      ${above ? `${textRow}${imgRow}` : `${imgRow}${textRow}`}
    </table>
  </td>
</tr>`;
}

function renderBanner(c: any, bg?: BlockBg): string {
  const isCustom = c.style === "custom";
  const style = ["info", "sale", "warning"].includes(c.style) ? c.style : "info";
  const schemeBg:    Record<string, string> = { info: "#e8f0fe", sale: "#fef3c7", warning: "#fde8e8" };
  const schemeText:  Record<string, string> = { info: "#1a3a8f", sale: "#78350f", warning: "#7f1d1d" };
  const schemeBorder:Record<string, string> = { info: "#1a3a8f", sale: "#78350f", warning: "#7f1d1d" };
  const bannerBg     = isCustom ? (c.backgroundColor || "#f0ebe7") : schemeBg[style];
  const bannerColor  = isCustom ? (c.textColor       || "#1a1a1a") : schemeText[style];
  const bannerBorder = isCustom ? (c.textColor       || "#1a1a1a") : schemeBorder[style];
  const transform    = c.textTransform && c.textTransform !== "none" ? `text-transform:${c.textTransform};` : "";
  const textAlign    = c.textAlign || "center";
  const bannerFontSize   = resolveFontSize(c.fontSize, "15px");
  const bannerFontWeight = c.fontWeight && c.fontWeight !== "normal" ? c.fontWeight : "600";
  const link = c.link
    ? `<p style="margin:8px 0 0;text-align:${textAlign};"><a href="${esc(c.link)}" target="_blank" style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-weight:700;font-size:13px;color:${bannerColor};text-decoration:underline;">${esc(c.linkText || "Learn more")}</a></p>`
    : "";
  const bannerBaseStyle = `font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:${bannerFontSize};font-weight:${bannerFontWeight};color:${bannerColor};text-align:${textAlign};${transform}`;
  const inner = c.html
    ? `<div style="margin:0;${bannerBaseStyle}">${c.html}</div>${link}`
    : `<p style="margin:0;${bannerBaseStyle}">${esc(c.text || "")}</p>${link}`;
  // Outer wrapper: always use the email body background (#f4f1ef) — banner manages its own interior colour.
  // Only _bg padding is respected (not _bg colour) to avoid white outer gaps.
  const hasBgPadding = bg && (bg.paddingTop !== undefined || bg.paddingRight !== undefined || bg.paddingBottom !== undefined || bg.paddingLeft !== undefined);
  const outerPadding = hasBgPadding
    ? `${bg!.paddingTop ?? 0}px ${bg!.paddingRight ?? 0}px ${bg!.paddingBottom ?? 0}px ${bg!.paddingLeft ?? 0}px`
    : "0";
  return `
<tr>
  <td align="center" style="padding:${outerPadding};background-color:#f4f1ef;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-container" style="width:100%;max-width:600px;background-color:${bannerBg};border-top:2px solid ${bannerBorder};border-bottom:2px solid ${bannerBorder};">
      <tr>
        <td style="padding:14px 24px;">${inner}</td>
      </tr>
    </table>
  </td>
</tr>`;
}

function renderList(c: any, bg?: BlockBg): string {
  const items: string[] = Array.isArray(c.items) ? c.items : [];
  const listStyle = c.style || (c.ordered ? "numbered" : "bullet");
  const itemCss = textStyle(c, {
    color: "#333333", fontSize: "15px", fontWeight: "normal",
    fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", lineHeight: "1.7",
  });

  if (listStyle === "numbered") {
    const liHtml = items.map(
      (item) => `<li style="${itemCss};margin-bottom:6px;">${esc(item)}</li>`
    ).join("");
    return row(`<ol style="margin:0;padding-left:20px;">${liHtml}</ol>`, c.backgroundColor || "#ffffff", "20px 24px", bg);
  }

  const marker = listStyle === "check" ? "✓" : "•";
  const liHtml = items.map(
    (item) => `
      <tr>
        <td width="20" valign="top" style="${itemCss}">${marker}</td>
        <td valign="top" style="${itemCss};padding-bottom:6px;">${esc(item)}</td>
      </tr>`
  ).join("");

  return row(`<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">${liHtml}</table>`, c.backgroundColor || "#ffffff", "20px 24px", bg);
}

function renderQuote(c: any, bg?: BlockBg): string {
  const author = c.author || c.attribution;
  const quoteStyle = textStyle(c, {
    color: "#444444", fontSize: "17px", fontWeight: "normal",
    fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", lineHeight: "1.6",
  });
  const authorHtml = author
    ? `<p style="margin:10px 0 0;font-size:13px;color:#888888;font-family:'Plus Jakarta Sans',Arial,sans-serif;">— ${esc(author)}</p>`
    : "";
  const bgColor = c.backgroundColor || "#fdf8f4";
  const quoteBody = c.html
    ? `<div style="margin:0;font-style:italic;${quoteStyle}">${c.html}</div>`
    : `<p style="margin:0;font-style:italic;${quoteStyle}">${esc(c.text)}</p>`;
  return row(
    `<blockquote style="margin:0;padding:16px 20px;border-left:4px solid #c9b99a;background-color:${bgColor};">
       ${quoteBody}
       ${authorHtml}
     </blockquote>`,
    bgColor,
    "20px 24px",
    bg
  );
}

function renderCta(c: any, bg?: BlockBg): string {
  // Field mapping: c.text = button label, c.bodyText = paragraph above button
  const btnLabel   = esc(c.text || "");
  const link       = esc(c.link || "#");
  const btnColor   = c.buttonColor   || "#f15822";
  const btnTxtClr  = c.buttonTextColor || "#ffffff";
  const blockAlign = c.textAlign     || "center";

  // Button size → padding + approximate Outlook VML width
  const sizeMap: Record<string, string> = { sm: "10px 24px", md: "14px 32px", lg: "18px 40px" };
  const pad = sizeMap[c.buttonSize as string] || sizeMap.md;
  const vmlWidthMap: Record<string, number> = { sm: 160, md: 220, lg: 280 };
  const vmlWidth = vmlWidthMap[c.buttonSize as string] || vmlWidthMap.md;

  // Corner radius
  const radiusMap: Record<string, string> = { sharp: "0px", rounded: "4px", pill: "999px" };
  const radius = radiusMap[c.borderRadius as string] ?? "4px";

  // Button style: filled (default) | outline | ghost
  const btnStyle = (c.buttonStyle === "outline" || c.buttonStyle === "ghost") ? c.buttonStyle : "filled";

  // Drop shadow (applied to <a> tag — works in modern clients, no-op in Outlook)
  const shadow = c.dropShadow && btnStyle === "filled" ? "box-shadow:0 4px 12px rgba(0,0,0,0.20);" : "";

  // Per-style: td cell styles, anchor text color/decoration, VML attributes
  let tdStyle: string;
  let anchorColor: string;
  let anchorDecoration: string;
  let vmlFill: string;
  let vmlStroke: string;
  let vmlStrokeColor: string;

  if (btnStyle === "outline") {
    tdStyle = `background-color:transparent;border:2px solid ${btnColor};border-radius:${radius};mso-padding-alt:${pad};`;
    anchorColor = btnColor;
    anchorDecoration = "none";
    vmlFill = "f";
    vmlStroke = "t";
    vmlStrokeColor = ` strokecolor="${btnColor}"`;
  } else if (btnStyle === "ghost") {
    tdStyle = `background-color:transparent;border-radius:${radius};mso-padding-alt:${pad};`;
    anchorColor = btnColor;
    anchorDecoration = "underline";
    vmlFill = "f";
    vmlStroke = "f";
    vmlStrokeColor = "";
  } else {
    // filled
    tdStyle = `background-color:${btnColor};border-radius:${radius};mso-padding-alt:${pad};`;
    anchorColor = btnTxtClr;
    anchorDecoration = "none";
    vmlFill = "t";
    vmlStroke = "f";
    vmlStrokeColor = "";
  }

  // Body text above the button (uses textStyle for styling fields)
  const bodyStyle = textStyle(c, {
    color: "#333333", fontSize: "15px", fontWeight: "normal",
    fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", lineHeight: "1.7",
  });
  const bodyText = c.bodyText
    ? `<p style="margin:0 0 16px;${bodyStyle}">${esc(c.bodyText)}</p>`
    : "";

  // Button label typography — use text style fields from the editor, with sensible defaults
  // Sanitize font family: replace any double-quotes with single-quotes so they don't
  // break the surrounding style="..." HTML attribute and silently kill all inline styles.
  const rawFamily     = c.fontFamily || "'Plus Jakarta Sans',Arial,sans-serif";
  const btnFontFamily = rawFamily.replace(/"/g, "'");
  const btnFontSize   = resolveFontSize(c.fontSize, "15px");
  const btnFontWeight = c.fontWeight || "bold";
  const btnTransform  = c.textTransform && c.textTransform !== "none" ? `text-transform:${c.textTransform};` : "";
  const btnTextAlign  = blockAlign;

  // Bulletproof button — table-based so no email client can stretch it full-width
  const tableAlign = blockAlign === "left" ? "left" : blockAlign === "right" ? "right" : "center";
  const marginStyle = tableAlign === "center" ? "margin:0 auto;" : tableAlign === "right" ? "margin:0 0 0 auto;" : "margin:0;";

  // Core button table
  const btnTable = `<table cellpadding="0" cellspacing="0" border="0" align="${tableAlign}" style="${marginStyle}">
  <tr>
    <td align="center" style="${tdStyle}">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${link}" style="height:48px;v-text-anchor:middle;width:${vmlWidth}px;" arcsize="${radius === "999px" ? "50%" : "0%"}" filled="${vmlFill}" fillcolor="${btnColor}" stroke="${vmlStroke}"${vmlStrokeColor}><center style="color:${anchorColor};font-family:${btnFontFamily};font-size:${btnFontSize};font-weight:${btnFontWeight};${btnTransform}">${btnLabel}</center></v:roundrect><![endif]-->
      <!--[if !mso]><!--><a href="${link}" target="_blank" style="display:block;padding:${pad};font-family:${btnFontFamily};font-size:${btnFontSize};font-weight:${btnFontWeight};${btnTransform}color:${anchorColor};text-decoration:${anchorDecoration};text-align:${btnTextAlign};white-space:nowrap;border-radius:${radius};${shadow}">${btnLabel}</a><!--<![endif]-->
    </td>
  </tr>
</table>`;

  // Optional dotted ring — wraps the button table in an outer cell with a dotted border
  let buttonHtml: string;
  if (c.dottedBorder) {
    const ringColor = c.dottedBorderColor || btnColor;
    // Outer radius should be slightly larger than the button's own radius so the ring curves match
    const outerRadiusMap: Record<string, string> = { sharp: "0px", rounded: "8px", pill: "999px" };
    const outerRadius = outerRadiusMap[c.borderRadius as string] ?? "8px";
    buttonHtml = `<table cellpadding="0" cellspacing="0" border="0" align="${tableAlign}" style="${marginStyle}">
  <tr>
    <td style="border:2px dotted ${esc(ringColor)};padding:5px;border-radius:${outerRadius};">
      ${btnTable}
    </td>
  </tr>
</table>`;
  } else {
    buttonHtml = btnTable;
  }

  const inner = `${bodyText}${buttonHtml}`;
  const bgColor = c.backgroundColor || "#ffffff";
  return row(inner, bgColor, "20px 24px", bg);
}

function renderHtmlBlock(c: any, _bg?: BlockBg): string {
  // If a named snippet is selected, resolve it from the registry first
  if (c.snippetName && SNIPPET_MAP[c.snippetName]) {
    return SNIPPET_MAP[c.snippetName];
  }
  // Otherwise output the raw custom HTML as-is
  const html: string = c.html || c.rawHtml || "";
  return html;
}

function renderDivider(c: any, bg?: BlockBg): string {
  if (c.style === "space") {
    const h = Number(c.height) || 24;
    // Always use row() so _bg is applied even for spacer-style dividers
    return row(`<div style="height:${h}px;font-size:0;line-height:0;">&nbsp;</div>`, "#ffffff", "0", bg);
  }
  const color = c.color || "#e0d8d2";
  const height = Number(c.height) || 1;
  return row(`<hr style="border:none;border-top:${height}px solid ${esc(color)};margin:0;" />`, "#ffffff", "0 24px", bg);
}

function renderSpacer(c: any, bg?: BlockBg): string {
  const h = Math.max(8, Math.min(400, Number(c.height) || 40));
  return row(`<div style="height:${h}px;font-size:0;line-height:0;">&nbsp;</div>`, "#ffffff", "0", bg);
}

// ─── Email-only blocks ────────────────────────────────────────────────────────

function renderProductFeature(c: any, bg?: BlockBg): string {
  const img = c.imageUrl
    ? `<img src="${esc(c.imageUrl)}" alt="${esc(c.imageAlt || c.name)}" width="552" style="display:block;width:100%;height:auto;border:0;margin-bottom:16px;" />`
    : "";
  const price = c.price
    ? `<p style="margin:6px 0 12px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;font-weight:bold;color:#1a1a1a;">${esc(c.price)}</p>`
    : "";
  const desc = c.description
    ? `<p style="margin:4px 0 12px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;line-height:1.6;color:#555555;">${esc(c.description)}</p>`
    : "";
  const cta = (c.ctaText && c.ctaLink)
    ? `<a href="${esc(c.ctaLink)}" target="_blank" style="display:inline-block;padding:12px 28px;background-color:#1a1a1a;color:#ffffff;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;">${esc(c.ctaText)}</a>`
    : "";
  return row(
    `${img}
     <h3 style="margin:0 0 4px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:20px;color:#1a1a1a;">${esc(c.name)}</h3>
     ${price}${desc}${cta}`,
    "#ffffff",
    "20px 24px",
    bg
  );
}

function renderProductRow(c: any, bg?: BlockBg): string {
  const products: any[] = Array.isArray(c.products) ? c.products.slice(0, 3) : [];
  if (!products.length) return "";
  const colWidth = Math.floor(552 / products.length);
  const cols = products.map((p) => {
    const img = p.imageUrl
      ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="${colWidth}" style="display:block;width:100%;height:auto;border:0;margin-bottom:8px;" />`
      : "";
    const price = p.price ? `<p style="margin:2px 0 8px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;font-weight:bold;color:#1a1a1a;">${esc(p.price)}</p>` : "";
    const cta = (p.ctaText && p.ctaLink)
      ? `<a href="${esc(p.ctaLink)}" style="display:inline-block;padding:8px 16px;background:#1a1a1a;color:#fff;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:12px;font-weight:bold;text-decoration:none;">${esc(p.ctaText)}</a>`
      : "";
    return `<td width="${colWidth}" valign="top" style="padding:0 8px;text-align:center;">
      ${img}
      <p style="margin:0 0 4px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;font-weight:bold;color:#1a1a1a;">${esc(p.name)}</p>
      ${price}${cta}
    </td>`;
  }).join("");
  return row(
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
       <tr>${cols}</tr>
     </table>`,
    "#ffffff",
    "20px 16px",
    bg
  );
}

function renderPromoCode(c: any, bg?: BlockBg): string {
  const headline = c.headline
    ? `<p style="margin:0 0 12px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:18px;font-weight:bold;color:#1a1a1a;text-align:center;">${esc(c.headline)}</p>`
    : "";
  const expiry = c.expiry || c.expires;
  const expiryHtml = expiry
    ? `<p style="margin:10px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:12px;color:#888888;text-align:center;">Expires ${esc(expiry)}</p>`
    : "";
  const instructions = c.instructions
    ? `<p style="margin:8px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;color:#555555;text-align:center;">${esc(c.instructions)}</p>`
    : "";
  return row(
    `${headline}
     <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
       <tr>
         <td align="center">
           <p style="display:inline-block;margin:0;padding:14px 32px;font-family:'Courier New',monospace;font-size:22px;font-weight:bold;letter-spacing:4px;color:#1a1a1a;border:2px dashed #1a1a1a;background-color:#fdf8f4;">${esc(c.code)}</p>
         </td>
       </tr>
     </table>
     ${expiryHtml}${instructions}`,
    "#ffffff",
    "20px 24px",
    bg
  );
}

function renderReview(c: any, bg?: BlockBg): string {
  const rating = c.rating ? `<p style="margin:0 0 8px;font-size:20px;color:#c9a227;">${stars(c.rating)}</p>` : "";
  const author = c.author || "";
  const quote = c.quote || "";
  const avatar = c.avatarUrl
    ? `<img src="${esc(c.avatarUrl)}" alt="${esc(author)}" width="40" height="40" style="border-radius:50%;width:40px;height:40px;object-fit:cover;display:inline-block;vertical-align:middle;margin-right:10px;" />`
    : "";
  return row(
    `${rating}
     <p style="margin:0 0 12px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;line-height:1.6;color:#333333;font-style:italic;">"${esc(quote)}"</p>
     <p style="margin:0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;color:#888888;">${avatar}${esc(author)}</p>`,
    "#fdf8f4",
    "20px 24px",
    bg
  );
}

function renderGifImage(c: any, bg?: BlockBg): string {
  if (!c.url) return "";
  const width = c.width ? Math.min(552, Number(c.width)) : 552;
  const fallback = c.fallbackUrl || c.url;
  const alt = c.alt || "";
  return row(
    `<!--[if !mso]><!-->
     <img src="${esc(c.url)}" alt="${esc(alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;" />
     <!--<![endif]-->
     <!--[if mso]>
     <img src="${esc(fallback)}" alt="${esc(alt)}" width="${width}" style="display:block;width:${width}px;height:auto;border:0;" />
     <![endif]-->`,
    "#ffffff",
    "16px 24px",
    bg
  );
}

function renderCountdownTimer(c: any, bg?: BlockBg): string {
  const label = c.label || "Offer ends in";
  const deadline = c.deadline ? new Date(c.deadline) : null;
  const deadlineStr = deadline ? deadline.toLocaleString() : "soon";
  
  return row(
    `<div style="text-align:center;padding:20px;border:1px solid #e0d8d2;background-color:#fdf8f4;">
       <p style="margin:0 0 10px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;color:#666666;text-transform:uppercase;letter-spacing:1px;">${esc(label)}</p>
       <p style="margin:0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:24px;font-weight:bold;color:#1a1a1a;">${esc(deadlineStr)}</p>
     </div>`,
    "#fdf8f4",
    "20px 24px",
    bg
  );
}

function renderProgressLoyalty(c: any, bg?: BlockBg): string {
  const current = Math.max(0, Number(c.current) || 0);
  const goal    = Math.max(1, Number(c.goal)    || 100);
  const pct     = Math.round(Math.min(100, (current / goal) * 100));
  const color   = c.color || "#c9a227";
  const unit    = c.unit  || "";
  return row(
    `<p style="margin:0 0 8px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:15px;font-weight:bold;color:#1a1a1a;">${esc(c.label)}</p>
     <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border:1px solid #e0d9d0;border-radius:4px;overflow:hidden;height:24px;">
       <tr>
         <td width="${pct}%" style="background-color:${esc(color)};height:24px;font-size:12px;color:#fff;font-family:'Plus Jakarta Sans',Arial,sans-serif;padding:0 6px;vertical-align:middle;">${pct}%</td>
         <td style="background-color:#f4f1ef;height:24px;"></td>
       </tr>
     </table>
     <p style="margin:6px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;color:#666666;">${current}${unit} of ${goal}${unit}</p>`,
    "#ffffff",
    "20px 24px",
    bg
  );
}

// ─── header / footer / preheader ─────────────────────────────────────────────

function renderEmailHeader(header: EmailHeader): string {
  const logoHtml = header.logoUrl
    ? `<a href="${esc(header.logoLink || "#")}" target="_blank" style="display:block;text-align:center;">
         <img src="${esc(header.logoUrl)}" alt="Logo" height="50" style="display:inline-block;height:50px;width:auto;border:0;" />
       </a>`
    : "";
  return row(logoHtml, "#1a1a1a", "20px 24px");
}

function renderEmailFooter(footer: EmailFooter): string {
  const socials = (footer.socialLinks || [])
    .map((s) => `<a href="${esc(s.url)}" target="_blank" style="display:inline-block;margin:0 6px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;color:#888888;text-decoration:none;">${esc(s.platform)}</a>`)
    .join(" · ");

  const socialsHtml = socials
    ? `<p style="margin:0 0 8px;text-align:center;">${socials}</p>`
    : "";

  return row(
    `${socialsHtml}
     <p style="margin:0 0 6px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:12px;color:#aaaaaa;text-align:center;">${esc(footer.address)}</p>
     <p style="margin:0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:12px;color:#aaaaaa;text-align:center;">
       <a href="${esc(footer.unsubscribeLink)}" target="_blank" style="color:#aaaaaa;text-decoration:underline;">Unsubscribe</a>
     </p>`,
    "#1a1a1a",
    "20px 24px"
  );
}

// ─── Shopify email blocks ─────────────────────────────────────────────────────

function renderShopifyProductCard(c: any, product: any, siteBaseUrl?: string, bg?: BlockBg): string {
  if (!product) {
    return row(`<p style="margin:0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;color:#888888;">Shopify product: ${esc(c.productId || "")}</p>`, "#ffffff", "20px 24px", bg);
  }
  const link = sanitizeUrl(absoluteUrl(c.ctaLink || (product?.handle ? `/products/${product.handle}` : "#"), siteBaseUrl));
  const fmtPrice = (amount: string, code: string) => {
    const n = parseFloat(amount || "0");
    const sym = code === "GBP" ? "£" : code === "EUR" ? "€" : "$";
    return `${sym}${n.toFixed(2)}`;
  };
  const imgCell = product.imageUrl
    ? `<td width="220" valign="top" style="padding:0;">
         <a href="${esc(link)}" style="display:block;text-decoration:none;">
           <img src="${esc(product.imageUrl)}" alt="${esc(product.imageAlt || product.title)}" width="220" height="220" style="display:block;width:220px;height:220px;object-fit:cover;border:0;" />
         </a>
       </td>
       <td width="16" style="padding:0;font-size:0;line-height:0;">&nbsp;</td>`
    : "";
  const imgColWidth = product.imageUrl ? 236 : 0;
  const textColWidth = 552 - imgColWidth;
  const descHtml = c.showDescription !== false && product.description
    ? `<p style="margin:0 0 10px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;line-height:1.5;color:#555555;">${esc(product.description.slice(0, 120))}${product.description.length > 120 ? "…" : ""}</p>`
    : "";
  const priceHtml = c.showPrice !== false
    ? `<p style="margin:0 0 16px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;font-weight:bold;color:#1a1a1a;">${esc(fmtPrice(product.price, product.currencyCode))}</p>`
    : "";

  return row(
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
       <tr>
         ${imgCell}
         <td width="${textColWidth}" valign="top" style="padding:0;">
           <h3 style="margin:0 0 8px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:20px;line-height:1.3;color:#1a1a1a;">${esc(product.title)}</h3>
           ${descHtml}
           ${priceHtml}
           <a href="${esc(link)}" style="display:inline-block;padding:12px 28px;background-color:#1a1a1a;color:#ffffff;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.03em;">${esc(c.ctaText || "Shop Now")}</a>
         </td>
       </tr>
     </table>`,
    "#ffffff",
    "20px 24px",
    bg
  );
}

function renderShopifyCollectionFeature(c: any, collection: any, siteBaseUrl?: string, bg?: BlockBg): string {
  const style = c.style === "dark" ? "dark" : "light";
  const blockBgColor = style === "dark" ? "#1a1a1a" : "#f0ebe7";
  const txtColor = style === "dark" ? "#ffffff" : "#1a1a1a";
  const mutColor = style === "dark" ? "#cccccc" : "#555555";
  const imageUrl = c.imageUrl || collection?.imageUrl || "";
  const imageAlt = collection?.imageAlt || collection?.title || "";
  const headline = c.headline || collection?.title || "Shop the Collection";
  const subtext  = c.subtext  || collection?.description || "";
  const ctaText  = c.ctaText  || "Shop Now";
  const ctaLink  = sanitizeUrl(absoluteUrl(c.ctaLink || (collection?.handle ? `/collections/${collection.handle}` : "#"), siteBaseUrl));

  const imgHtml = imageUrl
    ? `<img src="${esc(imageUrl)}" alt="${esc(imageAlt)}" width="552" style="display:block;width:100%;height:auto;border:0;margin-bottom:20px;" />`
    : "";

  return row(
    `${imgHtml}
     <div style="text-align:center;">
       <h2 style="margin:0 0 12px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:26px;line-height:1.2;color:${txtColor};">${esc(headline)}</h2>
       ${subtext ? `<p style="margin:0 0 20px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:15px;line-height:1.6;color:${mutColor};">${esc(subtext)}</p>` : ""}
       <a href="${esc(ctaLink)}" style="display:inline-block;padding:14px 32px;background-color:${style === "dark" ? "#ffffff" : "#1a1a1a"};color:${style === "dark" ? "#1a1a1a" : "#ffffff"};font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.03em;">${esc(ctaText)}</a>
     </div>`,
    blockBgColor,
    "28px 24px",
    bg
  );
}

// ─── main export ─────────────────────────────────────────────────────────────

export interface EmailRenderOptions {
  preheaderText?: string | null;
  header?: EmailHeader | null;
  footer?: EmailFooter | null;
  title?: string;
  siteBaseUrl?: string;
}

/** Make a relative path absolute using siteBaseUrl; leaves absolute URLs and "#" unchanged. */
function absoluteUrl(path: string, baseUrl?: string): string {
  if (!path || path === "#" || path.startsWith("http")) return path;
  if (!baseUrl) return path;
  // Ensure the path always starts with "/" to avoid joining baseUrl and path without a separator
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl.replace(/\/$/, "")}${normalizedPath}`;
}

function sanitizeUrl(url: string): string {
  if (!url) return "#";
  const lower = url.trim().toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:")) return "#";
  return url;
}

export function renderBlockToEmailHtml(
  block: { type: string; id?: string; content: any; _bg?: BlockBg },
  shopifyData: Map<string, any> = new Map(),
  siteBaseUrl?: string
): string {
  const c = block.content || {};
  const raw = block._bg;
  const bg = raw && (raw.color || raw.imageUrl ||
    raw.paddingTop !== undefined || raw.paddingRight !== undefined ||
    raw.paddingBottom !== undefined || raw.paddingLeft !== undefined)
    ? raw : undefined;
  switch (block.type) {
    case "heading":       return renderHeading(c, bg);
    case "paragraph":
    case "text":          return renderParagraph(c, bg);
    case "image":         return renderImage(c, bg);
    case "hero":          return renderHero(c, bg);
    case "banner":        return renderBanner(c, bg);
    case "list":          return renderList(c, bg);
    case "quote":         return renderQuote(c, bg);
    case "cta":           return renderCta(c, bg);
    case "html_block":    return renderHtmlBlock(c, bg);
    case "divider":       return renderDivider(c, bg);
    case "spacer":        return renderSpacer(c, bg);
    // Email-only
    case "product_feature":   return renderProductFeature(c, bg);
    case "product_row":       return renderProductRow(c, bg);
    case "promo_code":        return renderPromoCode(c, bg);
    case "review":            return renderReview(c, bg);
    case "gif_image":         return renderGifImage(c, bg);
    case "countdown_timer":   return renderCountdownTimer(c, bg);
    case "progress_loyalty":  return renderProgressLoyalty(c, bg);
    // Shopify blocks — use pre-fetched data + absolute URLs for email
    case "shopify_product_card":
      return renderShopifyProductCard(c, block.id ? shopifyData.get(block.id) : null, siteBaseUrl, bg);
    case "shopify_collection_feature":
      return renderShopifyCollectionFeature(c, block.id ? shopifyData.get(block.id) : null, siteBaseUrl, bg);
    default:
      return "";
  }
}

type ShopifyFetcher = {
  fetchProduct: (id: string) => Promise<any>;
  fetchCollection: (id: string, count?: number) => Promise<any>;
} | null;

export async function renderEmailToHtml(
  blocks: Array<{ type: string; id?: string; content: any; _bg?: BlockBg }>,
  opts: EmailRenderOptions = {},
  shopifyFetcher: ShopifyFetcher = null
): Promise<string> {
  // Pre-fetch Shopify data with entity-level dedup: same product/collection fetched only once
  const shopifyData = new Map<string, any>();
  if (shopifyFetcher) {
    const shopifyBlocks = collectAllEmailBlocks(blocks).filter((b) => b.type === "shopify_product_card" || b.type === "shopify_collection_feature");
    // Step 1: build one promise per unique entity key
    const fetchCache = new Map<string, Promise<any>>();
    for (const block of shopifyBlocks) {
      if (!block.id) continue;
      const c = block.content || {};
      if (block.type === "shopify_product_card" && c.productId) {
        if (!fetchCache.has(c.productId)) {
          fetchCache.set(c.productId, shopifyFetcher.fetchProduct(c.productId).catch(() => null));
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
      if (!block.id) continue;
      const c = block.content || {};
      let result: any = null;
      if (block.type === "shopify_product_card" && c.productId) {
        result = (await fetchCache.get(c.productId)) ?? null;
      } else if (block.type === "shopify_collection_feature" && c.collectionId) {
        result = (await fetchCache.get(c.collectionId)) ?? null;
      }
      if (result) shopifyData.set(block.id, result);
    }
  }

  const preheader   = opts.preheaderText || "";
  const bodyRows    = blocks.map((b) => renderBlockToEmailHtml(b, shopifyData, opts.siteBaseUrl)).join("\n");
  const headerRow   = opts.header ? renderEmailHeader(opts.header) : "";
  const footerRow   = opts.footer ? renderEmailFooter(opts.footer) : "";
  const usedGFonts  = new Set(["Plus Jakarta Sans", ...collectGoogleFonts(blocks)]);
  const gFontLinks  = buildGoogleFontLinks([...usedGFonts]);

  return /* html */`<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${esc(opts.title || "Email Preview")}</title>
${gFontLinks ? `${gFontLinks}\n` : ""}  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
    body{margin:0;padding:0;background-color:#f4f1ef;}
    @media only screen and (max-width:640px){
      .email-container{width:100%!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f1ef;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f1ef;opacity:0;">${esc(preheader)}</div>

<!-- Email wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#f4f1ef;">
  ${headerRow}
  ${bodyRows}
  ${footerRow}
</table>

</body>
</html>`;
}
