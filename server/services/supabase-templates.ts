import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export const TEMPLATE_TYPES = [
  "blog_article",
  "landing_page",
  "lead_magnet",
  "email_campaign",
  "email_flow",
] as const;

export type TemplateType = typeof TEMPLATE_TYPES[number];

export const EMAIL_TEMPLATE_TYPES: TemplateType[] = ["email_campaign", "email_flow"];

export function isEmailTemplate(type: string): boolean {
  return EMAIL_TEMPLATE_TYPES.includes(type as TemplateType);
}

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  blog_article: "Blog Article",
  landing_page:  "Landing Page",
  lead_magnet:   "Lead Magnet",
  email_campaign: "Email Campaign",
  email_flow:    "Email Flow",
};

export interface EmailHeader {
  logoUrl: string;
  logoLink: string;
}

export interface EmailFooterSocialLink {
  platform: string;
  url: string;
}

export interface EmailFooter {
  address: string;
  unsubscribeLink: string;
  socialLinks: EmailFooterSocialLink[];
}

export interface Template {
  id: string;
  name: string;
  type: string;
  description: string | null;
  mood: string | null;
  system_prompt: string | null;
  user_prompt_addition: string | null;
  structure: any | null;
  sections: any | null;
  tags: string[] | null;
  preheader_text: string | null;
  email_header: EmailHeader | null;
  email_footer: EmailFooter | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateData {
  name: string;
  type: string;
  description?: string;
  mood?: string;
  system_prompt?: string;
  user_prompt_addition?: string;
  structure?: any;
  sections?: any;
  tags?: string[];
  preheader_text?: string;
  email_header?: EmailHeader;
  email_footer?: EmailFooter;
}

export interface UpdateTemplateData {
  name?: string;
  type?: string;
  description?: string;
  mood?: string;
  system_prompt?: string;
  user_prompt_addition?: string;
  structure?: any;
  sections?: any;
  tags?: string[];
  preheader_text?: string;
  email_header?: EmailHeader;
  email_footer?: EmailFooter;
}

export async function getAllTemplates(): Promise<Template[]> {
  try {
    console.log('🔍 Fetching all templates from Supabase...');
    
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching templates:', error);
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    console.log(`✅ Successfully fetched ${data?.length || 0} templates`);
    return data || [];
  } catch (error) {
    console.error('❌ Templates fetch error:', error);
    throw error;
  }
}

export async function getTemplatesByCategory(type: string): Promise<Template[]> {
  try {
    console.log(`🔍 Fetching templates for type: ${type}`);
    
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching templates by type:', error);
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    console.log(`✅ Successfully fetched ${data?.length || 0} templates for ${type}`);
    return data || [];
  } catch (error) {
    console.error('❌ Templates type fetch error:', error);
    throw error;
  }
}

export async function getTemplateById(id: string): Promise<Template | null> {
  try {
    console.log(`🔍 Fetching template by ID: ${id}`);
    
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('📄 Template not found');
        return null;
      }
      console.error('❌ Error fetching template:', error);
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    console.log('✅ Successfully fetched template');
    return data;
  } catch (error) {
    console.error('❌ Template fetch error:', error);
    throw error;
  }
}

export async function createTemplate(templateData: CreateTemplateData): Promise<Template> {
  try {
    console.log('📝 Creating new template:', templateData.name);
    
    // Build base row — only include email columns when they carry data so that
    // templates inserts don't fail on projects where the migration hasn't been
    // run yet (PostgREST rejects unknown column names in the payload).
    const baseRow: Record<string, unknown> = {
      name: templateData.name,
      type: templateData.type,
      description: templateData.description || null,
      mood: templateData.mood || null,
      system_prompt: templateData.system_prompt || null,
      user_prompt_addition: templateData.user_prompt_addition || null,
      structure: templateData.structure || null,
      sections: templateData.sections || null,
      tags: templateData.tags || null,
    };

    if (templateData.preheader_text !== undefined) baseRow.preheader_text = templateData.preheader_text || null;
    if (templateData.email_header   !== undefined) baseRow.email_header   = templateData.email_header   || null;
    if (templateData.email_footer   !== undefined) baseRow.email_footer   = templateData.email_footer   || null;

    const { data, error } = await supabase
      .from('templates')
      .insert([baseRow])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating template:', error);
      throw new Error(`Failed to create template: ${error.message}`);
    }

    console.log('✅ Template created successfully:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Template creation error:', error);
    throw error;
  }
}

export async function updateTemplate(id: string, updates: UpdateTemplateData): Promise<Template> {
  try {
    console.log(`📝 Updating template: ${id}`);
    
    const { data, error } = await supabase
      .from('templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating template:', error);
      throw new Error(`Failed to update template: ${error.message}`);
    }

    console.log('✅ Template updated successfully');
    return data;
  } catch (error) {
    console.error('❌ Template update error:', error);
    throw error;
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  try {
    console.log(`🗑️ Deleting template: ${id}`);
    
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting template:', error);
      throw new Error(`Failed to delete template: ${error.message}`);
    }

    console.log('✅ Template deleted successfully');
  } catch (error) {
    console.error('❌ Template deletion error:', error);
    throw error;
  }
}

export async function duplicateTemplate(id: string, newName: string): Promise<Template> {
  try {
    console.log(`📋 Duplicating template: ${id}`);
    
    // First get the original template
    const original = await getTemplateById(id);
    if (!original) {
      throw new Error('Template not found');
    }

    // Create a new template with the same structure
    const duplicateData: CreateTemplateData = {
      name: newName,
      type: original.type,
      description: original.description ? `Copy of ${original.description}` : undefined,
      system_prompt: original.system_prompt || undefined,
      user_prompt_addition: original.user_prompt_addition || undefined,
      structure: original.structure || undefined,
      sections: original.sections || undefined,
      tags: original.tags || undefined,
      preheader_text: original.preheader_text || undefined,
      email_header: original.email_header || undefined,
      email_footer: original.email_footer || undefined,
    };

    const newTemplate = await createTemplate(duplicateData);
    console.log('✅ Template duplicated successfully');
    return newTemplate;
  } catch (error) {
    console.error('❌ Template duplication error:', error);
    throw error;
  }
}