-- Templates Table for WT Canvas
-- This table stores reusable content templates with AI generation instructions
-- The type column stores canonical machine keys (snake_case).

CREATE TABLE templates (
  id                   UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  name                 TEXT          NOT NULL,
  description          TEXT,
  type                 TEXT          NOT NULL
                         CHECK (type IN (
                           'blog_article',
                           'landing_page',
                           'lead_magnet',
                           'email_campaign',
                           'email_flow'
                         )),
  system_prompt        TEXT,
  user_prompt_addition TEXT,
  structure            JSONB,
  sections             JSONB,
  tags                 TEXT[],
  -- Email-template constants (non-null for email types)
  preheader_text       TEXT,
  email_header         JSONB,
  email_footer         JSONB,
  created_at           TIMESTAMPTZ   DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_templates_type       ON templates(type);
CREATE INDEX idx_templates_created_at ON templates(created_at);

-- Insert some default templates (uses new column names: type, structure)
INSERT INTO templates (name, description, type, structure) VALUES 
(
  'How-To Guide',
  'Step-by-step instructional content with clear actionable steps',
  'blog_article',
  '[
    {
      "type": "heading",
      "label": "Introduction",
      "instruction": "Create an engaging hook that introduces the problem this guide solves",
      "order": 0,
      "required": true
    },
    {
      "type": "text",
      "label": "Problem Context",
      "instruction": "Explain why this is important and what the reader will gain",
      "order": 1,
      "required": true
    },
    {
      "type": "heading",
      "label": "What You Will Need",
      "instruction": "List prerequisites, tools, or materials needed",
      "order": 2,
      "required": false
    },
    {
      "type": "list",
      "label": "Step-by-Step Instructions",
      "instruction": "Break down the process into clear, numbered steps with specific actions",
      "order": 3,    
      "required": true
    },
    {
      "type": "quote",
      "label": "Pro Tip",
      "instruction": "Include an expert insight or common mistake to avoid",
      "order": 4,
      "required": false
    },
    {
      "type": "text",
      "label": "Conclusion",
      "instruction": "Summarize the key takeaways and encourage action",
      "order": 5,
      "required": true
    },
    {
      "type": "cta",
      "label": "Next Steps",
      "instruction": "Provide a clear call-to-action for what the reader should do next",
      "order": 6,
      "required": true
    }
  ]'
),
(
  'Product Comparison',
  'Side-by-side analysis of products or services with clear recommendations',
  'blog_article',
  '[
    {
      "type": "heading",
      "label": "Introduction",
      "instruction": "Introduce the products being compared and why this comparison matters",
      "order": 0,
      "required": true
    },
    {
      "type": "text",
      "label": "Comparison Criteria",
      "instruction": "Explain the factors used to evaluate each product",
      "order": 1,
      "required": true
    },
    {
      "type": "heading",
      "label": "Product Overview",
      "instruction": "Brief description of each product or service being compared",
      "order": 2,
      "required": true
    },
    {
      "type": "list",
      "label": "Feature Comparison",
      "instruction": "Compare specific features, pricing, and benefits in an easy-to-scan format",
      "order": 3,
      "required": true
    },
    {
      "type": "text",
      "label": "Pros and Cons",
      "instruction": "Balanced analysis of advantages and disadvantages for each option",
      "order": 4,
      "required": true
    },
    {
      "type": "quote",
      "label": "Expert Recommendation",
      "instruction": "Your professional recommendation based on different use cases",
      "order": 5,
      "required": true
    },
    {
      "type": "cta",
      "label": "Choose Your Option",
      "instruction": "Clear call-to-action helping readers make their decision",
      "order": 6,
      "required": true
    }
  ]'
),
(
  'Lead Magnet Landing Page',
  'High-converting landing page template for lead capture',
  'lead_magnet',
  '[
    {
      "type": "heading",
      "label": "Compelling Headline",
      "instruction": "Create a benefit-focused headline that clearly states the value proposition",
      "order": 0,
      "required": true
    },
    {
      "type": "text",
      "label": "Problem Statement",
      "instruction": "Identify the specific problem or pain point your audience faces",
      "order": 1,
      "required": true
    },
    {
      "type": "list",
      "label": "What You Will Get",
      "instruction": "List the specific benefits and outcomes from the lead magnet",
      "order": 2,
      "required": true
    },
    {
      "type": "quote",
      "label": "Social Proof",
      "instruction": "Include a testimonial or success story to build credibility",
      "order": 3,
      "required": false
    },
    {
      "type": "text",
      "label": "Why This Works",
      "instruction": "Explain the methodology or approach that makes this valuable",
      "order": 4,
      "required": true
    },
    {
      "type": "cta",
      "label": "Download CTA",
      "instruction": "Strong, action-oriented call-to-action for the download",
      "order": 5,
      "required": true
    }
  ]'
),
(
  'Product Landing Page',
  'Conversion-focused landing page for product or service sales',
  'landing_page',
  '[
    {
      "type": "heading",
      "label": "Value Proposition Headline",
      "instruction": "Clear, compelling headline that communicates the main benefit",
      "order": 0,
      "required": true
    },
    {
      "type": "text",
      "label": "Problem Description",
      "instruction": "Describe the problem your product solves in relatable terms",
      "order": 1,
      "required": true
    },
    {
      "type": "heading",
      "label": "How We Solve It",
      "instruction": "Introduce your solution and how it addresses the problem",
      "order": 2,
      "required": true
    },
    {
      "type": "list",
      "label": "Key Features & Benefits",
      "instruction": "List the main features with focus on customer benefits",
      "order": 3,
      "required": true
    },
    {
      "type": "quote",
      "label": "Customer Success Story",
      "instruction": "Include a specific testimonial with results or outcomes",
      "order": 4,
      "required": true
    },
    {
      "type": "text",
      "label": "Why Choose Us",
      "instruction": "Differentiate from competitors and build trust",
      "order": 5,
      "required": true
    },
    {
      "type": "cta",
      "label": "Primary CTA",
      "instruction": "Strong call-to-action for the main conversion goal",
      "order": 6,
      "required": true
    },
    {
      "type": "text",
      "label": "Risk Reversal",
      "instruction": "Address objections with guarantees, refunds, or risk mitigation",
      "order": 7,
      "required": false
    }
  ]'
);

-- ─────────────────────────────────────────────────────────────────
-- MIGRATION: Email Template Foundation
-- Run in the Supabase SQL editor — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────

-- 1. Drop any legacy category/type check constraints from earlier schema versions.
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_category_check;
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_type_check;

-- 2. Normalise existing rows that still store display strings → machine keys.
UPDATE templates SET type = 'blog_article'    WHERE type = 'Blog Article';
UPDATE templates SET type = 'landing_page'    WHERE type = 'Landing Page';
UPDATE templates SET type = 'lead_magnet'     WHERE type = 'Lead Magnet';
UPDATE templates SET type = 'email_campaign'  WHERE type = 'Email Campaign';
UPDATE templates SET type = 'email_flow'      WHERE type = 'Email Flow';

-- 3. Add the canonical type CHECK constraint (idempotent: drop first).
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_type_check;
ALTER TABLE templates ADD CONSTRAINT templates_type_check
  CHECK (type IN (
    'blog_article',
    'landing_page',
    'lead_magnet',
    'email_campaign',
    'email_flow'
  ));

-- 4. Add the three email-template constant columns.
ALTER TABLE templates ADD COLUMN IF NOT EXISTS preheader_text TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS email_header   JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS email_footer   JSONB;

-- ─────────────────────────────────────────────────────────────────

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_templates_updated_at 
  BEFORE UPDATE ON templates 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();