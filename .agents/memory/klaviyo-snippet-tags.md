---
name: Klaviyo snippet tag syntax
description: Klaviyo's template tags behave differently — some output full anchor elements, some output URLs only. Static fallback map must match DB.
---

## The rules

- `{% manage_preferences %}` → expands to a **full `<a>` element** (link text + styles). Never put inside `href=""`.
- `{% unsubscribe_link %}` → expands to a **URL only**. Safe inside `href=""`.
- `{{ manage_preferences_url }}` → URL only (double-curly). Safe inside `href=""`.

**The static fallback**: `server/config/snippets.ts` SNIPPET_MAP is used when `fetchSnippetsMap()` DB read fails (returns `{}`). It must always be kept in sync with the DB. Any time the DB snippet is edited, the static file must be updated too — otherwise a DB fetch failure silently reverts to broken HTML.

**Why:** renderHtmlBlock() checks `snippetsMap[name]` first (DB), then falls back to `SNIPPET_MAP[name]` (static file). Silent DB failures make the static file the effective source of truth.

**How to apply:** After editing any snippet in Site Settings or DB, update the matching entry in `server/config/snippets.ts` to match.
