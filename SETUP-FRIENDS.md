# Personal WFW Tracker v3 — owner setup and friend guide

The stock counter, account-separated app, notification backend and ChatGPT server are deployed. ChatGPT login remains blocked until the owner enables OAuth and the token hook below. Friend signup also requires an email provider if the project is still using Supabase's restricted default sender.

## What is already built

- Supplement stock: choose a supplement, current quantity, unit, quantity used per tick, and low-stock threshold. Save again after restocking. Ticking deducts one dose; unticking restores it. Older ticks are included in the baseline, so enabling stock tracking does not subtract the whole history.
- Water and low-stock push notifications: opt in, choose timezone/daytime hours and reminder interval, enable each device, then use Test notification. Water reminders stop once the last synced daily goal is reached. Stock reminders send once per stock reset/restock cycle. The scheduler checks every five minutes; the phone/browser ultimately controls delivery.
- Account isolation: database rules restrict each account to its own rows; local caches switch with accounts; sign-out hides records and disables this device's push subscription. Friends start with empty meals/history and an editable shopping list. They must set their own targets and meal templates.
- ChatGPT OAuth connection: private reading plus optional editing of meals, personal daily targets and Monday weigh-ins, with explicit consent and revocation. The server derives the account from the verified token. It accepts no user-ID override. Edits validate inputs and the latest revision so concurrent changes cannot silently overwrite each other.

## Owner setup: required before inviting friends

Open the [Supabase project](https://supabase.com/dashboard/project/zrtnabwryzbdqzwghxcp).

1. **Authentication → Email / SMTP Settings:** configure your own verified email sender/SMTP provider if not already configured. Supabase's default sender is restricted and is unsuitable for friends' signup and reset emails. Keep email verification enabled. Do not invite friends as Supabase project administrators; they need tracker accounts only.
2. **Authentication → OAuth Server:** enable the OAuth 2.1 server and Dynamic Client Registration. Set the authorization path so the resulting consent URL is exactly:
   `https://lgdghub.github.io/Personal_IOS_NutritionTracker/oauth.html`
   Set **Authorization Path** to `/oauth.html`. Supabase appends this path to the existing Site URL `https://lgdghub.github.io/Personal_IOS_NutritionTracker/`, producing the consent URL above. Preserve the existing app Site URL and password-reset redirects.
3. **Authentication → Hooks → Custom Access Token:** choose the existing Postgres function `public.wfw_access_token_hook` and enable it. This binds approved connector tokens to the WFW server. The server intentionally rejects ordinary app tokens and OAuth tokens without this binding.
4. **Authentication → Signing Keys:** use an asymmetric signing key (ES256 or RS256) for OAuth/OpenID tokens if the project still uses the legacy symmetric key. Follow Supabase's rotation workflow; do not revoke a working key abruptly.
5. Complete a real ChatGPT connection with a test tracker account. If the account already authorised this OAuth client before a permission change/revocation, revoke its OAuth grant in Supabase or start a fresh connection so the consent screen is shown again. A deleted WFW grant blocks access immediately even if an OAuth token remains valid.

For extra password protection, the security advisor reports leaked-password checks disabled. Enable this if available on the project plan: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Each friend's steps

1. Open [Personal WFW Tracker](https://lgdghub.github.io/Personal_IOS_NutritionTracker/), go to Settings, create their own account and verify their email.
2. Set personal targets, edit breakfast/lunch/dinner and tick “Use these meal details for future days too”. Their entries are not shared with other users.
3. On iPhone, open in Safari → Share → Add to Home Screen, then launch that icon. Push requires iOS 16.4 or later. On supported Android browsers, use Install app/Add to Home Screen.
4. In Settings → Your reminders, choose the reminder types and hours, save preferences, then Enable on this phone. Allow notifications and press Test notification. Permission is required on each device.
5. In ChatGPT's custom app/MCP connector settings, add the URL below using OAuth. Sign in with **their tracker login**, then separately approve reading, meal editing, and (if wanted) daily target and Monday weigh-in editing. An existing meal approval does not grant profile editing; revoke the existing connection in tracker Settings and reconnect to see the new consent checkbox. Open the connection's Manage menu in ChatGPT Plugins and select **Refresh** to discover the new tools. Custom connector availability depends on the ChatGPT plan/workspace controls. They do not need your Supabase credentials or a shared API key.

```
https://zrtnabwryzbdqzwghxcp.supabase.co/functions/v1/wfw-mcp
```

Example requests:
- “Check my water and meals today.”
- “Save this lunch in my tracker for 15 October 2026: [portion and nutrition]. Mark it eaten.”
- “Change my breakfast template to [food and macros] for future days.”
- “Set my daily targets to [calories, protein, carbs, fat, fibre and litres of water].”
- “Log my measured starting weight of [kg] for Monday [date].”

ChatGPT should ask for missing measurements and portions/macros rather than inventing them. It must use the latest revision before writing. Weigh-ins are Monday-only, including a starting weight. App Settings → Connect your ChatGPT provides a revoke button. Reconnecting with edit access may require revoking the earlier OAuth grant first.

## How it works, simply

GitHub stores the app's code and publishes the website. Installing it adds a Home Screen shortcut with offline app files. Supabase holds the private accounts and records. The app saves to the signed-in account's device cache, then syncs online. A scheduled Supabase job checks each opted-in user's latest synced data and sends their notifications. The ChatGPT server checks who signed in and what they approved before reading or changing their meals.

## Limits and privacy

- Reminders use the last **synced** records. Offline changes will not affect a reminder until uploaded. Notification text may appear on the lock screen.
- Separate tracker accounts cannot access each other's records through the app/API. The project owner still has administrative access to the database; this is not end-to-end encryption from the owner.
- Do not share tracker passwords. Browser profiles and OS users are the boundary on a shared physical device; someone with developer-tools access to that browser can inspect local caches.
- Stock is tracked for the four existing supplements. Restocking sets the quantity left **now** and re-arms a low-stock reminder. Historical corrections can adjust the derived balance; reset current stock if you need to reconcile an actual count.
- Daily reminder windows currently run within one local day (start before end). Push may be delayed or suppressed by phone settings, battery restrictions or connectivity.
- This implementation serves a small friend group. Larger public rollout needs delivery queues/batching, abuse controls, monitoring, a privacy policy and measured load testing.

## Verification performed

Model/UI harness tests cover existing meals, water, Monday weigh-ins, backups, password recovery and sync conflicts. New tests cover stock baseline/undo/restock, account switching, timezone windows, target completion and push endpoint allowlisting. Transactional database tests used temporary users and rolled everything back: cross-account read/write denial, private subscriptions, read-only OAuth, meal-only writes, stale revision rejection and revocation all passed. Live endpoints reject unauthenticated access. Full OAuth login and actual phone delivery require the owner settings/device steps above and are not yet end-to-end verified.
