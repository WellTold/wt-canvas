
// Utility functions for Markdown to HTML conversion

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeHref(url: string): string {
  return url.replace(/"/g, "%22").replace(/'/g, "%27");
}

export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // Strip raw HTML tags first (XSS guard)
  let s = markdown.replace(/<[^>]*>/g, '');

  // Block-level patterns with safe escaping on captured groups
  s = s
    .replace(/^### (.*)$/gim, (_m, t) => `<h3>${escHtml(t)}</h3>`)
    .replace(/^## (.*)$/gim, (_m, t) => `<h2>${escHtml(t)}</h2>`)
    .replace(/^# (.*)$/gim, (_m, t) => `<h1>${escHtml(t)}</h1>`)
    .replace(/^> — (.+)$/gim, (_m, t) => `<cite>— ${escHtml(t)}</cite>`)
    .replace(/^> (.*)$/gim, (_m, t) => `<blockquote>${escHtml(t)}</blockquote>`)
    .replace(/^\- (.*)$/gim, (_m, t) => `<li>${escHtml(t)}</li>`)
    .replace(/^\d+\. (.*)$/gim, (_m, t) => `<li>${escHtml(t)}</li>`);

  // Inline: images before links (so ![...](...) is matched first)
  s = s
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g, (_m, alt, url) =>
      `<img src="${safeHref(url)}" alt="${escHtml(alt)}" loading="lazy" />`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, (_m, text, url) =>
      `<a href="${safeHref(url)}" rel="noopener">${escHtml(text)}</a>`)
    .replace(/\*\*(.*?)\*\*/gim, (_m, t) => `<strong>${escHtml(t)}</strong>`)
    .replace(/\*(.*?)\*/gim, (_m, t) => `<em>${escHtml(t)}</em>`);

  // Wrap list items in <ul>
  s = s.replace(/((?:<li>(?:.|\n)*?<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Paragraph conversion: blank-line separated blocks
  const BLOCK_START = /^<(h[1-6]|ul|blockquote|cite|img)/;
  const lines = s.split('\n');
  const out: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      if (buf.length) { out.push(`<p>${buf.join(' ')}</p>`); buf = []; }
    } else if (BLOCK_START.test(trimmed)) {
      if (buf.length) { out.push(`<p>${buf.join(' ')}</p>`); buf = []; }
      out.push(line);
    } else {
      buf.push(line);
    }
  }
  if (buf.length) out.push(`<p>${buf.join(' ')}</p>`);

  return out.join('\n').trim();
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let markdown = html
    .replace(/<h1>(.*?)<\/h1>/gim, '# $1')
    .replace(/<h2>(.*?)<\/h2>/gim, '## $1')
    .replace(/<h3>(.*?)<\/h3>/gim, '### $1')
    .replace(/<strong>(.*?)<\/strong>/gim, '**$1**')
    .replace(/<em>(.*?)<\/em>/gim, '*$1*')
    .replace(/<blockquote>(.*?)<\/blockquote>/gim, '> $1')
    .replace(/<ul>/gim, '')
    .replace(/<\/ul>/gim, '')
    .replace(/<li>(.*?)<\/li>/gim, '- $1')
    .replace(/<p>(.*?)<\/p>/gim, '$1\n\n')
    .replace(/<br>/gim, '\n')
    .replace(/<[^>]*>/g, '');

  return markdown.trim();
}
