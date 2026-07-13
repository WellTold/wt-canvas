---
name: Email block preset sync bugs
description: Two bugs in the PUT /api/block-presets/:id route that prevented preset changes from propagating to email content_items.
---

## The rules

1. **Column name**: The raw SQL must use `content_json` (the actual DB column), not `content` (the Drizzle JS property name). Drizzle maps `content` → `content_json` internally but raw `db.execute(sql`...`)` bypasses that mapping.

2. **JSONB path for `_presetId`**: In `content_items.content_json`, each array element is `{ type, content: { ..., _presetId, _presetName }, order, _bg }`. The `_presetId` is nested inside `blk->'content'`, NOT at the top level of `blk`. Correct lookup: `(blk->'content'->>'_presetId')::int = $id`.

3. **JSONB merge level**: To update a block's content, use `jsonb_set(blk, '{content}', blk->'content' || newContent::jsonb)` — not `blk || newContent::jsonb` which would merge at the wrong level.

**Why:** `addBlockFromPreset` in ContentEditor.tsx stores `_presetId` inside the `content` field: `content: { ...preset.content, _presetId, _presetName }`. The SQL must match that structure.

**How to apply:** Any raw SQL touching `content_items` blocks must use `content_json` as the column name and `blk->'content'->>'_presetId'` for preset lookups.
