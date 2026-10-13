# Nutrition OS: private live access

Status: design only. This package has no remote backend or active ChatGPT connector.

The requested behaviour is achievable as two separate steps:

1. The PWA uploads changes to your private online data store as you log them online.
2. When you ask ChatGPT about a date or week, a read-only connector retrieves the
   latest successfully synced records. It must include the last-sync time.

This does not mean that every checkbox becomes a message in an existing chat or
that ChatGPT silently monitors your phone. Offline changes must remain queued and
be sent when the app is next open and connected. iPhone background execution must
not be assumed.

## GitHub Pages architecture

Keep the UI on GitHub Pages. Add an authenticated HTTPS API and database on a
server-capable host. GitHub Pages cannot run that API or the MCP server itself.
Use established OAuth for the PWA and connector, an owner-only database policy,
and a read-only scope for ChatGPT. Never embed a database service key or private
GitHub token in frontend JavaScript; never publish exported nutrition logs to Pages.

Data contract:
- Per-date nutrition records: meal snapshots, completion flags, supplement flags,
  water quantity, whether water was actually logged, goal snapshots and updatedAt.
- Per-date weight records, including deletions.
- User settings and meal templates.
- Weekly shopping records and prices.
- Server revision and last successful sync timestamp.

Proposed PWA API:
- GET /v1/state: get the owner's records and server revision.
- POST /v1/changes: idempotent operations with operation IDs and expected revisions.
  Each operation targets a dated record; server rejects stale revisions instead
  of silently replacing more recent data. Keep deletion tombstones.
- GET /v1/sync-status: last server write and revision.

Proposed read-only MCP tools:
- get_nutrition_days(start_date, end_date): dated meals, eaten flags, macros,
  water, targets, supplements and weights; explicitly identify unlogged dates.
- get_nutrition_week(week_start): exact daily records plus weekly aggregates.
- get_weight_history(start_date, end_date): individual weigh-ins and weekly means.
- get_sync_status(): source revision and last successful upload time.

UI additions once deployed: Sign in, Last synced [time], Offline—changes pending,
Retry sync, and a recoverable conflict review. Never display Synced before the
server acknowledges all pending operations. Export/import remains available.

## Lower-setup alternative

If you choose to move hosting from GitHub Pages to a private ChatGPT Site, Sites
can provide authenticated hosting, durable server storage and a Site MCP plugin.
That would be a hosting decision, not an automatic change to this GitHub package.
No Site was created as part of this update.

## Acceptance test for the completed connection

Log a meal, water and weight on iPhone, then ask ChatGPT for that date and compare
exact values. Change and untick entries and verify the results again. Repeat after
an offline edit and reconnect. Check that unlogged days remain unknown, that
another unauthorised user cannot read data, and that a failed sync is visible.

Official connector documentation:
https://developers.openai.com/api/docs/mcp
