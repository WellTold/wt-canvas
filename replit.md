# WT Canvas - Full-Stack Dashboard

## Overview

WT Canvas is a full-stack dashboard web application built for the Well Told team to manage content creation and publishing across multiple channels. The application uses a modern tech stack with React + TypeScript on the frontend, Express.js on the backend, PostgreSQL with Drizzle ORM for data persistence, and includes AI-powered content generation features.

## User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Sharp corners (no border radius), card backgrounds using color #f0ebe7, flat border-style shadows on hover with muted accent colors, all borders solid black.
Layout preferences: Vertical stacking for detailed pages - back buttons at top, titles below, content type badges below titles, action buttons at bottom. Avoid horizontal layouts unless data naturally groups together.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **UI Framework**: Shadcn/UI components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with JWT-based authentication (Supabase Auth)
- **Database**: PostgreSQL with Drizzle ORM (local content_items/content_blocks) + Supabase (published content)
- **AI Integration**: Claude (Anthropic) for content generation via `@anthropic-ai/sdk`
- **Session**: Supabase Auth JWT tokens, no express-session
- **API Design**: RESTful endpoints with JSON responses

### Authentication Strategy
- Supabase Auth with JWT tokens
- Pre-seeded user accounts for the Well Told team (brian/neil/dan@welltolddesign.com)
- Default password: WTCanvas25!

## Key Components

### Content Management System
- **Content Types**: Blog articles, lead magnet pages, and landing pages
- **Content Workflow**: Idea → Draft → Review → Approved → Scheduled → Live
- **Approval System**: Pending, approved, rejected statuses
- **Content Blocks**: Modular content system with different block types (heading, text, image, quote, list, CTA)
- **Block Backgrounds**: Every block supports an optional `_bg` object (top-level, alongside `type`/`content`) with `color`, `imageUrl`, `imageSize`, and `fallbackColor` fields. Applied in the email renderer only (web rendering ignores `_bg`). UI in ContentBlock shows a "Block Background" section at the bottom of each block card.
- **Image Width & Alignment**: Image blocks support `widthMode` ("full"|"px"|"percent"), `customWidth` (number), and `align` ("left"|"center"|"right") fields in their content. Applied in both email and web renderers.
- **Scheduling**: Content can be scheduled for future publication

### Media Library System
- **Asset Types**: Brand logos and lifestyle images
- **Folder Organization**: Users can create custom folders for organizing assets
- **File Management**: Upload, preview, and organize media assets
- **View Modes**: Grid and list view options for browsing assets

### AI-Powered Features
- **Title Generation**: AI-generated SEO-optimized titles based on content
- **Meta Description**: Automatic generation of compelling meta descriptions
- **Content Improvement**: AI enhancement of existing content sections
- **Section Generation**: Creation of new content sections based on topics
- **Template-Based Generation**: Structured content templates for each content type (blog, lead magnet, landing page) with predefined sections that AI fills out for consistency and reliability

### Keyword Library
- **Table**: `keyword_library` in the Neon PostgreSQL database (auto-created on startup)
- **Statuses**: untargeted → in_progress → published
- **API Routes**: GET/POST `/api/keywords`, PATCH/DELETE `/api/keywords/:id`
- **Recommendation Engine**: `/api/pages/recommend` — accepts keywordId, keyword text, or topic; returns recommended template type, draft title, and up to 3 matching templates

### New Page Creation Flow (NewPageModal)
- **Trigger**: Clicking "New Page" in SavedPages opens `NewPageModal` instead of redirecting to Templates
- **Three starting points**:
  - Keyword-first: search keyword library → AI recommends template and title
  - Template-first: browse and pick a template
  - Topic-first: type a description → AI recommends keyword and template
- **AI Pick for Me**: one-click button that picks the next untargeted keyword and recommends a template
- **Keyword Status Lifecycle**: keyword set to "in_progress" when page is created from it; set to "published" when content item is published; `content_item_id` linked in keyword_library

## Data Flow

### Content Creation Flow
1. User opens "New Page" which shows the smart NewPageModal with 3 starting options
2. Optional keyword selection auto-populates primary keyword and triggers AI title recommendation
3. User selects a template and fills in description via PreLaunchModal
4. Content item is created in the editor with pre-populated blocks and keyword
5. Content moves through workflow states (idea → draft → review → approved)
6. Content blocks are added and managed within each content item
7. AI services can be used to enhance or generate content
8. Content can be scheduled or published immediately
9. When published, linked keyword's status is automatically updated to "published"

### Media Management Flow
1. Users create folders to organize assets by project or campaign
2. Assets are uploaded to specific folders
3. Assets can be viewed in grid or list format
4. Assets are stored with metadata (filename, size, upload date, etc.)

