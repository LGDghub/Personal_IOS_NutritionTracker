# v3.0 — private accounts, supplement stock and reminders

Supplement inventory and low-stock notices; configurable personal water push reminders; separate local account caches; blank friend meal templates and editable shopping names; OAuth consent and a private ChatGPT MCP server with optional meal-only writes. Backend RLS and revision checks tested with temporary accounts. Existing Monday weigh-ins and password recovery preserved.

Owner OAuth/email configuration and real phone delivery tests remain: see SETUP-FRIENDS.md. No existing tracking rows were replaced by this release.

# Personal WFW Tracker 2.0

Built by extending the October 13 Nutrition_OS_iPhone_PWA.zip package.

## Verified in this environment
- JavaScript syntax for app, model and service worker.
- HTML element IDs, referenced controls and local shell assets.
- v1-to-v2 data migration, including existing meal ticks, supplements and weights.
- Meal and extra-food totals; snapshot isolation for historical meals and targets.
- JSON round trip and rejection of malformed dates, duplicate foods and bad values.
- Weekly summaries, missing-water distinction and date/DST boundaries.
- App startup and handler transitions in a lightweight DOM harness: checkbox
  on/off, water, weight, custom food, HTML escaping, themes, dates and persistence.

## Not yet verified
No browser-control skill was available, so visual layout, real Safari behaviour,
service-worker installation/update lifecycle and airplane-mode operation have not
been exercised in a browser. No live GitHub Pages deployment or cloud sync has
been verified.

## iPhone release checklist
1. Open the deployed HTTPS URL. Confirm no controls overflow at your text size.
2. Tick breakfast: 1,355 kcal. Untick it: 0 kcal. Tick all three: 3,022 kcal.
3. Add a 100-kcal snack and mark it eaten: 3,122 kcal. Untick it: 3,022 kcal.
4. Log water and weight. Relaunch the app; values should persist.
5. Change to light mode, then system mode; verify readable controls and chart.
6. Choose yesterday, log a meal, return to today and inspect both history entries.
7. Export, change a record, import the export, and verify the record is restored.
8. Open the installed app online, then turn on airplane mode and relaunch.
9. Turn networking back on. Check for app updates and apply a release with a bumped
   sw.js VERSION; the saved history should remain intact.

## Known boundaries
- Meal macros and prices are inherited estimates, not refreshed food-label data.
- The bundled shopping list is editable in price; extra food entries do not
  automatically calculate a new shopping list.
- A meal checkbox represents the full logged portion. For part of a meal, edit
  its portion macros or log foods separately. Ingredient-level macros are not
  inferred from the original aggregate meal totals.
- Data is local to this browser/origin; no automatic remote backup exists yet.
- Cloud sync and read-only ChatGPT access still require deployment of a backend.

## v2.1 — Supabase sync
- Email/password account creation and sign-in.
- Automatic private snapshot syncing, visible status and manual retry.
- Offline edits retained; stale writes stop for explicit conflict resolution.
- Account binding prevents accidental cross-account uploads.
- SDK cached locally; existing storage identity and JSON backups preserved.
- Connected Supabase plugin can retrieve synced records when asked.

## v2.2 — refreshed colours and Monday weigh-ins
- Midnight teal dark theme and warm cream light theme; system theme still supported.
- Weekly weight entry is restricted to Monday dates. Next Monday is shown on other days.
- Past Monday measurements can be reviewed/corrected. Existing non-Monday entries remain in history.
- No cloud schema or nutrition-data migration required.

## v2.2.1 — Personal WFW Tracker
Renamed the app header, browser title, Home Screen metadata, account text and backup filenames. Existing storage keys, deployment address and database identifiers are retained for continuity.

## v2.3 — email password recovery
Forgot password sends a Supabase recovery link to the entered account email. Verified recovery sessions open a new-password form with confirmation, validation and error handling. Sync waits until password recovery completes. No passwords are saved to app storage.

## v4.0.0 — Align by Daly (19 October 2026)

- Renamed the public app, install manifest, OAuth consent page, update-repair page and notification title to Align by Daly. Motto: “All your health in one place.”
- Added a mint A icon on deep teal, with 192px/512px installation assets and a scalable in-app mark. Existing URL, manifest scope/start URL, local record keys and connector endpoint remain compatible.
- Redesigned the phone signup page: name, email and password; a separate sign-in mode; confirmation message, resend cooldown and change-email/sign-in route. Name is display metadata, never an authorization claim. Existing sessions continue to use Supabase session persistence.
- Added a four-part welcome guide for new v4 signups: features, Home Screen install, notifications, then ChatGPT. Completion is saved per account in metadata with a per-device fallback. Existing accounts bypass it; Settings has a replay option.
- Added phone-specific installation instructions and a native install button when the browser provides that capability.
- Kept Sync visible in the header; moved settings to a cog. Grouped targets, appearance, notifications, installation/update help and advanced data controls into expandable sections. Backup/import and sync explanations are folded away.
- Added a separate Connect AI tab: four setup stages, bold wrapping server address, copy button, ChatGPT link, permission explanation and a sample weekly-summary prompt. Existing WFW connections continue working. Checked OpenAI setup documentation on 19 October 2026; UI/plan availability can vary.
- Added Share Align using the device share sheet or copy fallback. Shares only the public URL, never session parameters or user records. Each new visitor creates their own account.
- Added private feedback: category, 5–3,000 character message and app version, maximum 10 submissions/account/day. Identity is the authenticated account ID. Failure retains the draft while the page remains open. Signing out/switching accounts clears the draft and inbox.
- Added an owner-only feedback inbox with newest-first pagination and Mark reviewed. The existing verified owner account was granted access administratively. No client can self-grant; OAuth connector sessions cannot access feedback. Users can access their own submissions only through the database policy, not anyone else’s.
- Database deployment: `server/database/align_feedback.sql`; regression transaction: `server/database/test_feedback.sql` (rolled back, no real feedback created).
- Automated checks: existing app/model/recovery/shopping/stock/sync checks plus new signup, welcome persistence, feedback draft/error and account-switch tests. SQL verified spoof prevention, account isolation, owner review and OAuth denial.
- Browser installation and email confirmation still depend on the device/browser. Confirming in a different browser from an installed app may require signing into that app once. Existing Home Screen icon/name refresh is controlled by the phone; do not clear site data to force it.
- No step counter, food-photo estimates, physique photos, paid features or live retailer prices were added in this release.
