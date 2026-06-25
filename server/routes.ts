import type { Express } from "express";
import { createServer, type Server } from "http";
import { createClient } from "@supabase/supabase-js";
import { storage } from "./storage";
import { seedUsers } from "./services/auth";
import {
  insertContentItemSchema,
  insertContentBlockSchema,
  contentBlocks,
  contentItems,
  blockPresets,
  siteSettings,
  integrations,
  insertIntegrationSchema,
  emailStyles,
  insertEmailStyleSchema,
  insertKeywordSchema,
  imageTemplates,
  insertImageTemplateSchema,
  emailSnippets,
} from "@shared/schema";
import { SNIPPET_MAP } from "./config/snippets";
import { z } from "zod";
import {
  improveContent,
  refineContent,
  generateTitle,
  generateMetaDescription,
  generateSection,
  suggestKeywords,
  generateCompleteArticle,
  generateWebPageMarkdown,
  generateWebPageMarkdownContent,
  generateFAQ,
  generateCTAs,
  selectKeywordsForTopic,
  generateKeywordsForTopic,
  generatePhilosophyIntro,
} from "./services/claude";
import { marked } from "marked";
import { fetchProductList, fetchProductsByHandles, fetchProductAllImages, isShopifyConfigured } from "./services/shopify";
import { matchProductCatalog } from "./config/productCatalog";
import { supabaseLegacyPublisher } from "./services/supabase-legacy";
import { markdownToHtml } from "./utils/markdown";
import { COMPONENT_REGISTRY } from "./config/componentRegistry";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
