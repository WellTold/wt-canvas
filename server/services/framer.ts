import { ContentItem } from "@shared/schema";

// Updated markdown to HTML conversion using a utility function
export function markdownToHTML(markdown: string): string {
  if (!markdown) return '';

  // Import the markdown conversion utility
  const { markdownToHtml } = require('../utils/markdown');
  return markdownToHtml(markdown);
}

interface FramerCMSItem {
  id: string;
  title: string;
  slug: string;
  content: any;
  metaDescription?: string;
  featuredImage?: string;
  publishedAt?: string;
  status: 'draft' | 'published';
}

interface FramerCMSResponse {
  items: FramerCMSItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export class FramerCMSService {
  private apiKey: string;
  private baseUrl = 'https://api.framer.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Framer API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Publish Blog Article to Framer CMS
  async publishBlogArticle(contentItem: ContentItem, blocks: any[], markdownContent?: string): Promise<string> {
    let content;
    if (markdownContent) {
      // Convert Markdown to HTML and use that for Framer
      content = markdownToHTML(markdownContent);
    } else {
      // Fallback to old block-based conversion
      content = this.convertBlocksToFramerContent(blocks);
    }

    const payload = {
      title: contentItem.title,
      slug: contentItem.slug,
      content: content,
      metaDescription: contentItem.metaDescription,
      featuredImage: contentItem.featuredImage,
      status: 'published',
      publishedAt: new Date().toISOString(),
    };

    const response = await this.makeRequest('/cms/collections/blog-articles/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.id;
  }

  // Publish Landing Page to Framer CMS
  async publishLandingPage(contentItem: ContentItem, blocks: any[], markdownContent?: string): Promise<string> {
    let content;
    if (markdownContent) {
      // Convert Markdown to HTML and use that for Framer
      content = markdownToHTML(markdownContent);
    } else {
      // Fallback to old block-based conversion
      content = this.convertBlocksToFramerContent(blocks);
    }

    const payload = {
      title: contentItem.title,
      slug: contentItem.slug,
      content: content,
      metaDescription: contentItem.metaDescription,
      featuredImage: contentItem.featuredImage,
      status: 'published',
      publishedAt: new Date().toISOString(),
    };

    const response = await this.makeRequest('/cms/collections/landing-pages/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.id;
  }

  // Publish Lead Magnet Page to Framer CMS
  async publishLeadMagnetPage(contentItem: ContentItem, blocks: any[], markdownContent?: string): Promise<string> {
    let content;
    if (markdownContent) {
      // Convert Markdown to HTML and use that for Framer
      content = markdownToHTML(markdownContent);
    } else {
      // Fallback to old block-based conversion
      content = this.convertBlocksToFramerContent(blocks);
    }

    const payload = {
      title: contentItem.title,
      slug: contentItem.slug,
      content: content,
      metaDescription: contentItem.metaDescription,
      featuredImage: contentItem.featuredImage,
      status: 'published',
      publishedAt: new Date().toISOString(),
    };

    const response = await this.makeRequest('/cms/collections/lead-magnet-pages/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.id;
  }

  // Update existing item in Framer CMS
  async updateCMSItem(collectionType: string, itemId: string, contentItem: ContentItem, blocks: any[], markdownContent?: string): Promise<void> {
    let content;
    if (markdownContent) {
      // Convert Markdown to HTML and use that for Framer
      content = markdownToHTML(markdownContent);
    } else {
      // Fallback to old block-based conversion
      content = this.convertBlocksToFramerContent(blocks);
    }

    const payload = {
      title: contentItem.title,
      slug: contentItem.slug,
      content: content,
      metaDescription: contentItem.metaDescription,
      featuredImage: contentItem.featuredImage,
      status: 'published',
      publishedAt: new Date().toISOString(),
    };

    const collectionName = this.getCollectionName(collectionType);
    await this.makeRequest(`/cms/collections/${collectionName}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // Delete item from Framer CMS
  async deleteCMSItem(collectionType: string, itemId: string): Promise<void> {
    const collectionName = this.getCollectionName(collectionType);
    await this.makeRequest(`/cms/collections/${collectionName}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Get items from Framer CMS collection
  async getCMSItems(collectionType: string, page = 1, pageSize = 50): Promise<FramerCMSResponse> {
    const collectionName = this.getCollectionName(collectionType);
    return this.makeRequest(`/cms/collections/${collectionName}/items?page=${page}&pageSize=${pageSize}`);
  }

  private getCollectionName(type: string): string {
    switch (type) {
      case 'blog':
      case 'blog_article':
        return 'blog-articles';
      case 'landing_page':
        return 'landing-pages';
      case 'lead_magnet':
        return 'lead-magnet-pages';
      default:
        throw new Error(`Unknown content type: ${type}`);
    }
  }

  private convertBlocksToFramerContent(blocks: any[]): any {
    // Convert WT Canvas content blocks to Framer CMS format
    return blocks.map(block => {
      switch (block.type) {
        case 'heading':
          return {
            type: 'heading',
            level: block.content.level || 2,
            text: block.content.text,
          };
        case 'text':
          return {
            type: 'paragraph',
            text: block.content.text,
          };
        case 'image':
          return {
            type: 'image',
            src: block.content.src,
            alt: block.content.alt,
            caption: block.content.caption,
          };
        case 'quote':
          return {
            type: 'blockquote',
            text: block.content.text,
            author: block.content.author,
          };
        case 'list':
          return {
            type: block.content.style === 'ordered' ? 'orderedList' : 'unorderedList',
            items: block.content.items,
          };
        case 'cta':
          return {
            type: 'callToAction',
            text: block.content.text,
            buttonText: block.content.buttonText,
            buttonUrl: block.content.buttonUrl,
          };
        default:
          return {
            type: 'paragraph',
            text: block.content.text || '',
          };
      }
    });
  }
}

// Create service instance
export const createFramerService = (apiKey: string) => new FramerCMSService(apiKey);