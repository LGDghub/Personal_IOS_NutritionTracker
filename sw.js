// Bump VERSION for each release. Waiting updates are applied by the user's Update button.
const VERSION='v2.3.0';
const PREFIX='nutrition-os-'+encodeURIComponent(self.registration.scope)+'-';
const CACHE=PREFIX+VERSION;
const ASSETS=['./','./index.html','./style.css','./model.js','./app.js','./sync.js','./vendor/supabase-2.117.3.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 // Cache only this app's shell. Future authenticated API data must never enter this cache.
 if(!ASSETS.some(path=>new URL(path,self.registration.scope).pathname===url.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request,{ignoreSearch:true}))||fetch(event.request)));
});
