// Bump VERSION for each release. Waiting updates are applied by the user's Update button.
const VERSION='v4.0.0';
const PREFIX='nutrition-os-'+encodeURIComponent(self.registration.scope)+'-';
const CACHE=PREFIX+VERSION;
const ASSETS=['./','./index.html','./style.css','./model.js','./app.js','./sync.js','./features.js','./align.js','./align-icon.svg','./align-192.png','./align-512.png','./vendor/supabase-2.117.3.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new Request(path,{cache:'reload'}))))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 // Cache only this app's shell. Future authenticated API data must never enter this cache.
 if(!ASSETS.some(path=>new URL(path,self.registration.scope).pathname===url.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request,{ignoreSearch:true}))||fetch(event.request)));
});
// Only this opaque account marker is stored here, never health records or tokens.
function accountStore(value,write=false){return new Promise((resolve,reject)=>{const req=indexedDB.open('wfw-push-account',1);req.onupgradeneeded=()=>req.result.createObjectStore('account');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('account',write?'readwrite':'readonly'),store=tx.objectStore('account'),r=write?store.put(value,'active'):store.get('active');let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>reject(tx.error)}})}
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVE_ACCOUNT')event.waitUntil(accountStore(event.data.userId,true))});
self.addEventListener('push',event=>event.waitUntil((async()=>{let data;try{data=event.data.json()}catch{return}if(!data.userId||await accountStore()!==data.userId)return;await self.registration.showNotification('Align by Daly',{body:data.body,tag:data.tag,icon:'./align-192.png',badge:'./align-192.png',data:{url:self.registration.scope}})})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=windows.find(c=>c.url.startsWith(self.registration.scope));if(existing)return existing.focus();return self.clients.openWindow(self.registration.scope)})())});
