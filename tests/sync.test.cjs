// Lightweight DOM harness: checks app startup and state transitions, not visual rendering.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
function element(id){const fields={};return {id,value:'',textContent:'',innerHTML:'',style:{},dataset:{},hidden:false,checked:false,classList:{toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},getContext(){return null},elements:{namedItem(name){return fields[name]??={value:'',checked:false}}},reset(){for(const f of Object.values(fields)){f.value='';f.checked=false}},showModal(){this.open=true},close(){this.open=false}}}
const nodes=Object.fromEntries(ids.map(id=>[id,element(id)])),handlers={},storage=new Map(),notices=[];
const context=vm.createContext({console,Date,JSON,Number,Set,Math,Object,Array,Error,Intl,URL,Blob,crypto:require('node:crypto').webcrypto,location:{protocol:'file:',reload(){}},navigator:{onLine:true},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},matchMedia:()=>({matches:false,addEventListener(){}}),document:{getElementById:id=>{assert(nodes[id],id);return nodes[id]},documentElement:{dataset:{}},querySelector:()=>element('meta'),querySelectorAll:()=>[],addEventListener:(n,fn)=>handlers[n]=fn,hidden:false},window:{addEventListener(){},scrollTo(){}},setTimeout:()=>1,clearTimeout(){},setInterval(){},alert:m=>notices.push(m),confirm:()=>true});
vm.runInContext(fs.readFileSync(path.join(root,'model.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'app.js'),'utf8'),context);

let remote=null,writes=0,failWrite=false,authCallback;
const copy=x=>JSON.parse(JSON.stringify(x));
const mock={auth:{onAuthStateChange(fn){authCallback=fn}},from(){return {select(){return {eq(){return {async maybeSingle(){return {data:copy(remote),error:null}}}}}}}},async rpc(_name,args){writes++;if(failWrite)return {error:{message:'Network failed'}};if(args.expected_revision!==(remote?.revision||0))return {error:{code:'40001'}};remote={user_id:'user-a',revision:(remote?.revision||0)+1,payload:copy(args.next_payload),updated_at:new Date().toISOString()};return {data:copy(remote)}}};
context.supabase={createClient:()=>mock};
vm.runInContext(fs.readFileSync(path.join(root,'sync.js'),'utf8'),context);
const run=s=>vm.runInContext(s,context);
(async()=>{
 authCallback('SIGNED_IN',{user:{id:'user-a',email:'example@example.com'}});
 await run('syncNow()');assert.equal(remote.revision,1);
 nodes.addWater.onclick();await run('syncNow()');assert.equal(remote.payload.days[run('dayKey')].water,.25);
 // Offline changes survive and upload when reconnected.
 context.navigator.onLine=false;nodes.addWater.onclick();await run('syncNow()');assert.equal(remote.payload.days[run('dayKey')].water,.25);
 context.navigator.onLine=true;await run('syncNow()');assert.equal(remote.payload.days[run('dayKey')].water,.5);
 // Failed upload retains dirty state, then retries.
 nodes.addWater.onclick();failWrite=true;await run('syncNow()');assert.match(nodes.syncStatus.textContent,/Not synced/);failWrite=false;await run('syncNow()');assert.equal(remote.payload.days[run('dayKey')].water,.75);
 // Clean device pulls a newer cloud copy.
 remote.payload.days[run('dayKey')].water=1;remote.revision++;await run('syncNow()');assert.equal(nodes.water.value,1);
 // Concurrent edits cannot silently overwrite either copy.
 nodes.addWater.onclick();remote.payload.days[run('dayKey')].water=2;remote.revision++;let before=writes;await run('syncNow()');assert.equal(writes,before);assert.equal(nodes.syncConflict.hidden,false);assert.equal(nodes.water.value,1.25);
 nodes.useCloud.onclick();await new Promise(r=>setImmediate(r));assert.equal(nodes.water.value,2);
 // A second account cannot upload this device's data.
 authCallback('SIGNED_IN',{user:{id:'user-b',email:'other@example.com'}});before=writes;await run('syncNow()');assert.equal(writes,before);assert.match(nodes.syncStatus.textContent,/another account/);
 // Legacy/imported records without updatedAt are treated as data, never blank.
 run("syncMeta={};cloudUser={id:'user-a'};state.updatedAt=null;cloudConflict=null");await run('syncNow()');assert.equal(nodes.syncConflict.hidden,false);
 console.log('PASS: initial upload, edits, offline retry, failed writes, cloud pull, conflict preservation, account isolation, legacy records.');
})().catch(e=>{console.error(e);process.exitCode=1});
