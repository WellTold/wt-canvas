
// Utility functions for Markdown to HTML conversion
// Simple converter that handles basic Markdown formatting for Framer export

export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown
    // Convert headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // Convert bold text
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    
    // Convert italic text
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    
    // Convert blockquotes
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    
    // Convert unordered lists
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    
    // Convert numbered lists
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    
    // Convert line breaks to paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    
    // Wrap in paragraphs
    .replace(/^(?!<[h1-6]|<blockquote|<li)(.+)$/gim, '<p>$1</p>');

  // Wrap list items in ul tags
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  
  // Clean up extra paragraph tags around headers and other block elements
  html = html
    .replace(/<p>(<h[1-6]>.*<\/h[1-6]>)<\/p>/gim, '$1')
    .replace(/<p>(<blockquote>.*<\/blockquote>)<\/p>/gim, '$1')
    .replace(/<p>(<ul>.*<\/ul>)<\/p>/gim, '$1');

  return html.trim();
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let markdown = html
    // Convert headers
    .replace(/<h1>(.*?)<\/h1>/gim, '# $1')
    .replace(/<h2>(.*?)<\/h2>/gim, '## $1')
    .replace(/<h3>(.*?)<\/h3>/gim, '### $1')
    
    // Convert bold text
    .replace(/<strong>(.*?)<\/strong>/gim, '**$1**')
    
    // Convert italic text
    .replace(/<em>(.*?)<\/em>/gim, '*$1*')
    
    // Convert blockquotes
    .replace(/<blockquote>(.*?)<\/blockquote>/gim, '> $1')
    
    // Convert list items
    .replace(/<ul>/gim, '')
    .replace(/<\/ul>/gim, '')
    .replace(/<li>(.*?)<\/li>/gim, '- $1')
    
    // Convert paragraphs
    .replace(/<p>(.*?)<\/p>/gim, '$1\n\n')
    
    // Convert line breaks
    .replace(/<br>/gim, '\n')
    
    // Remove remaining HTML tags
    .replace(/<[^>]*>/g, '');

  return markdown.trim();
}
