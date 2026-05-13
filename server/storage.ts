import {
  type User, type InsertUser, type ContentItem, type InsertContentItem,
  type ContentBlock, type InsertContentBlock, type BrandContext,
  type Keyword, type InsertKeyword,
  contentItems as localContentItemsTable,
  keywords as keywordsTable,
} from "@shared/schema";
import { createClient } from '@supabase/supabase-js';
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

function getAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for user management');
  }
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const EMAIL_TYPES = new Set([
  'email', 'email_campaign', 'email_flow', 'email_newsletter', 'email_sequence',
]);
function isEmailType(type: string): boolean {
  return EMAIL_TYPES.has(type) || type?.startsWith('email');
}

const WEBPAGE_CONTENT_TYPES = new Set(['blog_article', 'landing_page', 'lead_magnet']);
function isWebpageContentType(type: string): boolean {
  return WEBPAGE_CONTENT_TYPES.has(type);
}

function resolveContentType(type: string): string {
  if (type === 'blog') return 'blog_article';
  if (type === 'landing') return 'landing_page';
  return type;
}

function getWebpageTableName(contentType: string): string | null {
  if (contentType === 'blog_article') return 'blog_articles';
  if (contentType === 'landing_page') return 'landing_pages';
  if (contentType === 'lead_magnet') return 'lead_magnets';
  return null;
}

function supabaseLegacyRowToContentItem(item: any, contentType: string): ContentItem {
  let content: any;
  if (item.content_markdown) {
    content = item.content_markdown;
  } else if (item.content_json && Array.isArray(item.content_json) && item.content_json.length > 0) {
    content = item.content_json;
  } else if (item.content && Array.isArray(item.content) && item.content.length > 0) {
    content = item.content;
  } else {
    content = '';
  }
  return {
    id: item.id,
    title: item.title || 'Untitled',
    slug: item.slug || '',
    type: 'webpage',
    contentType,
    status: item.status || 'draft',
    approvalStatus: item.approval_status || 'pending',
    content,
    contentHTML: item.content_html || null,
    metaDescription: item.meta_description || null,
    primaryKeyword: item.focus_keyword || item.primary_keyword || null,
    supportingKeywords: item.supporting_keywords || null,
    featuredImage: item.featured_image || item.image_url || null,
    ogImage: item.og_image || null,
    ogTitle: item.og_title || null,
    canonicalUrl: item.canonical_url || null,
    pageTemplate: item.page_template || 'default',
    structuredData: item.structured_data || null,
    customCss: item.custom_css || null,
    redirectFrom: item.redirect_from || null,
    tags: item.tags || [],
    scheduledPublishDate: item.scheduled_publish_date ? new Date(item.scheduled_publish_date) : null,
    publishedAt: item.published_at ? new Date(item.published_at) : (item.publish_date ? new Date(item.publish_date) : null),
    framerCmsId: null,
    templateId: item.structured_data?._wt_template_id || null,
    markdownContent: item.content_markdown || null,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
    authorId: 'system',
  } as ContentItem;
}

async function findInWebpageTables(id: string): Promise<ContentItem | null> {
  const tables = [
    { table: 'blog_articles', contentType: 'blog_article' },
    { table: 'landing_pages', contentType: 'landing_page' },
    { table: 'lead_magnets', contentType: 'lead_magnet' },
  ] as const;
  for (const { table, contentType } of tables) {
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
    if (data && !error) return supabaseLegacyRowToContentItem(data, contentType);
  }
  return null;
}

function supabasePageRowToContentItem(item: any): ContentItem {
  let content: any;
  if (item.content_markdown) {
    content = item.content_markdown;
  } else if (item.content_json && Array.isArray(item.content_json) && item.content_json.length > 0) {
    content = item.content_json;
  } else if (item.content && Array.isArray(item.content) && item.content.length > 0) {
    content = item.content;
  } else {
    content = '';
  }

  return {
    id: item.id,
    title: item.title || 'Untitled',
    slug: item.slug || '',
    type: 'webpage',
    contentType: item.content_type,
    status: item.status || 'draft',
    approvalStatus: item.approval_status || 'pending',
    content,
    contentHTML: item.content_html || null,
    metaDescription: item.meta_description || null,
    primaryKeyword: item.focus_keyword || item.primary_keyword || null,
    supportingKeywords: item.supporting_keywords || null,
    featuredImage: item.featured_image || item.image_url || null,
    ogImage: item.og_image || null,
    ogTitle: item.og_title || null,
    canonicalUrl: item.canonical_url || null,
    pageTemplate: item.page_template || 'default',
    structuredData: item.structured_data || null,
    customCss: item.custom_css || null,
    redirectFrom: item.redirect_from || null,
    tags: item.tags || [],
    scheduledPublishDate: item.scheduled_publish_date ? new Date(item.scheduled_publish_date) : null,
    publishedAt: item.published_at ? new Date(item.published_at) : (item.publish_date ? new Date(item.publish_date) : null),
    framerCmsId: null,
    templateId: item.structured_data?._wt_template_id || null,
    markdownContent: item.content_markdown || null,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
    authorId: 'system',
  } as ContentItem;
}

