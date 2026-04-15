import { createClient } from '@supabase/supabase-js';
import type { ContentItem } from '@shared/schema';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export interface ContentBlock {
  type: 'heading' | 'paragraph' | 'image' | 'cta' | 'list' | 'quote';
  level?: number;
  text?: string;
  src?: string;
  alt?: string;
  caption?: string;
  url?: string;
  items?: string[];
}

export interface PublishContentOptions {
  title: string;
  content: ContentBlock[];
  slug: string;
  type: 'blog_article' | 'landing_page' | 'lead_magnet';
  excerpt?: string;
  author?: string;
  tags?: string[];
  headline?: string;
  subheadline?: string;
  cta_text?: string;
  cta_url?: string;
  description?: string;
  download_url?: string;
  image_url?: string;
}

export class SupabaseLegacyPublisher {
  public supabase = supabase;

  private tableForType(type: string): string {
    if (type === 'blog_article') return 'blog_articles';
    if (type === 'landing_page') return 'landing_pages';
    if (type === 'lead_magnet') return 'lead_magnets';
    throw new Error(`Unknown content type for Supabase table lookup: ${type}`);
  }

  async publish(contentItem: ContentItem): Promise<{ success: boolean; id: string; message: string; url: string }> {
    const nowIso = new Date().toISOString();
    const tableName = this.tableForType(contentItem.contentType || contentItem.type);
    const { data, error } = await supabase
      .from(tableName)
      .update({
        status: 'live',
        publish_date: nowIso.split('T')[0],
        published_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', contentItem.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to publish: ${error.message}`);

    return {
      success: true,
      id: data.id,
      message: 'Published successfully',
      url: `/${data.slug}`,
    };
  }

  async unpublish(contentItem: ContentItem): Promise<{ success: boolean; message: string }> {
    const tableName = this.tableForType(contentItem.contentType || contentItem.type);
    const { error } = await supabase
      .from(tableName)
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', contentItem.id);

    if (error) throw new Error(`Failed to unpublish: ${error.message}`);

    return { success: true, message: 'Unpublished successfully' };
  }

  async updateContent(id: string, content: Partial<PublishContentOptions>): Promise<{ success: boolean; id: string; message: string }> {
    const tableName = this.tableForType(content.type || 'blog_article');
    const updateData: any = {};
    if (content.title) updateData.title = content.title;
    if (content.content) updateData.content_json = content.content;
    if (content.excerpt) updateData.meta_description = content.excerpt;
    if (content.description) updateData.meta_description = content.description;
    if (content.author) updateData.author_name = content.author;
    if (content.tags) updateData.tags = content.tags;

    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update content: ${error.message}`);

    return { success: true, id: data.id, message: 'Content updated successfully' };
  }
}

export const supabaseLegacyPublisher = new SupabaseLegacyPublisher();
