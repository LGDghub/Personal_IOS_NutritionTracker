NUTRITION OS v2.0 — PERSONAL iPHONE PWA

Continues the original Nutrition_OS_iPhone_PWA package. Original meal ingredients,
approximate macros, supplement labels, icons and shopping prices are retained.
No accounts, AI generation, commercial features or analytics are included.

WHAT CHANGED
- Forest dark, soft light and iPhone system themes.
- Complete meal macros; a calorie progress ring and protein/carbs/fat/fibre bars.
- Edit meals and add extra foods with your own portion macros. Tick/untick them.
- Daily snapshots: editing future meal templates does not rewrite logged history.
- Configurable daily goals. Original meal totals corrected to 3,022 kcal,
  182g protein, 362g carbs, 84g fat and 37g fibre. These are inherited plan values,
  not a newly assessed calorie recommendation.
- 250ml water checklist plus exact litre entry; adjustable water target.
- Weekly weigh-ins, editable dates, trend graph, daily and weekly summaries.
- Weekly shopping ticks, editable prices and remaining cost.
- v1 backup migration; validated v2 import and detailed JSON analysis export.
- Scoped offline cache, update notification and explicit local-saving status.

DEPLOY WITH GITHUB PAGES
1. Create a GitHub repository named nutrition-os, or choose an existing one.
   If using GitHub Free, Pages requires a public repository. Keep personal backups
   out of the repository. The UI code and bundled meal plan will be public.
2. Upload the CONTENTS of this folder to the repository root: index.html must sit
   at the top level, beside app.js, model.js, style.css, sw.js, manifest.webmanifest
   and both PNG icons. Include .nojekyll when using git.
3. In the repository choose Settings > Pages > Deploy from a branch.
4. Select main and /(root), then Save. If your branch has another name, choose it.
5. Wait for GitHub's Pages deployment to succeed and use the URL shown there.
   A typical project URL is https://YOUR-USERNAME.github.io/nutrition-os/.
6. Open that link in Safari on your iPhone. Share > Add to Home Screen > Add.
7. Open the installed app online once, then test it in airplane mode.

GitHub guidance:
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

UPGRADING AN EXISTING INSTALLATION
- Export a JSON backup before replacing files or changing hosting.
- Keep the same URL where possible. v1's local-storage key is preserved.
- Upload the complete new package. Close all app windows and Safari tabs for this
  site, then reopen online for the first v1 -> v2 upgrade.
- Subsequent updates show an Update app button when a new release is ready.
- Increment VERSION in sw.js for every future release. All shell assets are cached
  together, so an old offline view does not silently mix with new JavaScript.
- Installing as a Home Screen app or changing URL may use a separate data store.
  If data is missing, export from the original browser and import in the app.
- v1 shopping ticks have no dates; they migrate to the current week. Older shopping
  history cannot be reconstructed from v1. Macro values remain approximate.

BACKUPS
Settings > Export backup. Keep it in Files/iCloud Drive. Upload it to ChatGPT for
analysis until an authenticated live connection has been deployed.
Import validates a file before replacing data. It also retains one pre-import
copy in device storage (nutrition-os-pwa-v1-before-import), when storage permits.
A separate exported file is still the reliable recovery method.
Clearing Safari website data, losing a phone or storage eviction can erase data.

LIVE CHATGPT ACCESS — NOT YET CONNECTED
GitHub Pages serves this UI; the current release saves only on your device.
It does not upload meals, water or weight, and ChatGPT cannot read these records
from your phone. Installing GitHub connects repository access, not nutrition logs.
The proposed private sync service and MCP connector are described in LIVE-SYNC.md.
An authenticated online store must be deployed and connected before that works.
The app deliberately reports Local only rather than implying a working sync.

DEVELOPMENT / CHECKS
No build step or third-party runtime dependencies.
node --check app.js
node --check model.js
node --check sw.js
node tests/model.test.cjs
node tests/app.test.cjs
Tests cover migration, totals, snapshots, validation and UI state transitions
using a lightweight DOM harness. This is not a browser or real iPhone test.
Before considering a hosted release fully verified, use the device checklist in
RELEASE-NOTES.md.
