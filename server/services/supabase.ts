import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set for content publishing');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Content block types for the content_json structure
export interface ContentBlock {
  type: 'heading' | 'paragraph' | 'image' | 'cta' | 'list' | 'quote';
  level?: number; // for headings
  text?: string; // for text content
  src?: string; // for images
  alt?: string; // for images  
  caption?: string; // for images
  url?: string; // for CTAs
  items?: string[]; // for lists
}

export interface PublishContentOptions {
  title: string;
  content: ContentBlock[]; // Changed from string to structured blocks
  slug: string;
  type: 'blog' | 'landing_page' | 'lead_magnet';
  
  // Blog-specific fields
  excerpt?: string;
  author?: string;
  tags?: string[];
  
  // Landing page-specific fields
  headline?: string;
  subheadline?: string;
  cta_text?: string;
  cta_url?: string;
  
  // Lead magnet-specific fields
  description?: string;
  download_url?: string;
  image_url?: string;
}

export class SupabasePublisher {
  async publishBlogPost(content: PublishContentOptions) {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .insert({
          title: content.title,
          slug: content.slug,
          excerpt: content.excerpt || '',
          content_json: content.content, // Array of content blocks
          author: content.author || 'Well Told Team',
          tags: content.tags || []
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to publish blog post: ${error.message}`);
      }

      return {
        success: true,
        id: data.id,
        message: 'Blog post published successfully',
        url: `/blog/${content.slug}`
      };
    } catch (error) {
      console.error('Supabase publish error:', error);
      throw error;
    }
  }

  async publishLandingPage(content: PublishContentOptions) {
    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .insert({
          title: content.title,
          slug: content.slug,
          headline: content.headline || content.title,
          subheadline: content.subheadline || '',
          content_json: content.content,
          cta_text: content.cta_text || 'Learn More',
          cta_url: content.cta_url || '#'
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to publish landing page: ${error.message}`);
      }

      return {
        success: true,
        id: data.id,
        message: 'Landing page published successfully',
        url: `/pages/${content.slug}`
      };
    } catch (error) {
      console.error('Supabase publish error:', error);
      throw error;
    }
  }

  async publishLeadMagnet(content: PublishContentOptions) {
    try {
      const { data, error } = await supabase
        .from('lead_magnets')
        .insert({
          title: content.title,
          slug: content.slug,
          description: content.description || '',
          download_url: content.download_url || '#',
          content_json: content.content,
          image_url: content.image_url || ''
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to publish lead magnet: ${error.message}`);
      }

      return {
        success: true,
        id: data.id,
        message: 'Lead magnet published successfully',
        url: `/resources/${content.slug}`
      };
    } catch (error) {
      console.error('Supabase publish error:', error);
      throw error;
    }
  }

  async updateContent(id: string, content: Partial<PublishContentOptions>, table: string) {
    try {
      const { data, error } = await supabase
        .from(table)
        .update({
          ...content,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update content: ${error.message}`);
      }

      return {
        success: true,
        id: data.id,
        message: 'Content updated successfully'
      };
    } catch (error) {
      console.error('Supabase update error:', error);
      throw error;
    }
  }

  async unpublishContent(id: string, table: string) {
    try {
      const { data, error } = await supabase
        .from(table)
        .update({
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to unpublish content: ${error.message}`);
      }

      return {
        success: true,
        message: 'Content unpublished successfully'
      };
    } catch (error) {
      console.error('Supabase unpublish error:', error);
      throw error;
    }
  }

  async getContentStatus(slug: string, table: string) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id, title, status, published_at')
        .eq('slug', slug)
        .single();

      if (error) {
        return { exists: false };
      }

      return {
        exists: true,
        id: data.id,
        title: data.title,
        status: data.status,
        publishedAt: data.published_at
      };
    } catch (error) {
      return { exists: false };
    }
  }
}

export const supabasePublisher = new SupabasePublisher();