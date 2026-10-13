# Nutrition OS v2.1 — private sync

The app uses Supabase Auth and the owner-private public.nutrition_state table.
The public publishable key in sync.js is intentional. No server secret is shipped.
The Supabase JavaScript SDK is pinned to 2.117.3 and vendored for offline startup.

## One-time account setup

In Supabase Authentication → URL Configuration, set Site URL to:
https://lgdghub.github.io/Personal_IOS_NutritionTracker/
Add the same exact address under Redirect URLs and save.

In Nutrition OS Settings, export your existing JSON backup, then Create account
using your email and a new password. This is a separate app login, not your
Supabase dashboard login. Confirm the email, return to the app, and sign in.
On an existing install use Settings → Check for app updates → Update.

Local records upload on sign-in when the cloud is empty. A clean new device pulls
existing cloud records. If both contain different data, choose the copy to keep;
there is no automatic merge. Export first. Recovery copies are stored locally
under nutrition-os-pwa-v1-before-cloud / nutrition-os-pwa-v1-cloud-before-replace.

## Behaviour

Changes save locally first. Sync runs after edits, on reconnect/focus, and every
30 seconds while visible. It does not promise iOS background uploading. Offline
records sync when you reopen online. Only server acknowledgements show Synced.
Optimistic revisions reject stale writes. Different account logins are blocked
from uploading this device's bound records. Signing out retains local records.
Clearing all tracking also syncs the empty state when signed in, after confirmation.

The connected Supabase management plugin can read nutrition_state.payload when
asked in a chat where it is available. It is a project administration connection,
not a dedicated read-only nutrition connector. No new MCP service was deployed.
ChatGPT must fetch records for the requested date range and report updated_at,
the last successful cloud upload. It must distinguish unlogged from zero values.
GitHub contains app source, never nutrition logs or account passwords.

## Checks

node tests/model.test.cjs
node tests/app.test.cjs
node tests/sync.test.cjs

Database tests passed for owner read/write, stale-revision rejection, cross-user
read/update denial and anonymous denial. Test users and records were rolled back.
Security advisor returned no findings. Browser/iPhone end-to-end testing remains
pending the user's signup and first sync.

Acceptance: log a meal, water and weight, wait for Synced, then ask ChatGPT to
retrieve those entries. Untick/edit and repeat; also test an offline edit followed
by reopening online. Do not infer successful sync from local UI ticks alone.
