import type { 
  User, InsertUser, ContentItem, InsertContentItem,
  ContentBlock, InsertContentBlock
} from "@shared/schema";
import type { IStorage } from "./storage";

export class MemoryStorage implements IStorage {
  private users: User[] = [];
  private contentItems: ContentItem[] = [];
  private contentBlocks: ContentBlock[] = [];
  private nextUserId = 1;
  private nextContentItemId = 1;
  private nextContentBlockId = 1;

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(u => u.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: String(this.nextUserId++),
      email: user.email,
      name: user.name,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      displayName: user.displayName || null,
      avatarUrl: user.avatarUrl || null,
      defaultTheme: user.defaultTheme || 'light',
      backgroundColor: user.backgroundColor || '#f0ebe7',
      initials: user.initials,
      role: user.role || 'editor',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.push(newUser);
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const userIndex = this.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error(`User with id ${id} not found`);
    }
    const user = this.users[userIndex];
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users[userIndex] = updatedUser;
    return updatedUser;
  }

  // Content Items
  async getContentItems(type?: string): Promise<ContentItem[]> {
    return type 
      ? this.contentItems.filter(item => item.type === type)
      : this.contentItems;
  }

  async getContentItem(id: number | string): Promise<ContentItem | null> {
    return this.contentItems.find(item => String(item.id) === String(id)) || null;
  }

  async findContentItemByTitleOrSlug(title: string, slug: string, type: string): Promise<ContentItem | undefined> {
    return this.contentItems.find(item => 
      item.type === type && (item.title === title || item.slug === slug)
    );
  }

  async generateUniqueSlug(baseSlug: string, type: string): Promise<string> {
    let counter = 1;
    let slug = baseSlug;
    while (true) {
      const existing = this.contentItems.find(item => item.type === type && item.slug === slug);
      if (!existing) return slug;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async createContentItem(item: InsertContentItem): Promise<ContentItem> {
    const newItem: ContentItem = {
      id: this.nextContentItemId++,
      ...item,
      content: item.content || null,
      contentHTML: item.contentHTML || null,
      metaDescription: item.metaDescription || null,
      primaryKeyword: item.primaryKeyword || null,
      supportingKeywords: item.supportingKeywords || null,
      featuredImage: item.featuredImage || null,
      tags: item.tags || null,
      scheduledPublishDate: item.scheduledPublishDate || null,
      publishedAt: item.publishedAt || null,
      framerCmsId: item.framerCmsId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contentItems.push(newItem);
    return newItem;
  }

  async updateContentItem(id: number | string, updates: Partial<InsertContentItem>): Promise<ContentItem> {
    const index = this.contentItems.findIndex(item => String(item.id) === String(id));
    if (index === -1) throw new Error(`Content item ${id} not found`);
    const updated = { ...this.contentItems[index], ...updates, updatedAt: new Date() };
    this.contentItems[index] = updated;
    return updated;
  }

  async deleteContentItem(id: number | string): Promise<void> {
    this.contentItems = this.contentItems.filter(item => String(item.id) !== String(id));
  }

  async publishContentItem(id: number | string): Promise<ContentItem> {
    return this.updateContentItem(id, { status: 'live', publishedAt: new Date() } as any);
  }

  async getScheduledContent(): Promise<ContentItem[]> {
    const now = new Date();
    return this.contentItems.filter(item => 
      item.status === 'scheduled' && item.scheduledPublishDate && item.scheduledPublishDate <= now
    );
  }

  // Content Blocks
  async getContentBlocks(contentItemId: number): Promise<ContentBlock[]> {
    return this.contentBlocks
      .filter(b => b.contentItemId === contentItemId)
      .sort((a, b) => a.order - b.order);
  }

  async createContentBlock(block: InsertContentBlock): Promise<ContentBlock> {
    const newBlock: ContentBlock = {
      id: this.nextContentBlockId++,
      ...block,
      createdAt: new Date(),
    };
    this.contentBlocks.push(newBlock);
    return newBlock;
  }

  async updateContentBlock(id: number, updates: Partial<InsertContentBlock>): Promise<ContentBlock> {
    const index = this.contentBlocks.findIndex(b => b.id === id);
    if (index === -1) throw new Error(`Content block ${id} not found`);
    const updated = { ...this.contentBlocks[index], ...updates };
    this.contentBlocks[index] = updated;
    return updated;
  }

  async deleteContentBlock(id: number): Promise<void> {
    this.contentBlocks = this.contentBlocks.filter(b => b.id !== id);
  }
}
