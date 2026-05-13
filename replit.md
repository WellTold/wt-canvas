# WT Canvas

WT Canvas is a full-stack dashboard for the Well Told team to manage content creation and publishing across multiple channels, including AI-powered content generation.

## Run & Operate

*   **Run Dev Server**: `npm run dev`
*   **Build**: `npm run build`
*   **Typecheck**: `npm run typecheck`
*   **Codegen (Drizzle)**: `npm run generate-drizzle`
*   **DB Push (Drizzle)**: `npm run db:push`

**Required Environment Variables**:
*   `NODE_ENV`
*   `DATABASE_URL` (for Replit PostgreSQL auth)
*   `SUPABASE_URL`
*   `SUPABASE_ANON_KEY`
*   `ANTHROPIC_API_KEY`
*   `SESSION_SECRET`
*   `SITE_BASE_URL` (e.g., `https://welltold.design`)
*   `SHOPIFY_STOREFRONT_TOKEN`
*   `SHOPIFY_STORE_DOMAIN`
*   `CF_API_TOKEN` (for Cloudflare cache purging)
*   `CF_ZONE_ID`

## Stack

*   **Frontend**: React 18, TypeScript, Vite, Shadcn/UI, Tailwind CSS, Wouter, TanStack Query, React Hook Form (with Zod)
*   **Backend**: Node.js, TypeScript, Express.js
*   **Database**: PostgreSQL (Drizzle ORM for local, Supabase for published)
*   **AI**: Claude (Anthropic)
*   **Auth**: Supabase Auth (JWT)

## Where things live

*   **Frontend Source**: `client/src/`
*   **Backend Source**: `server/src/`
*   **Shared Types/Schemas**: `shared/schema.ts`
*   **Database Migrations**: `sql-migrations/`
*   **DB Schema (Drizzle)**: `server/src/db/schema.ts`
*   **AI Service**: `client/src/lib/ai.ts`
*   **Cloudflare Worker**: `worker/`
*   **Well Told Page Stylesheet**: `client/public/styles/wt-pages.css`
*   **Component Registry**: `server/config/componentRegistry.ts`

## Architecture decisions

*   **Dual Database Strategy**: Uses Replit PostgreSQL for authentication/local content and Supabase for published content, enabling flexible block structures for Framer CMS integration.
*   **AI Model Consistency**: Standardized on Claude for all AI features, ensuring consistent content generation.
*   **Template-Driven Content Generation**: Employs structured templates with predefined sections that AI fills, maintaining brand consistency.
*   **Headless UI with Custom Styling**: Leverages Radix UI for accessibility with Tailwind CSS for a highly customized design system.
*   **Cloudflare Worker for SEO**: A dedicated Worker dynamically serves content from Supabase, handles sitemaps, and manages redirects for optimal SEO.

## Product

*   **Content Management**: Create, manage, and publish blog articles, lead magnets, and landing pages with a defined workflow (Idea → Draft → Review → Approved → Scheduled → Live).
*   **Modular Content Blocks**: Utilize various content block types (heading, text, image, quote, list, CTA) with advanced styling options.
*   **AI Content Generation**: Generate titles, meta descriptions, full articles, and improve existing content using AI, guided by templates and user input.
*   **Media Library**: Organize and manage brand assets (logos, lifestyle images) with folders, multiple view modes, and Cloudinary integration for optimized delivery.
*   **Keyword Library**: Track and manage keywords with status (untargeted, in\_progress, published) and an AI-powered recommendation engine for new page creation.
*   **Visual Template Editor**: A dual-mode editor (visual/JSON) for structuring content templates with drag-and-drop section reordering.
*   **App Blocks**: Support for custom, registered components to extend content capabilities, rendered via a lightweight Cloudflare Worker loader.
*   **SEO Features**: Comprehensive SEO fields (OG image/title, canonical URL, structured data, custom CSS, redirects) and an in-editor HTML preview reflecting the published output.

## User preferences

Preferred communication style: Simple, everyday language.
Design preferences: Sharp corners (no border radius), card backgrounds using color #f0ebe7, flat border-style shadows on hover with muted accent colors, all borders solid black.
Layout preferences: Vertical stacking for detailed pages - back buttons at top, titles below, content type badges below titles, action buttons at bottom. Avoid horizontal layouts unless data naturally groups together.
AI content rules: NEVER use em-dashes (—) in any AI-generated content. Use a regular hyphen (-) or rewrite the sentence instead. This is a universal rule applied to every prompt and enforced in post-processing.

## Gotchas

*   **Database Migration**: Always run `sql-migrations/phase1a_seo_columns.sql` in Supabase SQL editor when setting up or updating the database.
*   **Cloudinary Configuration**: Ensure the Cloudinary cloud name is lowercase "welltold".
*   **Cloudflare Worker Deployment**: Follow instructions in `worker/README.md` to deploy the worker, including setting Supabase secrets and `CF_API_TOKEN`.
*   **Role-gated Features**: "HTML Block" and certain developer features are only visible to users with `admin` or `developer` roles.

## Pointers

*   **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
*   **Drizzle ORM Docs**: [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
*   **Tailwind CSS Docs**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
*   **Anthropic AI Docs**: [https://docs.anthropic.com/en/](https://docs.anthropic.com/en/)
*   **Cloudflare Workers Docs**: [https://developers.cloudflare.com/workers/](https://developers.cloudflare.com/workers/)
*   **Wouter Docs**: [https://www.npmjs.com/package/wouter](https://www.npmjs.com/package/wouter)