function localRowToContentItem(row: typeof localContentItemsTable.$inferSelect): ContentItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: isEmailType(row.type) ? 'email' : row.type,
    contentType: row.type,
    status: row.status,
    approvalStatus: row.approvalStatus,
    content: row.content as any,
    contentHTML: row.contentHTML || null,
    metaDescription: row.metaDescription || null,
    primaryKeyword: row.primaryKeyword || null,
    supportingKeywords: row.supportingKeywords || null,
    featuredImage: row.featuredImage || null,
    ogImage: row.ogImage || null,
    ogTitle: row.ogTitle || null,
    canonicalUrl: row.canonicalUrl || null,
    pageTemplate: row.pageTemplate || 'default',
    structuredData: row.structuredData as any || null,
    customCss: row.customCss || null,
    redirectFrom: row.redirectFrom || null,
    tags: row.tags || [],
    scheduledPublishDate: row.scheduledPublishDate || null,
    publishedAt: row.publishedAt || null,
    framerCmsId: row.framerCmsId || null,
    templateId: row.templateId || null,
    klaviyoTemplateId: row.klaviyoTemplateId || null,
    klaviyoCampaignId: row.klaviyoCampaignId || null,
    keywordId: row.keywordId || null,
    markdownContent: row.markdownContent || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    authorId: row.authorId,
  };
}

function supabaseUserToUser(supabaseUser: any, profile?: any): User {
  const metadata = supabaseUser.user_metadata || {};
  const p = profile || {};
  return {
    id: supabaseUser.id,
    email: p.email || supabaseUser.email || '',
    name: p.name || metadata.name || supabaseUser.email || '',
    firstName: p.first_name || metadata.firstName || null,
    lastName: p.last_name || metadata.lastName || null,
    displayName: p.display_name || metadata.displayName || null,
    avatarUrl: p.avatar_url || metadata.avatarUrl || null,
    defaultTheme: p.default_theme || metadata.defaultTheme || 'light',
    backgroundColor: p.background_color || metadata.backgroundColor || '#f0ebe7',
    initials: p.initials || metadata.initials || (supabaseUser.email || '').substring(0, 2).toUpperCase(),
    role: p.role || metadata.role || 'editor',
    createdAt: new Date(supabaseUser.created_at),
    updatedAt: new Date(p.updated_at || supabaseUser.updated_at || supabaseUser.created_at),
  };
}