### Authentication Flow
1. User submits email/password credentials
2. Server validates against hashed passwords in database
3. Session is created and stored in PostgreSQL
4. Session ID is returned to client via secure cookie
5. Subsequent requests include session cookie for authentication

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL serverless driver (for auth only)
- **@supabase/supabase-js**: Supabase client for content publishing
- **drizzle-orm**: Type-safe ORM for database operations
- **express-session**: Session management middleware
- **bcryptjs**: Password hashing and verification
- **openai**: Official OpenAI API client for content generation

### UI Dependencies
- **@radix-ui/***: Headless UI components for accessibility
- **@tanstack/react-query**: Server state management
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight React router
- **react-hook-form**: Forms with validation

### Development Dependencies
- **vite**: Fast build tool and dev server
- **typescript**: Static type checking
- **drizzle-kit**: Database schema management
- **@replit/vite-plugin-***: Replit-specific development plugins

## Deployment Strategy

### Development Environment
- Uses Vite dev server with HMR for frontend development
- Express server with TypeScript compilation via tsx
- Database migrations handled by Drizzle Kit
- Environment variables for database URL and API keys

### Production Build
- Frontend: Vite builds optimized React bundle to `dist/public`
- Backend: esbuild compiles TypeScript Express app to `dist/index.js`
- Single deployment artifact serves both frontend and API
- Static files served from `dist/public`
- API routes handled by Express server

### Database Management
- **Dual Database Architecture**: Replit PostgreSQL for authentication, Supabase for content
- **Authentication Database (Replit)**: users table with session management
- **Content Database (Supabase)**: blog_articles, landing_pages, lead_magnets with extended schema
- **Content Structure**: content_json field stores flexible block arrays for Framer CMS integration
- **Publishing Flow**: WT Canvas → structured content_json → Supabase → Framer CMS
- Local content stored in: contentItems, contentBlocks, mediaAssets, folders

### Environment Configuration
- `NODE_ENV` controls development vs production behavior
- `DATABASE_URL` for Replit PostgreSQL connection (authentication only)
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` for content publishing
- `ANTHROPIC_API_KEY` for AI content generation (Claude 3.5 Sonnet)
- `SESSION_SECRET` for session security
- `SITE_BASE_URL` for the public-facing site URL (e.g. `https://welltold.design`) — used to construct absolute links in email rendering
- `SHOPIFY_STOREFRONT_TOKEN` — Shopify Storefront API public access token (read-only scopes: products, collections). Required to render Shopify content blocks. Never exposed to the browser.
- `SHOPIFY_STORE_DOMAIN` — Shopify store domain without protocol (e.g. `my-store.myshopify.com`). Required alongside `SHOPIFY_STOREFRONT_TOKEN`.
- Vite handles environment variable injection for frontend

## Recent Changes (August 12, 2025)

### Visual Template Structure Editor
- ✅ Implemented dual-mode template structure editor with visual and JSON views
- ✅ Visual editor allows drag-and-drop section reordering with up/down arrows
- ✅ Add section functionality with support for: heading, paragraph, list, image, CTA, quote types
- ✅ Each section displays with customizable fields (title, description, type-specific properties)
- ✅ Real-time synchronization between visual editor and JSON view
- ✅ Enhanced delete functionality with cascading delete for content blocks
- ✅ Publisher enhanced with expandable content sections showing detailed block structure

### Templates System Integration
- ✅ Connected Templates page to existing Supabase templates table
- ✅ Updated service layer to work with current schema (id, name, type, description, system_prompt, user_prompt_addition, structure)
- ✅ Full CRUD API endpoints for template management (create, read, update, delete, duplicate)
- ✅ Real-time filtering by template type (Blog Article, Landing Page, Lead Magnet)
- ✅ Template search functionality across name and description fields
- ✅ Clean card-based UI with type-specific styling and metadata display

### Content View and Navigation Enhancement
- ✅ Implemented ContentView component with comprehensive scheduling and approval controls
- ✅ Article titles are now clickable links that navigate to content view mode
- ✅ Preview Content modal displays formatted content blocks with proper rendering
- ✅ Content pages support edit query parameter routing for direct editing access
- ✅ Status management with workflow and approval status controls
- ✅ Scheduling functionality with date picker and automatic status updates
- ✅ Updated ContentView layout to use vertical stacking (back button → title → content type badge → action buttons)
- ✅ Enhanced Preview modal to render content cleanly without labels (titles as H1/H2, proper image display, styled content blocks)

### AI Integration Completion
- ✅ Functional AI Generation buttons using OpenAI GPT-4o integration
- ✅ Title generation based on content and type with SEO optimization
- ✅ Meta description generation using content context
- ✅ Complete article generation using template structure and user inputs
- ✅ Content improvement and refinement features
- ✅ Template-driven content generation with custom prompts and structure

### Template Management Features
- **Database Integration**: Direct connection to existing Supabase templates table
- **Template Operations**: Use, Edit, Duplicate, and Delete operations with proper error handling
- **AI Instructions Storage**: Templates store system_prompt and user_prompt_addition for AI content generation
- **Structure Support**: JSON structure field for content block definitions
- **Type-based Organization**: Templates categorized by Blog Article, Landing Page, and Lead Magnet types

### Supabase Integration Completed
- ✅ Successfully connected to existing Supabase database with extended table structure
- ✅ Created legacy adapter to work with current schema (blog_articles, landing_pages, lead_magnets)
- ✅ Implemented content_json structure for Framer CMS compatibility
- ✅ All three content types now publishing successfully to Supabase
- ✅ Automatic content block conversion from WT Canvas format to Framer CMS structure
- ✅ Comprehensive testing with cleanup functionality

### Publishing Architecture
- **Content Flow**: WT Canvas blocks → content_json arrays → Supabase tables → Framer CMS
- **Block Structure**: heading, paragraph, image, cta, list, quote types with flexible properties
- **Legacy Compatibility**: Works with existing extended table schema while supporting new simplified structure
- **Dual Schema Support**: Option to use existing tables or create new clean schema for Framer CMS

### Cloudinary Smart Transformations (August 12, 2025)
- ✅ Enabled automatic image optimization with smart quality and format selection
- ✅ Implemented progressive JPEG loading and auto-format delivery (WebP, AVIF when supported)
- ✅ Added responsive image URL generation with multiple breakpoints (mobile, tablet, desktop, large)
- ✅ Created blog-specific image variants (thumbnail, small, medium, large, hero) for content creation
- ✅ Enhanced Cloudinary Assets page with optimization buttons in both grid and list views
- ✅ Fixed cloud name configuration issue (lowercase "welltold" required)
- ✅ Added /api/cloudinary/optimize endpoint for generating multiple image variants
- ✅ All image assets now automatically serve optimized URLs with quality:auto:best and fetch_format:auto

### Sidebar Navigation Enhancement (August 13, 2025)
- ✅ Removed "Lifestyle Images" from Content Library section
- ✅ Added dedicated "Cloudinary" section with expandable nested folder tree
- ✅ Implemented multi-level folder expansion with proper nesting hierarchy
- ✅ Fixed folder filtering bug - assets now properly display when selecting specific folders
- ✅ Added Cloudinary search expression fix: now properly includes resource_type when filtering by folder
- ✅ URL-based folder navigation with query parameters for direct folder access
- ✅ Dynamic margin calculation for proper nested folder indentation
- ✅ Individual expand/collapse state management for each folder level

### Phase 1 — SEO Infrastructure (March 2026)

#### AI Migration (Phase 0C)
- ✅ All 6 AI functions migrated from OpenAI to Claude (`claude-3-5-sonnet-20241022`) via `@anthropic-ai/sdk`
- ✅ `openai` package removed; `client/src/lib/openai.ts` renamed to `ai.ts`
- ✅ Fixed `generateCompleteArticle` object param signature and route response format

#### Cloudflare Worker (Phase 1C)
- ✅ `worker/` directory with full Cloudflare Worker code (`worker/src/index.ts`)
- ✅ Worker reads live Supabase rows (blog_articles, landing_pages, lead_magnets) by slug
- ✅ Zero-dependency block renderer (`worker/src/renderer/blockToHtml.ts`) shared with server
- ✅ Serves `/sitemap.xml` dynamically and handles `redirect_from` 301 redirects
- ✅ `worker/README.md` with deploy instructions
- **To deploy**: `cd worker && npm install && wrangler secret put SUPABASE_URL && wrangler secret put SUPABASE_ANON_KEY && npm run deploy`

#### SEO Column Storage (Phase 1A)
- ✅ `sql-migrations/phase1a_seo_columns.sql` — run in Supabase SQL editor to add columns
- ✅ `publishContentItem` now sets `published_at` TIMESTAMPTZ alongside `publish_date`
- ✅ `createContentItem` includes all SEO fields on creation
- ✅ `updateContentItem` maps all SEO fields: og_image, og_title, canonical_url, page_template, structured_data, custom_css, redirect_from
- **PENDING**: Run `sql-migrations/phase1a_seo_columns.sql` in Supabase SQL editor

#### Structured Data / JSON-LD (Phase 1G)
- ✅ ContentEditor has "Schema Type (JSON-LD)" selector (Article / WebPage / FAQPage / HowTo)
- ✅ PATCH and PUT routes convert `structuredDataType` string → full `{"@context":...,"@type":...}` object
- ✅ Block renderer uses stored `structured_data` or generates a default Article schema

#### Environment Variables
- ✅ `CF_API_TOKEN` — saved as secret (used for cache purging on publish)
- ✅ `SITE_BASE_URL=https://welltold.design/pages` — updated (was pages.welltolddesign.com)
- ⏳ `CF_ZONE_ID` — PENDING (add after welltold.design DNS is fully configured)

#### In-Editor HTML Preview (added March 2026)
- ✅ `/api/content-items/:id/preview-html` endpoint — renders full HTML page using block renderer, SEO fields, CSS
- ✅ Preview uses request origin as CSS base URL (so CSS loads from local dev server in preview iframe)
- ✅ `client/public/styles/wt-pages.css` — Well Told page stylesheet (served statically, used by both preview and production Worker)
- ✅ ContentView has "Preview as Published" button — full-page iframe dialog showing exactly what the Worker will serve
- ✅ Cloudflare Worker updated to strip `/pages/` path prefix (welltold.design/pages/my-slug → slug = my-slug)
- ✅ Worker route: `welltold.design/pages/*` — add this as a Cloudflare Route on the welltold.design zone

### App Block & Registered Components (Task #9)
- ✅ `server/config/componentRegistry.ts` — component registry with `coming_soon` and `product_personaliser` pre-registered; each entry has: name, label, description, assetUrl, JSON Schema (properties with title/description/default/enum)
- ✅ `/api/components` endpoint — public, returns full registry as JSON; no auth required
- ✅ `AppBlockContent` interface in `shared/schema.ts` — `{ componentName, assetUrl, config: Record<string,string> }`; added to `BlockContent` union
- ✅ `app_block` added to `COMPLEX_BLOCK_TYPES` in `server/routes.ts` — content preserved verbatim on save
- ✅ Web renderer (`server/renderer/blockToHtml.ts` + `worker/src/renderer/blockToHtml.ts`) — outputs `<div data-wt-component="X" data-wt-config="...">` + inline `<script>` that lazy-loads the component assetUrl once per page (deduped via `window.__WTC`)
- ✅ Cloudflare Worker serves `/components/loader.js` — lightweight JS that finds `[data-wt-component]` elements and calls `window.__WTC_INIT[name](el, cfg)` if defined; supports runtime registration pattern
- ✅ `AppBlockEditor` component in `ContentBlock.tsx` — fetches registry, shows component dropdown, dynamically renders config fields from JSON Schema (enum props become Select, others become Input)
- ✅ `html_block` editor case in `ContentBlock.tsx` — raw HTML textarea with amber "admin only" label
- ✅ `ContentEditor.tsx` — "App Block" button added to Web Blocks palette; "HTML Block" button in new "Developer" section gated behind `user?.role === 'admin' || user?.role === 'developer'` role check

### Cloudinary Asset Integration (August 13, 2025)
- ✅ Replaced "Upload Image" with "Select Image" functionality in article creation
- ✅ Added CloudinaryAssetSelector component with comprehensive asset browsing
- ✅ Integrated asset selector into ContentEditor for featured image selection
- ✅ Enhanced folder discovery using Cloudinary search API aggregations for complete folder tree
- ✅ Implemented inclusive folder filtering - selecting a folder shows all assets in that folder AND subfolders
- ✅ Added visual asset previews in both grid and list modes within selector modal
- ✅ Real-time asset search and folder navigation within selector
- ✅ Automatic featured image preview updates when assets are selected

### AI Content Generation System (March 2026)
- ✅ `/api/ai/generate-content` — full template generation endpoint with brand context + mood + prompt assembly
- ✅ `/api/ai/generate-block` — single-block generation endpoint for per-block "Generate ✦" buttons
- ✅ `MOOD_INSTRUCTIONS` constant in claude.ts — 6 moods (warm-sentimental, celebratory, urgent, helpful, conversational, aspirational)
- ✅ `generateContent()` function — assembles multi-layer system prompt from brand voice doc + mood + grammar rules + vocabulary, calls claude-sonnet-4-20250514, retries on JSON parse fail
- ✅ `PreLaunchModal.tsx` — intercepts template launch, collects description + title + context fields, offers auto-generate vs manual mode
- ✅ Mood badge in TemplateDetail.tsx — clickable dropdown showing 6 moods, persisted in sessionStorage, bold indicator when overridden
- ✅ Block visual states in ContentBlock.tsx — AI Generated (green left border + "AI ✦" badge), Needs Input (amber border for empty image/promo blocks), Manual (neutral)
- ✅ Per-block generate button upgraded — uses /api/ai/generate-block with mood + sibling context; shows "Regenerate ✦" for already-generated blocks; loading spinner
- ✅ ContentEditor reads prelaunch sessionStorage on mount — applies pre-generated content and marks blocks as "ai_generated"
- ✅ EmailTemplates.tsx + Templates.tsx integrated with PreLaunchModal