async function getProfile(userId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

async function upsertProfile(userId: string, email: string, fields: Partial<User>): Promise<void> {
  try {
    await supabase.from('profiles').upsert({
      id: userId,
      email,
      name: fields.name || '',
      first_name: fields.firstName || null,
      last_name: fields.lastName || null,
      display_name: fields.displayName || null,
      avatar_url: fields.avatarUrl || null,
      initials: fields.initials || '',
      role: fields.role || 'editor',
      default_theme: fields.defaultTheme || 'light',
      background_color: fields.backgroundColor || '#f0ebe7',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch {
    // profiles table may not exist yet — non-fatal
  }
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User>;

  // Content Items
  getContentItems(type?: string): Promise<ContentItem[]>;
  getContentItem(id: number | string): Promise<ContentItem | null>;
  findContentItemByTitleOrSlug(title: string, slug: string, type: string): Promise<ContentItem | undefined>;
  generateUniqueSlug(baseSlug: string, type: string): Promise<string>;
  createContentItem(item: InsertContentItem): Promise<ContentItem>;
  updateContentItem(id: number | string, item: Partial<InsertContentItem>): Promise<ContentItem>;
  deleteContentItem(id: number | string): Promise<void>;
  publishContentItem(id: number | string): Promise<ContentItem>;
  getScheduledContent(): Promise<ContentItem[]>;

  // Content Blocks
  getContentBlocks(contentItemId: number): Promise<ContentBlock[]>;
  createContentBlock(block: InsertContentBlock): Promise<ContentBlock>;
  updateContentBlock(id: number, block: Partial<InsertContentBlock>): Promise<ContentBlock>;
  deleteContentBlock(id: number): Promise<void>;

  // Media is handled by Cloudinary API directly
  // Folders are discovered dynamically from Cloudinary

  // Brand Context
  getBrandContext(): Promise<BrandContext | null>;
  updateBrandContext(context: Partial<BrandContext>): Promise<BrandContext>;

  // Keywords
  getKeywords(filters?: { cluster?: string; type?: string; status?: string }): Promise<Keyword[]>;
  getKeyword(id: number): Promise<Keyword | null>;
  getKeywordByContentItemId(contentItemId: string): Promise<Keyword | null>;
  getKeywordsByContentItemId(contentItemId: string): Promise<Keyword[]>;
  releaseKeywordsByContentItemId(contentItemId: string): Promise<number>;
  createKeyword(keyword: InsertKeyword): Promise<Keyword>;
  createKeywordsBulk(keywords: InsertKeyword[]): Promise<Keyword[]>;
  updateKeyword(id: number, keyword: Partial<InsertKeyword>): Promise<Keyword>;
  deleteKeyword(id: number): Promise<void>;
}

import { MemoryStorage } from "./memory-storage";

export class DatabaseStorage implements IStorage {
  // Users — backed by Supabase profiles table (primary) + auth.users (fallback)
  async getUser(id: string): Promise<User | undefined> {
    try {
      const admin = getAdminClient();
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data.user) return undefined;
      const profile = await getProfile(id);
      return supabaseUserToUser(data.user, profile);
    } catch {
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      // Try profiles table first (faster — no need to list all users)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (profileData) {
        // We have profile data but still need auth.user for createdAt etc.
        const admin = getAdminClient();
        const { data, error } = await admin.auth.admin.getUserById(profileData.id);
        if (!error && data.user) return supabaseUserToUser(data.user, profileData);
      }

      // Fallback: search via auth admin API
      const admin = getAdminClient();
      const { data, error } = await admin.auth.admin.listUsers();
      if (error || !data.users) return undefined;
      const found = data.users.find((u: any) => u.email === email);
      if (!found) return undefined;
      const profile = await getProfile(found.id);
      return supabaseUserToUser(found, profile);
    } catch {
      return undefined;
    }
  }

  async createUser(_user: InsertUser): Promise<User> {
    throw new Error('Use seedUsers() to create users via Supabase Admin API');
  }

  async updateUser(id: string, user: Partial<User>): Promise<User> {
    const admin = getAdminClient();
    // Update auth.users user_metadata (for backward compat)
    const { data, error } = await admin.auth.admin.updateUserById(id, {
      user_metadata: {
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        defaultTheme: user.defaultTheme,
        backgroundColor: user.backgroundColor,
        initials: user.initials,
        role: user.role,
      }
    });
    if (error || !data.user) throw new Error(`Failed to update user: ${error?.message}`);
    // Also upsert to profiles table
    await upsertProfile(id, data.user.email || '', user);
    const profile = await getProfile(id);
    return supabaseUserToUser(data.user, profile);
  }

  // Content Items - email → local PG, web pages → Supabase legacy tables
  async getContentItems(type?: string): Promise<ContentItem[]> {
    const resolvedType = type ? resolveContentType(type) : undefined;

    // Email types → local PostgreSQL
    if (resolvedType && isEmailType(resolvedType)) {
      const isGenericEmail = resolvedType === 'email';
      const rows = isGenericEmail
        ? await db.select().from(localContentItemsTable)
            .orderBy(desc(localContentItemsTable.updatedAt))
        : await db.select().from(localContentItemsTable)
            .where(eq(localContentItemsTable.type, resolvedType))
            .orderBy(desc(localContentItemsTable.updatedAt));
      return rows.map(localRowToContentItem);
    }

    // Webpage subtypes → respective Supabase tables
    const WEBPAGE_TABLES = [
      { table: 'blog_articles', contentType: 'blog_article' },
      { table: 'landing_pages', contentType: 'landing_page' },
      { table: 'lead_magnets', contentType: 'lead_magnet' },
    ] as const;

    if (resolvedType && isWebpageContentType(resolvedType)) {
      const tableName = getWebpageTableName(resolvedType)!;
      const { data, error } = await supabase
        .from(tableName).select('*').order('updated_at', { ascending: false });
      if (error) { console.error(`❌ Error fetching from ${tableName}:`, error); return []; }
      return (data || []).map(item => supabaseLegacyRowToContentItem(item, resolvedType));
    }

    // No type filter (or 'webpage') — fetch from all 3 tables and merge
    const results: ContentItem[] = [];
    for (const { table, contentType } of WEBPAGE_TABLES) {
      const { data, error } = await supabase
        .from(table).select('*').order('updated_at', { ascending: false });
      if (error) { console.error(`❌ Error fetching from ${table}:`, error); continue; }
      for (const item of data || []) results.push(supabaseLegacyRowToContentItem(item, contentType));
    }
    return results.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }

  async getContentItem(id: number | string): Promise<ContentItem | null> {
    console.log(`🔍 DatabaseStorage.getContentItem called with ID: ${id}`);

    // Integer ID → local PostgreSQL (email content)
    const numId = parseInt(String(id));
    if (!isNaN(numId) && String(id) === String(numId)) {
      const [row] = await db.select().from(localContentItemsTable)
        .where(eq(localContentItemsTable.id, numId))
        .limit(1);
      if (row) {
        console.log(`✅ Found content item in local PG: ${row.title}`);
        return localRowToContentItem(row);
      }
      console.log(`❌ Content item not found for integer ID: ${id}`);
      return null;
    }

    // UUID → search across the 3 Supabase webpage tables
    const found = await findInWebpageTables(String(id));
    if (found) {
      console.log(`✅ Found content item in Supabase: ${found.title}`);
      return found;
    }

    console.log(`❌ Content item not found for ID: ${id}`);
    return null;
  }

  async findContentItemByTitleOrSlug(title: string, slug: string, type: string): Promise<ContentItem | undefined> {
    type = resolveContentType(type);
    if (isEmailType(type)) return undefined;

    const tableName = getWebpageTableName(type);
    if (!tableName) return undefined;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .or(`title.eq.${title},slug.eq.${slug}`)
      .limit(1)
      .single();

    if (error || !data) return undefined;
    return supabaseLegacyRowToContentItem(data, type);
  }

  async generateUniqueSlug(baseSlug: string, type: string): Promise<string> {
    type = resolveContentType(type);
    if (isEmailType(type)) return baseSlug;

    const tableName = getWebpageTableName(type);
    if (!tableName) return baseSlug;

    let counter = 1;
    let slug = baseSlug;
    while (true) {
      const { data, error } = await supabase
        .from(tableName).select('id').eq('slug', slug).limit(1);
      if (error || !data || data.length === 0) return slug;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async createContentItem(item: InsertContentItem): Promise<ContentItem> {
    // Resolve the actual content subtype
    const rawContentType = (item as any).contentType || item.type;
    const contentType = resolveContentType(
      rawContentType === 'webpage' || rawContentType === 'email'
        ? ((item as any).contentType || item.type)
        : rawContentType
    );
    item = { ...item, type: contentType };

    // Email types → local PostgreSQL
    if (isEmailType(contentType)) {
      const effectiveType = contentType === 'email' ? 'email_campaign' : contentType;
      const [row] = await db.insert(localContentItemsTable).values({
        title: item.title,
        slug: item.slug,
        type: effectiveType,
        status: item.status || 'draft',
        approvalStatus: item.approvalStatus || 'pending',
        content: (item.content as any) || null,
        metaDescription: item.metaDescription || null,
        primaryKeyword: item.primaryKeyword || null,
        supportingKeywords: item.supportingKeywords || null,
        featuredImage: item.featuredImage || null,
        ogImage: item.ogImage || null,
        ogTitle: item.ogTitle || null,
        canonicalUrl: item.canonicalUrl || null,
        pageTemplate: item.pageTemplate || 'default',
        structuredData: (item.structuredData as any) || null,
        customCss: item.customCss || null,
        redirectFrom: item.redirectFrom || null,
        tags: item.tags || null,
        scheduledPublishDate: item.scheduledPublishDate || null,
        templateId: (item as any).templateId || null,
        keywordId: (item as any).keywordId ?? null,
        authorId: item.authorId,
      }).returning();
      return localRowToContentItem(row);
    }

    const tableName = getWebpageTableName(contentType);
    if (!tableName) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    // Build row for the correct Supabase legacy table (no content_type column)
    const tableData: Record<string, any> = {
      title: item.title,
      slug: item.slug,
      meta_description: item.metaDescription || '',
      tags: item.tags || [],
      status: item.status || 'draft',
      approval_status: item.approvalStatus || 'pending',
      author_name: 'Well Told Team',
      publish_date: new Date().toISOString().split('T')[0],
      created_at: new Date(),
      updated_at: new Date(),
      focus_keyword: item.primaryKeyword || null,
      supporting_keywords: item.supportingKeywords || null,
      featured_image: item.featuredImage || null,
      scheduled_publish_date: item.scheduledPublishDate || null,
      og_image: item.ogImage || null,
      og_title: item.ogTitle || null,
      canonical_url: item.canonicalUrl || null,
      page_template: item.pageTemplate || 'default',
      structured_data: item.structuredData || null,
      custom_css: item.customCss || null,
      redirect_from: item.redirectFrom || null,
    };

    const incomingMarkdown = (item as any).markdownContent || (typeof item.content === 'string' ? item.content : null);

    if (incomingMarkdown) {
      // Markdown-backed web page (new flow)
      tableData.content_markdown = incomingMarkdown;
      tableData.content_html = item.contentHTML || null;
      tableData.content_json = [];
    } else if (Array.isArray(item.content)) {
      tableData.content_json = item.content.map((block: any, index: number): any => ({
        id: block.id || `block_${Date.now()}_${index}`,
        type: block.type || 'text',
        order: block.order !== undefined ? block.order : index,
        content: block.content || {},
      }));
      tableData.content_markdown = null;
      tableData.content_html = null;
    } else {
      tableData.content_json = [];
      tableData.content_markdown = null;
      tableData.content_html = null;
    }

    const result = await supabase.from(tableName).insert(tableData).select().single();

    if (result.error) {
      console.error('Supabase error:', JSON.stringify(result.error));
      const msg = result.error.message || JSON.stringify(result.error);
      throw new Error(`Failed to create content in ${tableName}: ${msg}`);
    }

    return supabaseLegacyRowToContentItem(result.data, contentType);
  }

  async updateContentItem(id: number | string, data: Partial<ContentItem>): Promise<ContentItem> {
    // Integer ID → email content in local PostgreSQL
    if (typeof id === 'number' || /^\d+$/.test(String(id))) {
      const numId = parseInt(String(id));
      const [existing] = await db.select().from(localContentItemsTable)
        .where(eq(localContentItemsTable.id, numId)).limit(1);
      if (!existing) throw new Error(`Content item not found: ${id}`);

      const updateObj: Record<string, any> = { updatedAt: new Date() };
      if (data.title !== undefined) updateObj.title = data.title;
      if (data.slug !== undefined) updateObj.slug = data.slug;
      if (data.status !== undefined) updateObj.status = data.status;
      if (data.approvalStatus !== undefined) updateObj.approvalStatus = data.approvalStatus;
      if (data.content !== undefined) updateObj.content = data.content;
      if (data.contentHTML !== undefined) updateObj.contentHTML = data.contentHTML;
      if (data.metaDescription !== undefined) updateObj.metaDescription = data.metaDescription;
      if (data.primaryKeyword !== undefined) updateObj.primaryKeyword = data.primaryKeyword;
      if (data.supportingKeywords !== undefined) updateObj.supportingKeywords = data.supportingKeywords;
      if (data.featuredImage !== undefined) updateObj.featuredImage = data.featuredImage;
      if (data.ogImage !== undefined) updateObj.ogImage = data.ogImage;
      if (data.ogTitle !== undefined) updateObj.ogTitle = data.ogTitle;
      if (data.canonicalUrl !== undefined) updateObj.canonicalUrl = data.canonicalUrl;
      if (data.pageTemplate !== undefined) updateObj.pageTemplate = data.pageTemplate;
      if (data.structuredData !== undefined) updateObj.structuredData = data.structuredData as any;
      if (data.customCss !== undefined) updateObj.customCss = data.customCss;
      if (data.redirectFrom !== undefined) updateObj.redirectFrom = data.redirectFrom;
      if (data.tags !== undefined) updateObj.tags = data.tags;
      if (data.scheduledPublishDate !== undefined) updateObj.scheduledPublishDate = data.scheduledPublishDate;
      if (data.templateId !== undefined) updateObj.templateId = data.templateId;
      if (data.klaviyoTemplateId !== undefined) updateObj.klaviyoTemplateId = data.klaviyoTemplateId;
      if (data.klaviyoCampaignId !== undefined) updateObj.klaviyoCampaignId = data.klaviyoCampaignId;
      if ((data as any).keywordId !== undefined) updateObj.keywordId = (data as any).keywordId;

      const [updated] = await db.update(localContentItemsTable)
        .set(updateObj)
        .where(eq(localContentItemsTable.id, numId))
        .returning();
      return localRowToContentItem(updated);
    }

    // UUID → webpage content in Supabase legacy tables
    // Determine which table by looking at the type in the update data, or fetching the item
    let tableName: string | null = null;
    const dataType = resolveContentType((data as any).type || (data as any).contentType || '');
    if (isWebpageContentType(dataType)) {
      tableName = getWebpageTableName(dataType);
    }
    if (!tableName) {
      // Fallback: find the item to know which table it's in
      const existing = await findInWebpageTables(String(id));
      if (existing?.contentType) tableName = getWebpageTableName(existing.contentType);
    }
    if (!tableName) throw new Error(`Cannot determine table for content item ${id}`);
    console.log(`📝 Updating ${tableName} item:`, id);

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.metaDescription !== undefined) updateData.meta_description = data.metaDescription;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.approvalStatus !== undefined) updateData.approval_status = data.approvalStatus;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.primaryKeyword !== undefined) updateData.focus_keyword = data.primaryKeyword;
    if (data.supportingKeywords !== undefined) updateData.supporting_keywords = data.supportingKeywords;
    if (data.featuredImage !== undefined) updateData.featured_image = data.featuredImage;
    if (data.scheduledPublishDate !== undefined) updateData.scheduled_publish_date = data.scheduledPublishDate;
    if (data.ogImage !== undefined) updateData.og_image = data.ogImage;
    if (data.ogTitle !== undefined) updateData.og_title = data.ogTitle;
    if (data.canonicalUrl !== undefined) updateData.canonical_url = data.canonicalUrl;
    if (data.pageTemplate !== undefined) updateData.page_template = data.pageTemplate;
    if (data.structuredData !== undefined) updateData.structured_data = data.structuredData;
    if (data.customCss !== undefined) updateData.custom_css = data.customCss;
    if (data.redirectFrom !== undefined) updateData.redirect_from = data.redirectFrom;

    if ((data as any).templateId !== undefined) {
      const existingSd = updateData.structured_data || {};
      updateData.structured_data = { ...existingSd, _wt_template_id: (data as any).templateId };
    }

    const markdownProvided = Object.prototype.hasOwnProperty.call(data, 'markdownContent');
    if (markdownProvided) {
      // Markdown-backed web page: persist markdown and clear block fields
      updateData.content_markdown = (data as any).markdownContent ?? null;
      updateData.content_json = [];
      updateData.content_html = null;
    }

    // Only process block content when markdownContent was NOT explicitly provided
    if (!markdownProvided && data.content !== undefined) {
      const COMPLEX_BLOCK_TYPES = new Set([
        'product_feature', 'product_row', 'promo_code', 'review',
        'gif_image', 'countdown_timer', 'progress_loyalty',
        'hero', 'two_column', 'accordion', 'banner', 'icon_text_row',
        'author_bio', 'breadcrumb', 'related_content',
        'divider', 'spacer', 'cta', 'quote',
        'shopify_product_card', 'shopify_product_grid',
        'shopify_collection_feature', 'shopify_variant_selector',
      ]);

      try {
        if (Array.isArray(data.content)) {
          const cleanedContent = data.content.map((block: any, index: number): any => {
            const plainBlock = {
              id: block.id || `block_${Date.now()}_${index}`,
              type: block.type || 'text',
              order: block.order !== undefined ? block.order : index,
              content: {} as Record<string, any>
            };

            if (block.content && typeof block.content === 'object') {
              if (COMPLEX_BLOCK_TYPES.has(block.type)) {
                plainBlock.content = { ...block.content };
              } else {
                const plainContent: Record<string, any> = {};
                const allowedProps = ['text', 'items', 'url', 'alt', 'caption', 'author', 'buttonText', 'link', 'level', 'ordered'];
                for (const prop of allowedProps) {
                  if (block.content[prop] !== undefined) {
                    if (prop === 'items' && Array.isArray(block.content[prop])) {
                      plainContent[prop] = [...block.content[prop]];
                    } else {
                      plainContent[prop] = block.content[prop];
                    }
                  }
                }
                plainBlock.content = plainContent;
              }
            } else if (typeof block.content === 'string') {
              plainBlock.content = { text: block.content };
            }

            if (!plainBlock.content || Object.keys(plainBlock.content as Record<string, any>).length === 0) {
              plainBlock.content = { text: '' };
            }

            return plainBlock;
          });

          updateData.content_json = cleanedContent;
          updateData.content_markdown = null;
          updateData.content_html = null;
        } else if (typeof data.content === 'string') {
          updateData.content_markdown = data.content;
          updateData.content_json = [];
          updateData.content_html = null;
        } else {
          updateData.content_json = [];
          updateData.content_markdown = null;
          updateData.content_html = null;
        }
      } catch (error) {
        console.error('❌ Error processing content for save:', error);
        updateData.content_json = [];
        updateData.content_markdown = null;
        updateData.content_html = null;
      }
    }

    const { data: item, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase error:', JSON.stringify(error));
      const msg = error.message || JSON.stringify(error);
      throw new Error(`Failed to update content in ${tableName}: ${msg}`);
    }

    if (!item) throw new Error('Content item not found in Supabase');

    // Derive contentType from the table name (reliable, no dependency on item.content_type column)
    const resolvedContentType = tableName === 'blog_articles' ? 'blog_article'
      : tableName === 'landing_pages' ? 'landing_page'
      : 'lead_magnet';
    console.log(`✅ ${tableName} update successful:`, item.title);
    return supabaseLegacyRowToContentItem(item, resolvedContentType);
  }

  async deleteContentItem(id: number | string): Promise<void> {
    const existingItem = await this.getContentItem(id);
    if (!existingItem) throw new Error(`Content item with id ${id} not found`);

    const subtype = existingItem.contentType || existingItem.type;
    if (isEmailType(subtype)) {
      await db.delete(localContentItemsTable).where(eq(localContentItemsTable.id, parseInt(String(id))));
      return;
    }

    const tableName = getWebpageTableName(subtype);
    if (!tableName) throw new Error(`Cannot determine table for content type: ${subtype}`);

    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) {
      console.error('Supabase error:', JSON.stringify(error));
      const msg = error.message || JSON.stringify(error);
      throw new Error(`Failed to delete content from ${tableName}: ${msg}`);
    }
  }

  async publishContentItem(id: number | string): Promise<ContentItem> {
    const existingItem = await this.getContentItem(id);
    if (!existingItem) throw new Error(`Content item with id ${id} not found`);

    const nowIso = new Date().toISOString();
    const subtype = existingItem.contentType || existingItem.type;

    if (isEmailType(subtype)) {
      const numId = parseInt(String(id));
      const [updated] = await db.update(localContentItemsTable)
        .set({ status: 'live', publishedAt: new Date(nowIso), updatedAt: new Date(nowIso) })
        .where(eq(localContentItemsTable.id, numId))
        .returning();
      return localRowToContentItem(updated);
    }

    const tableName = getWebpageTableName(subtype);
    if (!tableName) throw new Error(`Cannot determine table for content item ${id}`);

    const { data: result, error } = await supabase
      .from(tableName)
      .update({
        status: 'live',
        publish_date: nowIso.split('T')[0],
        published_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to publish content: ${error.message}`);

    return supabaseLegacyRowToContentItem(result, subtype);
  }

  async getScheduledContent(): Promise<ContentItem[]> {
    // For now, return empty array since scheduled publishing is not implemented in Supabase tables
    // You can implement this later if needed
    return [];
  }

  // Content Blocks - backed by Supabase content_blocks table
  async getContentBlocks(contentItemId: number): Promise<ContentBlock[]> {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('content_blocks')
      .select('*')
      .eq('content_item_id', contentItemId)
      .order('order', { ascending: true });
    if (error) throw new Error(`Failed to get content blocks: ${error.message}`);
    return (data || []).map((row: any) => ({
      id: row.id,
      contentItemId: row.content_item_id,
      type: row.type,
      content: row.content,
      order: row.order,
      createdAt: new Date(row.created_at),
    }));
  }

  async createContentBlock(block: InsertContentBlock): Promise<ContentBlock> {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('content_blocks')
      .insert({
        content_item_id: block.contentItemId,
        type: block.type,
        content: block.content,
        order: block.order ?? 0,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to create content block: ${error.message}`);
    return {
      id: data.id,
      contentItemId: data.content_item_id,
      type: data.type,
      content: data.content,
      order: data.order,
      createdAt: new Date(data.created_at),
    };
  }

  async updateContentBlock(id: number, block: Partial<InsertContentBlock>): Promise<ContentBlock> {
    const admin = getAdminClient();
    const updatePayload: any = {};
    if (block.type !== undefined) updatePayload.type = block.type;
    if (block.content !== undefined) updatePayload.content = block.content;
    if (block.order !== undefined) updatePayload.order = block.order;
    const { data, error } = await admin
      .from('content_blocks')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update content block: ${error.message}`);
    return {
      id: data.id,
      contentItemId: data.content_item_id,
      type: data.type,
      content: data.content,
      order: data.order,
      createdAt: new Date(data.created_at),
    };
  }

  async deleteContentBlock(id: number): Promise<void> {
    const admin = getAdminClient();
    const { error } = await admin.from('content_blocks').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete content block: ${error.message}`);
  }

  // Helper to transform Supabase content item to internal ContentItem format
  private transformSupabaseContentItem(item: any): ContentItem {
    let content = item.content_markdown;
    if (!content && item.content_json) {
      let contentArray = item.content_json;
      if (!Array.isArray(contentArray)) {
        contentArray = [];
      }
      content = contentArray;
    } else if (!content) {
      content = '';
    }

    return {
      id: item.id,
      title: item.title || 'Untitled',
      slug: item.slug || '',
      type: item.type || 'blog', // Default type if not specified
      status: item.status || 'draft',
      approvalStatus: item.approval_status || 'pending',
      content: content,
      contentHTML: item.content_html || null,
      metaDescription: item.meta_description || null,
      primaryKeyword: item.primary_keyword || null,
      supportingKeywords: item.supporting_keywords || null,
      featuredImage: item.featured_image || null,
      tags: item.tags || [],
      scheduledPublishDate: item.scheduled_publish_date ? new Date(item.scheduled_publish_date) : null,
      publishedAt: item.published_at ? new Date(item.published_at) : item.publish_date ? new Date(item.publish_date) : null,
      framerCmsId: null,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      authorId: item.author_id || 'system',
      ogImage: item.og_image || null,
      ogTitle: item.og_title || null,
      canonicalUrl: item.canonical_url || null,
      pageTemplate: item.page_template || 'default',
      structuredData: item.structured_data || null,
      customCss: item.custom_css || null,
      redirectFrom: item.redirect_from || null,
    };
  }

  // Media and Folders are handled by Cloudinary API directly
  // No database storage needed for media assets or folders

  async getBrandContext(): Promise<BrandContext | null> {
    const { data, error } = await supabase
      .from('brand_context')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      voiceDocument: data.voice_document,
      avoidRules: data.avoid_rules,
      alwaysRules: data.always_rules,
      wordsWeUse: data.words_we_use,
      wordsWeAvoid: data.words_we_avoid,
      updatedAt: new Date(data.updated_at),
    };
  }

  async updateBrandContext(context: Partial<BrandContext>): Promise<BrandContext> {
    const updateData: any = {
      id: '00000000-0000-0000-0000-000000000001',
      updated_at: new Date().toISOString(),
    };

    if (context.voiceDocument !== undefined) updateData.voice_document = context.voiceDocument;
    if (context.avoidRules !== undefined) updateData.avoid_rules = context.avoidRules;
    if (context.alwaysRules !== undefined) updateData.always_rules = context.alwaysRules;
    if (context.wordsWeUse !== undefined) updateData.words_we_use = context.wordsWeUse;
    if (context.wordsWeAvoid !== undefined) updateData.words_we_avoid = context.wordsWeAvoid;

    const { data, error } = await supabase
      .from('brand_context')
      .upsert(updateData)
      .select()
      .single();

    if (error) throw new Error(`Failed to update brand context: ${error.message}`);

    return {
      id: data.id,
      voiceDocument: data.voice_document,
      avoidRules: data.avoid_rules,
      alwaysRules: data.always_rules,
      wordsWeUse: data.words_we_use,
      wordsWeAvoid: data.words_we_avoid,
      updatedAt: new Date(data.updated_at),
    };
  }

  async getKeywords(filters?: { cluster?: string; type?: string; status?: string }): Promise<Keyword[]> {
    let query = db.select().from(keywordsTable).$dynamic();
    const conditions = [];
    if (filters?.cluster) conditions.push(eq(keywordsTable.cluster, filters.cluster));
    if (filters?.type) conditions.push(eq(keywordsTable.type, filters.type));
    if (filters?.status) conditions.push(eq(keywordsTable.status, filters.status));
    if (conditions.length > 0) query = query.where(and(...conditions));
    return query.orderBy(desc(keywordsTable.createdAt));
  }

  async getKeyword(id: number): Promise<Keyword | null> {
    const [row] = await db.select().from(keywordsTable).where(eq(keywordsTable.id, id)).limit(1);
    return row ?? null;
  }

  async getKeywordByContentItemId(contentItemId: string): Promise<Keyword | null> {
    const [row] = await db.select().from(keywordsTable)
      .where(eq(keywordsTable.contentItemId, contentItemId))
      .limit(1);
    return row ?? null;
  }

  async getKeywordsByContentItemId(contentItemId: string): Promise<Keyword[]> {
    return db.select().from(keywordsTable)
      .where(eq(keywordsTable.contentItemId, contentItemId));
  }

  async createKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const [row] = await db.insert(keywordsTable).values(keyword).returning();
    return row;
  }

  async createKeywordsBulk(kws: InsertKeyword[]): Promise<Keyword[]> {
    if (kws.length === 0) return [];
    const rows = await db
      .insert(keywordsTable)
      .values(kws)
      .onConflictDoUpdate({
        target: keywordsTable.keyword,
        set: {
          type: sql`excluded.type`,
          volume: sql`excluded.volume`,
          kd: sql`excluded.kd`,
          articleAngle: sql`excluded.article_angle`,
          priority: sql`excluded.priority`,
          cluster: sql`excluded.cluster`,
          contentTypeTarget: sql`excluded.content_type_target`,
          status: sql`excluded.status`,
        },
      })
      .returning();
    return rows;
  }

  async releaseKeywordsByContentItemId(contentItemId: string): Promise<number> {
    const linked = await db
      .select()
      .from(keywordsTable)
      .where(eq(keywordsTable.contentItemId, contentItemId));
    if (linked.length === 0) return 0;
    let released = 0;
    for (const kw of linked) {
      const newStatus = kw.status === "in_progress" ? "untargeted" : kw.status;
      await db
        .update(keywordsTable)
        .set({ contentItemId: null, contentItemTitle: null, status: newStatus } as any)
        .where(eq(keywordsTable.id, kw.id));
      released++;
    }
    return released;
  }

  async updateKeyword(id: number, keyword: Partial<InsertKeyword>): Promise<Keyword> {
    const [row] = await db.update(keywordsTable).set(keyword).where(eq(keywordsTable.id, id)).returning();
    if (!row) throw new Error(`Keyword ${id} not found`);
    return row;
  }

  async deleteKeyword(id: number): Promise<void> {
    await db.delete(keywordsTable).where(eq(keywordsTable.id, id));
  }
}

// Create a storage instance - using DatabaseStorage with dual database setup
export const storage = new DatabaseStorage();